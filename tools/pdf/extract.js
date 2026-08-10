// Extract text from a PDF into a .txt file with page markers.
// Usage: node extract.js <input.pdf> <output.txt>
const fs = require('fs');
const pdf = require('pdf-parse');

let n = 0;
function render(pageData) {
  return pageData.getTextContent({ normalizeWhitespace: true }).then((tc) => {
    let lastY = null;
    let text = '';
    for (const item of tc.items) {
      if (lastY !== null && item.transform[5] !== lastY) text += '\n';
      text += item.str;
      lastY = item.transform[5];
    }
    n++;
    return `\n\n===== PAGE ${n} =====\n` + text;
  });
}

const input = process.argv[2];
const output = process.argv[3];
pdf(fs.readFileSync(input), { pagerender: render })
  .then((d) => {
    fs.writeFileSync(output, d.text, 'utf8');
    console.log('Extracted', d.numpages, 'pages,', d.text.length, 'chars ->', output);
  })
  .catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
