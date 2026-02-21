const { ValidationError } = require('../../shared/errors');
const path = require('path');
const { pdfToPng } = require('pdf-to-png-converter');

// Resolve the pdfjs-dist used by pdf-to-png-converter to locate CMaps and standard fonts
const converterPath = require.resolve('pdf-to-png-converter');
const pdfjsDistPkgPath = require.resolve('pdfjs-dist/package.json', { paths: [converterPath] });
const CMAP_URL = path.join(path.dirname(pdfjsDistPkgPath), 'cmaps') + '/';
const STANDARD_FONTS_URL = path.join(path.dirname(pdfjsDistPkgPath), 'standard_fonts') + '/';

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
        const pngPages = await pdfToPng(file.buffer, {
            disableFontFace: true,
            useSystemFonts: true,
            viewportScale: 2.0,
            cMapUrl: CMAP_URL,
            cMapPacked: true,
            standardFontDataUrl: STANDARD_FONTS_URL
        });
        images = pngPages.map(p => p.content.toString('base64')); // These are base64 strings
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
