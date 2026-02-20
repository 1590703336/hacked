const ocrService = require('./ocr.service');

async function recognizeImage(req, res, next) {
    try {
        const { imageBase64, provider } = req.body;
        const result = await ocrService.recognize(imageBase64, provider);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
}

module.exports = { recognizeImage };
