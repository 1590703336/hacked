const fs = require('fs');
const { pdfToPng } = require('pdf-to-png-converter');

async function test() {
    const pdfBuffer = fs.readFileSync('test.pdf');
    const pngPages = await pdfToPng(pdfBuffer, {
        disableFontFace: false,
        useSystemFonts: true,
        viewportScale: 2.0
    });

    if (pngPages.length > 0) {
        const b64 = pngPages[0].content.toString('base64');
        console.log('Base64 length with pdf-to-png-converter:', b64.length, 'starts with:', b64.substring(0, 50));
    }
}
test().catch(console.error);
