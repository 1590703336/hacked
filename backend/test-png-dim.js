const b64 = 'iVBORw0KGgoAAAANSUhEUgAABMgAAAYwCAYAAACHkHNSAAAABm';
const buf = Buffer.from(b64, 'base64');
const width = buf.readUInt32BE(16);
const height = buf.readUInt32BE(20);
console.log(`Dimensions: ${width}x${height}`);
