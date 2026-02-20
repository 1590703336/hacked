const captureService = require('./capture.service');

async function uploadFile(req, res, next) {
    try {
        const result = await captureService.processUpload(req.file);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
}

async function captureScreen(req, res, next) {
    try {
        const { imageBase64 } = req.body;
        const result = await captureService.processScreenCapture(imageBase64);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
}

module.exports = { uploadFile, captureScreen };
