const { ValidationError } = require('../../shared/errors');

/**
 * Process an uploaded file (PDF or image).
 * @param {object} file - Multer file object
 * @returns {object} parsed content metadata
 */
async function processUpload(file) {
    if (!file) {
        throw new ValidationError('No file provided');
    }

    // TODO: Implement PDF parsing (pdf-parse) and image handling
    return {
        filename: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        text: '', // placeholder for extracted text
    };
}

/**
 * Process a screen capture sent as base64 image.
 * @param {string} imageBase64
 * @returns {object} capture metadata
 */
async function processScreenCapture(imageBase64) {
    if (!imageBase64) {
        throw new ValidationError('No image data provided');
    }

    // TODO: Forward to OCR module for text extraction
    return {
        capturedAt: new Date().toISOString(),
        imageSize: Buffer.byteLength(imageBase64, 'base64'),
    };
}

module.exports = { processUpload, processScreenCapture };
