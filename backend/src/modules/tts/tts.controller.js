const pLimit = require('p-limit');
const config = require('../../config');
const ttsService = require('./tts.service');

const DEFAULT_STREAM_RETRIES = 2;
const DEFAULT_STREAM_CONCURRENCY = 3;

async function synthesize(req, res, next) {
    try {
        const { text, voice, speed, model } = req.body;
        const audioBuffer = await ttsService.synthesize(text, voice, speed, model);

        res.set({
            'Content-Type': ttsService.outputMimeType,
            'Content-Length': audioBuffer.length,
        });
        res.send(audioBuffer);
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
        // SSE expects GET request params
        const { markdown, voice, speed, model } = req.query;
        const parsedSpeed = speed ? parseFloat(speed) : undefined;
        const retryAttempts = Math.max(1, Number(config.ttsRetryAttempts) || DEFAULT_STREAM_RETRIES);
        const streamConcurrency = Math.max(1, Number(config.ttsChunkConcurrency) || DEFAULT_STREAM_CONCURRENCY);

        if (!markdown) {
            return res.status(400).json({ success: false, error: 'ValidationError', message: 'markdown query param is required' });
        }

        const chunks = await ttsService.semanticChunk(markdown);

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
        const chunkTasks = chunks.map((chunkText, chunkIndex) =>
            limit(async () => {
                for (let attempt = 1; attempt <= retryAttempts; attempt++) {
                    try {
                        const audioBuffer = await ttsService.synthesize(chunkText, voice, parsedSpeed, model);
                        return { success: true, chunkIndex, chunkText, audioBuffer };
                    } catch (synthError) {
                        console.error(`Error synthesizing chunk ${chunkIndex} (attempt ${attempt}/${retryAttempts}):`, synthError);
                        if (attempt >= retryAttempts) {
                            return { success: false, chunkIndex };
                        }
                        await new Promise((resolve) => setTimeout(resolve, 250));
                    }
                }
                return { success: false, chunkIndex };
            })
        );

        for (let i = 0; i < chunkTasks.length; i++) {
            if (streamClosed) {
                break;
            }

            const result = await chunkTasks[i];
            if (!result.success) {
                res.write(`data: ${JSON.stringify({ type: 'error', message: 'Failed to synthesize chunk after retries', chunkIndex: i })}\n\n`);
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

            res.write(`data: ${JSON.stringify(eventPayload)}\n\n`);
        }

        clearInterval(keepAliveInterval);
        if (!streamClosed) {
            res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
            res.end();
        }
    } catch (err) {
        next(err);
    }
}

module.exports = { synthesize, chunk, pipeline, streamChunks };
