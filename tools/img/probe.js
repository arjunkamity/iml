const fs = require('fs');
const { PNG } = require('pngjs');
const png = PNG.sync.read(fs.readFileSync(process.argv[2]));
const { width, height, data } = png;
let minA = 255, transparentPixels = 0;
for (let i = 3; i < data.length; i += 4) {
  if (data[i] < minA) minA = data[i];
  if (data[i] < 250) transparentPixels++;
}
const corner = [data[0], data[1], data[2], data[3]];
console.log(JSON.stringify({ width, height, cornerRGBA: corner, minAlpha: minA, semiTransparentPixels: transparentPixels }));
