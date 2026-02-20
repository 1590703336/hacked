const fs = require('fs');
async function test() {
  const FormData = require('form-data');
  const form = new FormData();
  form.append('file', fs.createReadStream('/Users/huanzhang/code/hacked/frontend/public/vite.svg'));
  
  const res = await fetch('http://localhost:3001/api/capture/upload', {
    method: 'POST',
    body: form
  });
  console.log(res.status, await res.text());
}
test().catch(console.error);
