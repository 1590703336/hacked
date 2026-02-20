const ttsService = require('./tts.service');

async function synthesize(req, res, next) {
    try {
        const { text, voice } = req.body;
        const audioBuffer = await ttsService.synthesize(text, voice);

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
        res.json({ success: true, data: { chunks } });
    } catch (err) {
        next(err);
    }
}

module.exports = { synthesize, chunk };
