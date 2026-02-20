const fs = require('fs');
async function test() {
  const fileBuf = fs.readFileSync('/Users/huanzhang/code/hacked/frontend/public/vite.svg');
  const formData = new FormData();
  formData.append('file', new Blob([fileBuf], { type: 'image/svg+xml' }), 'vite.svg');
  
  const res = await fetch('http://localhost:3001/api/capture/upload', {
    method: 'POST',
    body: formData
  });
  console.log(res.status, await res.text());
}
test().catch(console.error);
