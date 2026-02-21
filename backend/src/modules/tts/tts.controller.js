const pLimit = require('p-limit');
const config = require('../../config');
const ttsService = require('./tts.service');

const DEFAULT_STREAM_RETRIES = 2;
const DEFAULT_STREAM_CONCURRENCY = 3;

function perfLog(message) {
    if (config.enablePerfLogs) {
        console.log(message);
    }
}

function makeReqId(prefix = 'tts') {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

async function synthesize(req, res, next) {
    try {
        const reqId = makeReqId('tts-single');
        const startedAt = Date.now();
        const { text, voice, speed, model } = req.body;
        const { audioBuffer, meta } = await ttsService.synthesizeWithMeta(text, voice, speed, model);

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

async function streamChunks(req, res, next) {
    try {
        const reqId = makeReqId('tts-stream');
        const requestStartedAt = Date.now();
        // SSE expects GET request params
        const { markdown, voice, speed, model } = req.query;
        const parsedSpeed = speed ? parseFloat(speed) : undefined;
        const retryAttempts = Math.max(1, Number(config.ttsRetryAttempts) || DEFAULT_STREAM_RETRIES);
        const streamConcurrency = Math.max(1, Number(config.ttsChunkConcurrency) || DEFAULT_STREAM_CONCURRENCY);

        if (!markdown) {
            return res.status(400).json({ success: false, error: 'ValidationError', message: 'markdown query param is required' });
        }

        const chunkingStartedAt = Date.now();
        const chunks = await ttsService.semanticChunk(markdown);
        const chunkingMs = Date.now() - chunkingStartedAt;
        perfLog(`[TTS][stream][${reqId}] chunkingDone chunkCount=${chunks.length} chunkingMs=${chunkingMs} markdownChars=${markdown.length}`);

        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
        });

        // Send down chunk count metadata straight away
        res.write(`data: ${JSON.stringify({ type: 'metadata', chunkCount: chunks.length, mimeType: ttsService.outputMimeType })}\n\n`);

        // Send a keepalive heartbeat every 15 seconds so long TTS generations don't drop the connection
        const keepAliveInterval = setInterval(() => {
            res.write(': keepalive\n\n');
        }, 15000);

        let streamClosed = false;
        res.on('close', () => {
            streamClosed = true;
            clearInterval(keepAliveInterval);
        });

        const limit = pLimit(streamConcurrency);
        const chunkTasks = chunks.map((chunkText, chunkIndex) => {
            const queuedAt = Date.now();
            return limit(async () => {
                const startedAt = Date.now();
                const streamQueueWaitMs = startedAt - queuedAt;

                for (let attempt = 1; attempt <= retryAttempts; attempt++) {
                    try {
                        const { audioBuffer, meta } = await ttsService.synthesizeWithMeta(chunkText, voice, parsedSpeed, model);
                        return { success: true, chunkIndex, chunkText, audioBuffer, attempt, streamQueueWaitMs, meta };
                    } catch (synthError) {
                        console.error(`Error synthesizing chunk ${chunkIndex} (attempt ${attempt}/${retryAttempts}):`, synthError);
                        if (attempt >= retryAttempts) {
                            return { success: false, chunkIndex, streamQueueWaitMs, attempt };
                        }
                        await new Promise((resolve) => setTimeout(resolve, 250));
                    }
                }

                return { success: false, chunkIndex, streamQueueWaitMs, attempt: retryAttempts };
            });
        });

        let firstAudioSentAt = null;
        let successfulChunks = 0;
        for (let i = 0; i < chunkTasks.length; i++) {
            if (streamClosed) {
                break;
            }

            const result = await chunkTasks[i];
            if (!result.success) {
                res.write(`data: ${JSON.stringify({ type: 'error', message: 'Failed to synthesize chunk after retries', chunkIndex: i })}\n\n`);
                perfLog(`[TTS][stream][${reqId}] chunk=${i} failed attempts=${result.attempt} streamQueueWaitMs=${result.streamQueueWaitMs}`);
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
                perfLog(`[TTS][stream][${reqId}] firstAudioLatencyMs=${firstAudioSentAt - requestStartedAt} (includes chunking)`);
            }

            res.write(`data: ${JSON.stringify(eventPayload)}\n\n`);
            successfulChunks += 1;
            perfLog(`[TTS][stream][${reqId}] chunk=${i} attempt=${result.attempt} cacheHit=${result.meta.cacheHit} streamQueueWaitMs=${result.streamQueueWaitMs} inferenceQueueWaitMs=${result.meta.inferenceQueueWaitMs} synthMs=${result.meta.synthMs} encodeMs=${result.meta.encodeMs} bytes=${result.meta.bytes}`);
        }

        clearInterval(keepAliveInterval);
        if (!streamClosed) {
            res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
            res.end();
            perfLog(`[TTS][stream][${reqId}] done successfulChunks=${successfulChunks}/${chunks.length} totalMs=${Date.now() - requestStartedAt}`);
        }
    } catch (err) {
        next(err);
    }
}

module.exports = { synthesize, chunk, pipeline, streamChunks };
