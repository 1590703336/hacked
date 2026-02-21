const config = require('../../config');
const ttsService = require('./tts.service');

const DEFAULT_STREAM_RETRIES = 2;
const DEFAULT_STREAM_CONCURRENCY = 3;
const streamStates = new Map();

function perfLog(message) {
    if (config.enablePerfLogs) {
        console.log(message);
    }
}

function makeReqId(prefix = 'tts') {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function createStreamState() {
    return {
        paused: false,
        stopped: false,
        waiters: new Set(),
    };
}

function wakeStreamWaiters(state) {
    for (const resolve of state.waiters) {
        resolve();
    }
    state.waiters.clear();
}

async function waitIfPaused(state) {
    while (state.paused && !state.stopped) {
        await new Promise((resolve) => state.waiters.add(resolve));
    }
}

async function synthesize(req, res, next) {
    try {
        const reqId = makeReqId('tts-single');
        const startedAt = Date.now();
        const { text, voice, speed, model } = req.body;
        const { audioBuffer, meta } = await ttsService.synthesizeWithMeta(
            text,
            voice,
            speed,
            model,
            { lane: 'interactive' }
        );

        res.set({
            'Content-Type': ttsService.outputMimeType,
            'Content-Length': audioBuffer.length,
        });
        res.send(audioBuffer);
        perfLog(`[TTS][synthesize][${reqId}] textChars=${text?.length || 0} cacheHit=${meta.cacheHit} queueWaitMs=${meta.inferenceQueueWaitMs} synthMs=${meta.synthMs} encodeMs=${meta.encodeMs} totalMs=${Date.now() - startedAt}`);
    } catch (err) {
        next(err);
    }
}

async function chunk(req, res, next) {
    try {
        const { markdown } = req.body;
        const chunks = await ttsService.semanticChunk(markdown);
        res.json({ success: true, data: { chunks, chunkCount: chunks.length } });
    } catch (err) {
        next(err);
    }
}

async function pipeline(req, res, next) {
    try {
        const { markdown, voice, speed, model } = req.body;
        const audioBuffer = await ttsService.synthesizeAll(markdown, voice, speed, model);

        res.set({
            'Content-Type': ttsService.outputMimeType,
            'Content-Length': audioBuffer.length,
        });
        res.send(audioBuffer);
    } catch (err) {
        next(err);
    }
}

async function controlStream(req, res, next) {
    try {
        const { streamId, action } = req.body;
        const state = streamStates.get(streamId);
        if (!state) {
            return res.status(404).json({
                success: false,
                error: 'NotFoundError',
                message: `streamId "${streamId}" not found`,
            });
        }

        if (action === 'pause') {
            state.paused = true;
        } else if (action === 'resume') {
            state.paused = false;
            wakeStreamWaiters(state);
        } else if (action === 'stop') {
            state.stopped = true;
            state.paused = false;
            wakeStreamWaiters(state);
        }

        return res.json({
            success: true,
            data: {
                streamId,
                paused: state.paused,
                stopped: state.stopped,
            },
        });
    } catch (err) {
        next(err);
    }
}

async function streamChunks(req, res, next) {
    const reqId = makeReqId('tts-stream');
    const requestStartedAt = Date.now();
    const source = req.method === 'GET' ? req.query : req.body;
    const { markdown, voice, speed, model } = source;
    const streamId = source.streamId || makeReqId('stream');
    const parsedSpeed = speed ? parseFloat(speed) : undefined;
    const retryAttempts = Math.max(1, Number(config.ttsRetryAttempts) || DEFAULT_STREAM_RETRIES);
    const streamConcurrency = Math.max(1, Number(config.ttsChunkConcurrency) || DEFAULT_STREAM_CONCURRENCY);
    const state = createStreamState();
    streamStates.set(streamId, state);

    let keepAliveInterval = null;
    let streamClosed = false;
    const closeStream = () => {
        streamClosed = true;
        if (keepAliveInterval) {
            clearInterval(keepAliveInterval);
            keepAliveInterval = null;
        }
        state.stopped = true;
        state.paused = false;
        wakeStreamWaiters(state);
    };

    try {
        if (!markdown) {
            streamStates.delete(streamId);
            return res.status(400).json({ success: false, error: 'ValidationError', message: 'markdown is required' });
        }

        const chunkingStartedAt = Date.now();
        const chunks = await ttsService.semanticChunk(markdown);
        const chunkingMs = Date.now() - chunkingStartedAt;
        perfLog(`[TTS][stream][${reqId}] streamId=${streamId} chunkingDone chunkCount=${chunks.length} chunkingMs=${chunkingMs} markdownChars=${markdown.length} streamConcurrency=${streamConcurrency}`);

        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
        });

        res.write(`data: ${JSON.stringify({ type: 'metadata', streamId, chunkCount: chunks.length, mimeType: ttsService.outputMimeType })}\n\n`);

        keepAliveInterval = setInterval(() => {
            res.write(': keepalive\n\n');
        }, 15000);

        res.on('close', () => {
            closeStream();
        });

        let firstAudioSentAt = null;
        let successfulChunks = 0;

        for (let i = 0; i < chunks.length; i++) {
            if (state.stopped || streamClosed) {
                break;
            }

            await waitIfPaused(state);
            if (state.stopped || streamClosed) {
                break;
            }

            const chunkStartedAt = Date.now();
            let result = null;
            for (let attempt = 1; attempt <= retryAttempts; attempt++) {
                try {
                    const { audioBuffer, meta } = await ttsService.synthesizeWithMeta(
                        chunks[i],
                        voice,
                        parsedSpeed,
                        model,
                        { lane: 'stream' }
                    );
                    result = {
                        success: true,
                        attempt,
                        chunkIndex: i,
                        chunkText: chunks[i],
                        audioBuffer,
                        streamQueueWaitMs: 0,
                        meta,
                        chunkMs: Date.now() - chunkStartedAt,
                    };
                    break;
                } catch (synthError) {
                    console.error(`Error synthesizing chunk ${i} (attempt ${attempt}/${retryAttempts}):`, synthError);
                    if (attempt >= retryAttempts) {
                        result = { success: false, attempt, chunkIndex: i, streamQueueWaitMs: 0 };
                    } else {
                        await new Promise((resolve) => setTimeout(resolve, 250));
                    }
                }
            }

            if (!result.success) {
                res.write(`data: ${JSON.stringify({ type: 'error', message: 'Failed to synthesize chunk after retries', chunkIndex: i })}\n\n`);
                perfLog(`[TTS][stream][${reqId}] streamId=${streamId} chunk=${i} failed attempts=${result.attempt} streamQueueWaitMs=${result.streamQueueWaitMs}`);
                continue;
            }

            const base64Audio = result.audioBuffer.toString('base64');
            const eventPayload = {
                type: 'audio',
                chunkIndex: i,
                audioBase64: base64Audio,
                text: result.chunkText,
                mimeType: ttsService.outputMimeType,
            };

            if (!firstAudioSentAt) {
                firstAudioSentAt = Date.now();
                perfLog(`[TTS][stream][${reqId}] streamId=${streamId} firstAudioLatencyMs=${firstAudioSentAt - requestStartedAt} (includes chunking)`);
            }

            res.write(`data: ${JSON.stringify(eventPayload)}\n\n`);
            successfulChunks += 1;
            perfLog(`[TTS][stream][${reqId}] streamId=${streamId} chunk=${i} attempt=${result.attempt} cacheHit=${result.meta.cacheHit} streamQueueWaitMs=${result.streamQueueWaitMs} inferenceQueueWaitMs=${result.meta.inferenceQueueWaitMs} synthMs=${result.meta.synthMs} encodeMs=${result.meta.encodeMs} bytes=${result.meta.bytes}`);

            // Yield to event loop so stream control requests can be handled between chunks.
            await new Promise((resolve) => setImmediate(resolve));
        }

        if (!streamClosed && !state.stopped) {
            res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
            res.end();
            perfLog(`[TTS][stream][${reqId}] streamId=${streamId} done successfulChunks=${successfulChunks}/${chunks.length} totalMs=${Date.now() - requestStartedAt}`);
        }
    } catch (err) {
        next(err);
    } finally {
        closeStream();
        streamStates.delete(streamId);
    }
}

module.exports = { synthesize, chunk, pipeline, streamChunks, controlStream };
