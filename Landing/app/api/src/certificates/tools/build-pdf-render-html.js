const fs = require('fs');
const path = require('path');

const pdfPath = 'C:/Users/HP/Downloads/Group of schools logo.pdf';
const b64 = fs.readFileSync(pdfPath).toString('base64');

const html = `<!doctype html><html><body>
<script type="module">
import * as pdfjsLib from '/node_modules/pdfjs-dist/build/pdf.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = '/node_modules/pdfjs-dist/build/pdf.worker.mjs';
window.renderPdf = async function(pageNum) {
  const raw = atob('${b64}');
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
  const page = await doc.getPage(pageNum);
  const scale = 4;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;
  window.__result = canvas.toDataURL('image/png');
  window.__done = true;
};
</script>
</body></html>`;

fs.writeFileSync(path.join(__dirname, 'pdf-render.html'), html);
console.log('wrote html, b64 len:', b64.length);
