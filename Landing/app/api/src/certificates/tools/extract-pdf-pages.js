const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '../../..'); // api project root, so node_modules resolves

const MIME = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript' };

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const filePath = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('not found: ' + filePath);
          return;
        }
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

(async () => {
  const server = await startServer();
  const port = server.address().port;
  const relHtml = '/src/certificates/assets/pdf-render.html';

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (msg) => errors.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => errors.push('pageerror: ' + String(err)));

  await page.goto(`http://127.0.0.1:${port}${relHtml}`);
  try {
    await page.waitForFunction(() => typeof window.renderPdf === 'function', { timeout: 10000 });
  } catch (e) {
    console.log('renderPdf never appeared. Console log:', errors.join('\n'));
    await browser.close();
    server.close();
    process.exit(1);
  }

  for (const [label, pageNum] of [['full-lockup', 1], ['emblem-only', 2]]) {
    await page.evaluate((n) => window.renderPdf(n), pageNum);
    await page.waitForFunction(() => window.__done === true, { timeout: 15000 });
    const dataUrl = await page.evaluate(() => window.__result);
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(path.join(__dirname, `amity-${label}.png`), Buffer.from(base64, 'base64'));
    console.log('saved amity-' + label + '.png');
    await page.evaluate(() => { window.__done = false; window.__result = null; });
  }

  if (errors.length) console.log('console log:', errors.join('\n'));
  await browser.close();
  server.close();
})();
