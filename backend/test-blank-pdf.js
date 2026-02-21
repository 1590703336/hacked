const PDFDocument = require('pdfkit');
const fs = require('fs');
const pdf2img = require('pdf-img-convert');

async function test() {
  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream('test.pdf'));
  doc.fontSize(25).text('Hello from PDF text!', 100, 100);
  doc.end();

  await new Promise(r => setTimeout(r, 1000)); // wait for write to finish
  
  const pdfBuffer = fs.readFileSync('test.pdf');
  const pdfArray = await pdf2img.convert(pdfBuffer, { base64: true, scale: 2.0 });
  
  console.log('PDF convert returned images:', pdfArray.length);
  if (pdfArray.length > 0) {
     const b64 = pdfArray[0];
     let str = typeof b64 === 'string' ? b64 : Buffer.from(b64).toString('base64');
     console.log('Base64 length:', str.length, 'starts with:', str.substring(0, 50));
  }
}
test().catch(console.error);
