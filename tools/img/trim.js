// Trim fully-transparent padding around a PNG. Usage: node trim.js in.png out.png
const fs = require('fs');
const { PNG } = require('pngjs');
const png = PNG.sync.read(fs.readFileSync(process.argv[2]));
const { width, height, data } = png;
let minX = width, minY = height, maxX = 0, maxY = 0;
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * 4 + 3] > 12) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
}
const pad = 10;
minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
maxX = Math.min(width - 1, maxX + pad); maxY = Math.min(height - 1, maxY + pad);
const w = maxX - minX + 1, h = maxY - minY + 1;
const out = new PNG({ width: w, height: h });
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const si = ((y + minY) * width + (x + minX)) * 4;
    const di = (y * w + x) * 4;
    out.data[di] = data[si]; out.data[di + 1] = data[si + 1];
    out.data[di + 2] = data[si + 2]; out.data[di + 3] = data[si + 3];
  }
}
fs.writeFileSync(process.argv[3], PNG.sync.write(out));
console.log('trimmed', width + 'x' + height, '->', w + 'x' + h);
