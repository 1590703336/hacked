const fs = require('fs');
async function test() {
  const fileBuf = fs.readFileSync('/Users/huanzhang/code/hacked/frontend/public/favicon.ico');
  const formData = new FormData();
  formData.append('file', new Blob([fileBuf], { type: 'image/x-icon' }), 'favicon.ico');
  
  const res = await fetch('http://localhost:3001/api/capture/upload', {
    method: 'POST',
    body: formData
  });
  const json = await res.json();
  console.log('Capture response:', json);
  
  if (json.success && json.data.images?.length > 0) {
     const b64 = json.data.images[0];
     const ocrRes = await fetch('http://localhost:3001/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: b64 })
     });
     console.log('OCR status:', ocrRes.status, await ocrRes.json());
  }
}
test().catch(console.error);
