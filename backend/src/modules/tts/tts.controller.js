const ttsService = require('./tts.service');

async function synthesize(req, res, next) {
    try {
        const { text, voice, speed, model } = req.body;
        const audioBuffer = await ttsService.synthesize(text, voice, speed, model);

        res.set({
            'Content-Type': 'audio/mpeg',
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
            'Content-Type': 'audio/mpeg',
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
        res.write(`data: ${JSON.stringify({ type: 'metadata', chunkCount: chunks.length })}\n\n`);

        for (let i = 0; i < chunks.length; i++) {
            try {
                // Ensure text is converted to numbers if they were passed as strings
                const parsedSpeed = speed ? parseFloat(speed) : undefined;
                const audioBuffer = await ttsService.synthesize(chunks[i], voice, parsedSpeed, model);

                const base64Audio = audioBuffer.toString('base64');
                const eventPayload = {
                    type: 'audio',
                    chunkIndex: i,
                    audioBase64: base64Audio,
                    text: chunks[i],
                };

                res.write(`data: ${JSON.stringify(eventPayload)}\n\n`);
            } catch (synthError) {
                console.error(`Error synthesizing chunk ${i}:`, synthError);
                res.write(`data: ${JSON.stringify({ type: 'error', message: 'Failed to synthesize chunk', chunkIndex: i })}\n\n`);
            }
        }

        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        res.end();
    } catch (err) {
        next(err);
    }
}

module.exports = { synthesize, chunk, pipeline, streamChunks };
