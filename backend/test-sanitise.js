const { sanitiseResponse } = require('./src/modules/ocr/ocr.service.js');
const raw1 = '```markdown\n# Hello\n```';
const raw2 = '# Hello No Fence';
console.log('Test 1:', sanitiseResponse(raw1));
console.log('Test 2:', sanitiseResponse(raw2));
