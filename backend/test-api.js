const fs = require('fs');
async function test() {
  const fileBuf = await fs.promises.readFile('/Users/huanzhang/code/hacked/frontend/src/assets/react.svg');
  // Just send to OCR endpoint as if capture returned it
  const base64 = fileBuf.toString('base64');
  console.log('Base64 starts with:', base64.substring(0, 20));
  
  const res = await fetch('http://localhost:3001/api/ocr', {
    method: 'POST',
    headers: { 'Content-type': 'application/json' },
    body: JSON.stringify({ imageBase64: base64 })
  });
  console.log(res.status, await res.text());
}
test().catch(console.error);
