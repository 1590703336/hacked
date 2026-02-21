const fs = require('fs');
async function test() {
  const ocrRes = await fetch('http://localhost:3001/api/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      // minimal valid base64 image (1x1 pixel black PNG)
      imageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='})
  });
  console.log('OCR status:', ocrRes.status, await ocrRes.json());
}
test().catch(console.error);
