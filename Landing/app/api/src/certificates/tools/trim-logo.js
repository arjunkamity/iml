// Crops a PNG to its non-white content bounding box and makes near-white
// pixels transparent, using Playwright's headless Chromium canvas (avoids
// needing a native image-processing dependency like sharp/node-canvas).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const [, , inputFile, outputFile] = process.argv;
if (!inputFile || !outputFile) {
  console.error('Usage: node trim-logo.js <input.png> <output.png>');
  process.exit(1);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const b64 = fs.readFileSync(inputFile).toString('base64');

  const resultDataUrl = await page.evaluate(async (dataUrl) => {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = dataUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;
    const WHITE_THRESHOLD = 250;

    let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4;
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const isWhite = r >= WHITE_THRESHOLD && g >= WHITE_THRESHOLD && b >= WHITE_THRESHOLD;
        if (!isWhite) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
        // Make white transparent (and antialias near-white edges smoothly).
        if (isWhite) {
          d[i + 3] = 0;
        } else if (r > 235 && g > 235 && b > 235) {
          d[i + 3] = Math.round(255 * (1 - (r + g + b) / (3 * 255)));
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const pad = 6;
    const cropX = Math.max(0, minX - pad);
    const cropY = Math.max(0, minY - pad);
    const cropW = Math.min(canvas.width - cropX, maxX - minX + pad * 2);
    const cropH = Math.min(canvas.height - cropY, maxY - minY + pad * 2);

    const out = document.createElement('canvas');
    out.width = cropW;
    out.height = cropH;
    out.getContext('2d').drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    return out.toDataURL('image/png');
  }, `data:image/png;base64,${b64}`);

  const outBuf = Buffer.from(resultDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
  fs.writeFileSync(outputFile, outBuf);
  console.log('wrote', outputFile);
  await browser.close();
})();
