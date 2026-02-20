const { ValidationError } = require('../../shared/errors');

const pdf2img = require('pdf-img-convert');

/**
 * Process an uploaded file (PDF or image).
 * @param {object} file - Multer file object
 * @returns {object} parsed content metadata
 */
async function processUpload(file) {
    if (!file) {
        throw new ValidationError('No file provided');
    }

    let images = [];

    if (file.mimetype === 'application/pdf') {
        const pdfArray = await pdf2img.convert(file.buffer, {
            base64: true,
            scale: 2.0 // Better resolution for OCR
        });
        images = pdfArray; // These are base64 strings
    } else if (file.mimetype.startsWith('image/')) {
        images = [file.buffer.toString('base64')];
    } else {
        throw new ValidationError('Unsupported file type. Please upload a PDF or an image.');
    }

    return {
        filename: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        images: images,
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

    // Just validate and return the base64 image
    return {
        capturedAt: new Date().toISOString(),
        imageSize: Buffer.byteLength(imageBase64, 'base64'),
        images: [imageBase64],
    };
}

module.exports = { processUpload, processScreenCapture };
