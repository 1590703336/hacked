const fs = require('fs');
const { pdfToPng } = require('pdf-to-png-converter');

async function test() {
    const pdfBuffer = fs.readFileSync('multi.pdf');
    const pngPages = await pdfToPng(pdfBuffer, {
        disableFontFace: false,
        useSystemFonts: true,
        viewportScale: 2.0
    });

    console.log(`Converted ${pngPages.length} pages.`);
    for (let i = 0; i < pngPages.length; i++) {
        const p = pngPages[i];
        fs.writeFileSync(`test-page-${i + 1}.png`, p.content);
        console.log(`Page ${i + 1} size: ${p.content.length} bytes`);
    }
}
test().catch(console.error);
