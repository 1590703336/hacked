const { randomUUID } = require('crypto'); // built-in, no deps
const ocrService = require('./ocr.service');

async function recognizeImage(req, res, next) {
    const requestId = randomUUID();
    const { imageBase64, mimeType } = req.body; // both set by validator

    console.log(`[OCR] [${requestId}] start — mimeType: ${mimeType}`);

    try {
        const result = await ocrService.recognize(imageBase64, mimeType);
        console.log(`[OCR] [${requestId}] done — ${result.latencyMs}ms, noText: ${result.noTextDetected}`);
        return res.status(200).json({ success: true, requestId, data: result });
    } catch (err) {
        console.error(`[OCR] [${requestId}] error — ${err.name}: ${err.message}`);
        return next(err);
    }
}

module.exports = { recognizeImage };
