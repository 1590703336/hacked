const fs = require('fs');
async function test() {
  const fileBuf = fs.readFileSync('/Users/huanzhang/code/hacked/frontend/public/icon-192-maskable.png');
  const b64 = fileBuf.toString('base64');
  
  const ocrRes = await fetch('http://localhost:3001/api/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: b64})
  });
  console.log('OCR status:', ocrRes.status, await ocrRes.json());
}
test().catch(console.error);
