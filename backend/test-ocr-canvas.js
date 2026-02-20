const { createCanvas } = require('canvas');

async function test() {
  const canvas = createCanvas(400, 200);
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, 400, 200);
  
  ctx.fillStyle = 'black';
  ctx.font = '30px Arial';
  ctx.fillText('Hello OCR Text!', 50, 100);
  
  const b64 = canvas.toBuffer('image/png').toString('base64');
  
  const ocrRes = await fetch('http://localhost:3001/api/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: b64})
  });
  console.log('OCR status:', ocrRes.status, await ocrRes.json());
}
test().catch(console.error);
