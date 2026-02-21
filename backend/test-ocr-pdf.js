const fs = require('fs');
async function test() {
  const fileBuf = fs.readFileSync('/Users/huanzhang/code/hacked/api/package.json'); // We don't have a test PDF, let's use a dummy image with text
  // I need to generate a real image with text via node-canvas or just use the browser directly.
}
