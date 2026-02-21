const fs = require('fs');
const pdf2img = require('pdf-img-convert');

async function test() {
  const pdfBuffer = fs.readFileSync('test.pdf');
  const pdfArray = await pdf2img.convert(pdfBuffer, { base64: true });
  
  if (pdfArray.length > 0) {
     const b64 = pdfArray[0];
     let str = typeof b64 === 'string' ? b64 : Buffer.from(b64).toString('base64');
     console.log('Base64 length without scale:', str.length, 'starts with:', str.substring(0, 50));
  }
}
test().catch(console.error);
