// Renders every diagram defined in ./diagrams/*.diagram.js to ../diagrams/<name>.svg and <name>.png (2x).
// Usage: node render-diagrams.js [name ...]
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'diagrams');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

function fontFaces() {
  const dir = path.join(__dirname, 'node_modules/@fontsource/inter/files');
  return [400, 500, 600, 700, 800]
    .map((w) => {
      const b64 = fs.readFileSync(path.join(dir, `inter-latin-${w}-normal.woff2`)).toString('base64');
      return `@font-face{font-family:'Inter';font-style:normal;font-weight:${w};src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
    })
    .join('\n');
}

async function main() {
  const only = process.argv.slice(2);
  const files = fs.readdirSync(path.join(__dirname, 'diagrams')).filter((f) => f.endsWith('.diagram.js'));
  const diagrams = files.map((f) => require(path.join(__dirname, 'diagrams', f))).filter((d) => !only.length || only.includes(d.name));
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({ executablePath: CHROME });
  const context = await browser.newContext({ deviceScaleFactor: 2 });
  const page = await context.newPage();
  const css = fontFaces();
  let problems = 0;

  for (const d of diagrams) {
    const svg = d.build();
    fs.writeFileSync(path.join(OUT, `${d.name}.svg`), svg);
    await page.setViewportSize({ width: d.width, height: d.height });
    await page.setContent(`<!doctype html><html><head><style>${css} html,body{margin:0;padding:0;background:#fff}</style></head><body>${svg.replace(/^<\?xml[^>]*>\s*/, '')}</body></html>`);
    await page.evaluate(() => document.fonts.ready);
    // Flag any text line wider than the box it was written for.
    const overflows = await page.evaluate(() =>
      [...document.querySelectorAll('text[data-maxw]')]
        .map((t) => ({ t: t.textContent, w: t.getComputedTextLength(), max: parseFloat(t.getAttribute('data-maxw')) }))
        .filter((o) => o.w > o.max + 0.5)
    );
    overflows.forEach((o) => console.warn(`  [overflow] ${d.name}: "${o.t}" ${o.w.toFixed(1)} > ${o.max}`));
    problems += overflows.length;
    const el = await page.$('svg');
    await el.screenshot({ path: path.join(OUT, `${d.name}.png`) });
    console.log(`rendered ${d.name} (${d.width}x${d.height})`);
  }
  await browser.close();
  if (problems) console.warn(`${problems} text overflow(s) detected`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
