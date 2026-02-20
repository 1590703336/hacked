const fs = require('fs');

async function test() {
    const ocrRes = await fetch('http://localhost:3001/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            // The pdfkit generated PDF from earlier test
            imageBase64: fs.readFileSync('test.pdf').toString('base64')
        })
    });
    console.log('Gemini raw response status:', ocrRes.status, await ocrRes.text());
}
test().catch(console.error);
