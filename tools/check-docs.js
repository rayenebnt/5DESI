// Quality gate for the design documents:
//  1. every ```mermaid block must parse (rendered with the same Mermaid version as the report),
//  2. every relative link must point to an existing file, and every #anchor to an existing heading (GitHub slugs).
// Usage: node check-docs.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    if (['node_modules', '.git', 'tools'].includes(f)) continue;
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (f.endsWith('.md')) out.push(p);
  }
  return out;
}

// GitHub heading slug algorithm (simplified but faithful for our content).
function slug(h) {
  return h
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[`*_~]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s/g, '-');
}

function headings(md) {
  const out = new Set();
  const counts = {};
  let inCode = false;
  for (const line of md.split('\n')) {
    if (/^```/.test(line)) inCode = !inCode;
    if (inCode) continue;
    const m = /^(#{1,6})\s+(.*)$/.exec(line);
    if (!m) continue;
    let s = slug(m[2].replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'));
    if (counts[s] != null) {
      counts[s] += 1;
      s = `${s}-${counts[s]}`;
    } else counts[s] = 0;
    out.add(s);
  }
  return out;
}

async function main() {
  const files = walk(ROOT);
  let errors = 0;
  const blocks = [];
  const heads = new Map(files.map((f) => [f, headings(fs.readFileSync(f, 'utf8'))]));

  for (const f of files) {
    const md = fs.readFileSync(f, 'utf8');
    const rel = path.relative(ROOT, f);
    // mermaid blocks
    const re = /```mermaid\n([\s\S]*?)```/g;
    let m;
    while ((m = re.exec(md))) blocks.push({ file: rel, code: m[1], line: md.slice(0, m.index).split('\n').length });
    // links (skip code blocks)
    const text = md.replace(/```[\s\S]*?```/g, '');
    const lre = /\[[^\]]*\]\(([^)\s]+)\)/g;
    while ((m = lre.exec(text))) {
      const target = m[1];
      if (/^(https?:|mailto:)/.test(target)) continue;
      const [p, anchor] = target.split('#');
      const dest = p ? path.resolve(path.dirname(f), decodeURIComponent(p)) : f;
      if (!fs.existsSync(dest)) {
        console.error(`[link] ${rel}: missing target ${target}`);
        errors++;
        continue;
      }
      if (anchor && dest.endsWith('.md')) {
        const hs = heads.get(dest) || headings(fs.readFileSync(dest, 'utf8'));
        if (!hs.has(anchor)) {
          console.error(`[anchor] ${rel}: #${anchor} not found in ${path.relative(ROOT, dest)}`);
          errors++;
        }
      }
    }
    // table rows with a pipe inside inline code break GitHub tables
    md.split('\n').forEach((line, i) => {
      if (/^\|/.test(line) && [...line.matchAll(/`([^`]*)`/g)].some((c) => c[1].includes('|'))) {
        console.error(`[table] ${rel}:${i + 1}: pipe inside inline code in a table row`);
        errors++;
      }
    });
  }

  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage();
  await page.setContent('<html><body></body></html>');
  await page.addScriptTag({ path: path.join(__dirname, 'node_modules/mermaid/dist/mermaid.min.js') });
  await page.evaluate(() => mermaid.initialize({ startOnLoad: false }));
  for (const [i, b] of blocks.entries()) {
    const res = await page.evaluate(async ({ code, i }) => {
      try {
        await mermaid.render(`m${i}`, code);
        return null;
      } catch (e) {
        return String(e && e.message ? e.message : e).slice(0, 300);
      }
    }, { code: b.code, i });
    if (res) {
      console.error(`[mermaid] ${b.file}:${b.line}: ${res}`);
      errors++;
    }
  }
  await browser.close();
  console.log(`${files.length} markdown files, ${blocks.length} mermaid diagrams checked, ${errors} error(s)`);
  process.exit(errors ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
