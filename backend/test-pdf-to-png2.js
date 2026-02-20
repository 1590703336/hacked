const fs = require('fs');
const { pdfToPng } = require('pdf-to-png-converter');

async function test() {
    const pdfBuffer = fs.readFileSync('test.pdf');
    const pngPages = await pdfToPng(pdfBuffer, {
        disableFontFace: false,
        useSystemFonts: true,
        viewportScale: 2.0
    });

    const ocrRes = await fetch('http://localhost:3001/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: pngPages[0].content.toString('base64') })
    });
    console.log('OCR status:', ocrRes.status, await ocrRes.json());
}
test().catch(console.error);
