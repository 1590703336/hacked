const fs = require('fs');

async function test() {
    const fileBuf = fs.readFileSync('test.pdf');
    const b64 = fileBuf.toString('base64');

    const ocrRes = await fetch('http://localhost:3001/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: 'data:application/pdf;base64,' + b64})
    });
    console.log('OCR status:', ocrRes.status, await ocrRes.text());
}
test().catch(console.error);
