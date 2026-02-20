const fs = require('fs');
const path = require('path');
const captureService = require('./src/modules/capture/capture.service');
const ocrService = require('./src/modules/ocr/ocr.service');

async function test() {
    try {
        const fileBuffer = fs.readFileSync('multi.pdf');
        const fileObj = {
            buffer: fileBuffer,
            mimetype: 'application/pdf',
            originalname: 'multi.pdf',
            size: fileBuffer.length
        };

        console.log('Processing upload...');
        const captureResult = await captureService.processUpload(fileObj);
        console.log(`Got ${captureResult.images.length} images.`);

        for (let i = 0; i < captureResult.images.length; i++) {
            const b64 = captureResult.images[i];
            console.log(`Running OCR for page ${i + 1}, length: ${b64.length}...`);
            const ocrResult = await ocrService.recognize(b64, 'image/png');
            console.log(`Page ${i + 1} result noText:`, ocrResult.noTextDetected, 'markdown length:', ocrResult.markdown.length);
        }
    } catch (err) {
        console.error('Error:', err);
    }
}
test();
