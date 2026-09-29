// Builds the consolidated design report from docs/*.md:
//   report/MedX-Technical-Design-Report.html  (standalone page, opens offline)
//   report/MedX-Technical-Design-Report.pdf   (A4, printed with Chromium; large diagrams on landscape pages)
//   <scratch>/medx-report-artifact.html       (same page as an Artifact fragment, links pointing to GitHub)
// Diagrams are inlined as SVG and Mermaid blocks are pre-rendered, so the page has no runtime dependency.
// Usage: node build-report.js [--artifact-out <path>]
const fs = require('fs');
const path = require('path');
const { Marked } = require('marked');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'report');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const GH = 'https://github.com/rayenebnt/5DESI/blob/claude/relaxed-archimedes-tks3i0';
const artifactIdx = process.argv.indexOf('--artifact-out');
const ARTIFACT_OUT = artifactIdx > 0 ? process.argv[artifactIdx + 1] : null;

const DOCS = [
  ['d00', 'docs/00-context-and-assumptions.md', 'Context & targets'],
  ['d01', 'docs/01-high-level-architecture.md', 'High-level architecture'],
  ['d02', 'docs/02-component-design/README.md', 'Component designs'],
  ['d02-01', 'docs/02-component-design/01-user-management.md', 'User Management'],
  ['d02-02', 'docs/02-component-design/02-scheduling.md', 'Scheduling'],
  ['d02-03', 'docs/02-component-design/03-consultation.md', 'Consultation'],
  ['d02-04', 'docs/02-component-design/04-patient-records.md', 'Patient Records & Emergency Access'],
  ['d02-05', 'docs/02-component-design/05-prescription.md', 'Prescription'],
  ['d02-06', 'docs/02-component-design/06-pharmacy-interface.md', 'Pharmacy Interface'],
  ['d02-07', 'docs/02-component-design/07-notification.md', 'Notification'],
  ['d02-08', 'docs/02-component-design/08-billing-payment.md', 'Billing & Payment'],
  ['d02-09', 'docs/02-component-design/09-platform-components.md', 'Platform components'],
  ['d03', 'docs/03-data-model-and-storage.md', 'Data model & storage'],
  ['d04', 'docs/04-scalability-and-performance.md', 'Scalability & performance'],
  ['d05', 'docs/05-security-and-compliance.md', 'Security & compliance'],
  ['d06', 'docs/06-architecture-decisions.md', 'Decisions & trade-offs'],
  ['d07', 'docs/07-requirements-traceability.md', 'Traceability matrix'],
  ['d08', 'docs/08-roadmap-and-risks.md', 'Roadmap & risks'],
].map(([key, file, short]) => ({ key, file, short, abs: path.join(ROOT, file) }));
const byAbs = new Map(DOCS.map((d) => [d.abs, d]));

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// GitHub-compatible heading slugs (same algorithm as check-docs.js).
function slug(h) {
  return h.trim().toLowerCase().replace(/<[^>]+>/g, '').replace(/[`*_~]/g, '').replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s/g, '-');
}

function font(pkg, file, family, weight, style = 'normal') {
  const b64 = fs.readFileSync(path.join(__dirname, 'node_modules/@fontsource', pkg, 'files', file)).toString('base64');
  return `@font-face{font-family:'${family}';font-style:${style};font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
}
const FONTS = [
  font('atkinson-hyperlegible-next', 'atkinson-hyperlegible-next-latin-400-normal.woff2', 'Atkinson Hyperlegible Next', 400),
  font('atkinson-hyperlegible-next', 'atkinson-hyperlegible-next-latin-700-normal.woff2', 'Atkinson Hyperlegible Next', 700),
  font('atkinson-hyperlegible-next', 'atkinson-hyperlegible-next-latin-400-italic.woff2', 'Atkinson Hyperlegible Next', 400, 'italic'),
  font('bricolage-grotesque', 'bricolage-grotesque-latin-700-normal.woff2', 'Bricolage Grotesque', 700),
  font('bricolage-grotesque', 'bricolage-grotesque-latin-800-normal.woff2', 'Bricolage Grotesque', 800),
  font('atkinson-hyperlegible-mono', 'atkinson-hyperlegible-mono-latin-400-normal.woff2', 'Atkinson Hyperlegible Mono', 400),
  font('atkinson-hyperlegible-mono', 'atkinson-hyperlegible-mono-latin-600-normal.woff2', 'Atkinson Hyperlegible Mono', 600),
  ...[400, 500, 600, 700, 800].map((w) => font('inter', `inter-latin-${w}-normal.woff2`, 'Inter', w)),
].join('\n');

// Inline one of our SVG diagrams with ids prefixed (several SVGs share one document).
const svgCache = new Map();
function inlineSvg(name, instance) {
  const file = path.join(ROOT, 'diagrams', `${name}.svg`);
  if (!svgCache.has(name)) svgCache.set(name, fs.readFileSync(file, 'utf8').replace(/^<\?xml[^>]*>\s*/, ''));
  const p = `${name}-${instance}-`;
  return svgCache
    .get(name)
    .replace(/\sid="([^"]+)"/g, (m, id) => ` id="${p}${id}"`)
    .replace(/url\(#([^)]+)\)/g, (m, id) => `url(#${p}${id})`)
    .replace(/<svg ([^>]*?)width="\d+" height="\d+"/, '<svg $1class="svg-diagram" preserveAspectRatio="xMidYMid meet"');
}

let figureCount = 0;
function figure(name, alt) {
  figureCount += 1;
  return `<figure class="diagram figure-wide" id="fig-${name}-${figureCount}"><div class="paper">${inlineSvg(name, figureCount)}</div><figcaption>${esc(alt)}</figcaption></figure>`;
}

function convertDoc(doc, variant, mermaidBlocks) {
  let md = fs.readFileSync(doc.abs, 'utf8');
  // Stand-alone diagram images become figures with the vector diagram inlined.
  md = md.replace(/^!\[([^\]]*)\]\((?:\.\.\/)+diagrams\/([\w-]+)\.(?:png|svg)\)[ \t]*$/gm, (m, alt, name) => `\n<div data-diagram="${name}" data-alt="${esc(alt)}"></div>\n`);
  const counts = {};
  let firstH1 = true;
  const m = new Marked();
  m.use({
    gfm: true,
    renderer: {
      heading({ tokens, depth, text }) {
        let s = slug(text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'));
        if (counts[s] != null) {
          counts[s] += 1;
          s = `${s}-${counts[s]}`;
        } else counts[s] = 0;
        const inner = this.parser.parseInline(tokens);
        if (depth === 1 && firstH1) {
          firstH1 = false;
          return `<h1 id="${doc.key}"><span class="anchor-alias" id="${doc.key}--${s}"></span>${inner}</h1>\n`;
        }
        return `<h${depth} id="${doc.key}--${s}">${inner}</h${depth}>\n`;
      },
      link({ href, tokens }) {
        const label = this.parser.parseInline(tokens);
        if (/^(https?:|mailto:)/.test(href)) return `<a href="${esc(href)}" target="_blank" rel="noopener">${label}</a>`;
        if (href.startsWith('#')) return `<a href="#${doc.key}--${esc(href.slice(1))}">${label}</a>`;
        const [p, anchor] = href.split('#');
        const abs = path.resolve(path.dirname(doc.abs), decodeURIComponent(p));
        const target = byAbs.get(abs);
        if (target) return `<a href="#${anchor ? `${target.key}--${esc(anchor)}` : target.key}">${label}</a>`;
        const rel = path.relative(ROOT, abs).split(path.sep).join('/');
        const url = variant === 'repo' ? path.relative(OUT, abs).split(path.sep).join('/') + (fs.existsSync(abs) && fs.statSync(abs).isDirectory() ? '/' : '') : `${GH}/${rel}`;
        return `<a href="${esc(url)}" target="_blank" rel="noopener">${label}</a>`;
      },
      code({ text, lang }) {
        if (lang === 'mermaid') {
          mermaidBlocks.push(text);
          return `<figure class="diagram mermaid-fig"><div class="paper">@@MERMAID_${mermaidBlocks.length - 1}@@</div></figure>\n`;
        }
        return `<pre class="code"><code class="lang-${esc(lang || 'text')}">${esc(text)}</code></pre>\n`;
      },
      table(token) {
        return `<div class="table-wrap">${defaultTable.call(this, token)}</div>\n`;
      },
    },
  });
  let html = m.parse(md);
  html = html.replace(/<div data-diagram="([\w-]+)" data-alt="([^"]*)"><\/div>/g, (x, name, alt) => figure(name, alt.replace(/&amp;/g, '&').replace(/&quot;/g, '"')));
  return html;
}

// marked's built-in table renderer, reused inside our wrapper.
const { Renderer } = require('marked');
const defaultTable = Renderer.prototype.table;

async function renderMermaid(blocks) {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  await page.setContent(`<!doctype html><html><head><style>${FONTS}</style></head><body></body></html>`);
  await page.evaluate(async () => {
    await document.fonts.load('16px "Atkinson Hyperlegible Next"');
    await document.fonts.load('bold 16px "Atkinson Hyperlegible Next"');
  });
  await page.addScriptTag({ path: path.join(__dirname, 'node_modules/mermaid/dist/mermaid.min.js') });
  const svgs = await page.evaluate(async (codes) => {
    const ff = "'Atkinson Hyperlegible Next', Arial, sans-serif";
    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      securityLevel: 'strict',
      fontFamily: ff,
      themeVariables: {
        fontFamily: ff, fontSize: '15px',
        primaryColor: '#E7F5F3', primaryBorderColor: '#0E7C7B', primaryTextColor: '#0F172A',
        secondaryColor: '#EEEFFB', secondaryBorderColor: '#4B4FA6', tertiaryColor: '#F1F5F9', tertiaryBorderColor: '#94A3B8',
        lineColor: '#334155', textColor: '#0F172A', mainBkg: '#E7F5F3', nodeBorder: '#0E7C7B', clusterBkg: '#F5F9FA', clusterBorder: '#94A3B8',
        actorBkg: '#E7F5F3', actorBorder: '#0E7C7B', actorTextColor: '#0F172A', actorLineColor: '#94A3B8',
        signalColor: '#334155', signalTextColor: '#0F172A', sequenceNumberColor: '#FFFFFF',
        noteBkgColor: '#FFF5E3', noteBorderColor: '#E0B45A', noteTextColor: '#3B2A05',
        labelBoxBkgColor: '#F1F5F9', labelBoxBorderColor: '#94A3B8', labelTextColor: '#0F172A', loopTextColor: '#0F172A',
        activationBkgColor: '#FDEDE8', activationBorderColor: '#E4572E',
        sectionBkgColor: '#F1F5F9', altSectionBkgColor: '#FFFFFF', sectionBkgColor2: '#EAF3FA',
        taskBkgColor: '#0E7C7B', taskBorderColor: '#0B3B4A', taskTextColor: '#FFFFFF', taskTextOutsideColor: '#0F172A', taskTextLightColor: '#FFFFFF',
        activeTaskBkgColor: '#E4572E', activeTaskBorderColor: '#8C2A10', gridColor: '#CBD5E1', doneTaskBkgColor: '#94A3B8', critBkgColor: '#E4572E', critBorderColor: '#8C2A10', todayLineColor: 'transparent',
        attributeBackgroundColorOdd: '#FFFFFF', attributeBackgroundColorEven: '#F5F9FA',
      },
      sequence: { useMaxWidth: true, mirrorActors: false, actorMargin: 36, messageFontSize: 14, noteFontSize: 13 },
      flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
      er: { useMaxWidth: true },
      state: { useMaxWidth: true },
      gantt: { useMaxWidth: true, barHeight: 22, fontSize: 12, sectionFontSize: 13, leftPadding: 250 },
    });
    const out = [];
    for (let i = 0; i < codes.length; i++) {
      const { svg } = await mermaid.render(`mmd-${i}`, codes[i]);
      out.push(svg);
    }
    return out;
  }, blocks);
  await browser.close();
  return svgs;
}

function tocHtml() {
  const items = DOCS.map((d) => {
    const md = fs.readFileSync(d.abs, 'utf8');
    const h1 = (/^#\s+(.+)$/m.exec(md) || [null, d.short])[1];
    const num = (/^([\d.]+)/.exec(h1) || [null, ''])[1];
    const sub = d.key.startsWith('d02-');
    return `<li class="${sub ? 'sub' : 'top'}"><a href="#${d.key}"><span class="num">${esc(num.replace(/\.$/, ''))}</span><span>${esc(d.short)}</span></a></li>`;
  });
  return `<ol class="toc-list">${items.join('')}</ol>`;
}

function page(variant, body, mermaidSvgs) {
  const deliverableLink = (label, n, href, ext = false) => `<a class="deliverable" href="${href}"${ext ? ' target="_blank" rel="noopener"' : ''}><span class="dnum">${n}</span><span class="dlabel">${label}</span></a>`;
  const pres = variant === 'repo' ? '../presentation/MedX-Technical-Solution.pdf' : `${GH}/presentation/MedX-Technical-Solution.pptx`;
  const hero = `
<header class="hero">
  <p class="eyebrow">5DESI mini-project · architecture dossier</p>
  <h1 class="hero-title">MedX Technical Solution Design</h1>
  <p class="lede">The technical design of MedX, a platform for teleconsultations, lifelong patient records and prescription tracking.
  Every choice follows MedX's own priorities: health data is protected at rest and in transit, records cannot be silently rewritten,
  and authorised professionals reach critical information in seconds during an emergency.</p>
  <nav class="deliverables" aria-label="Deliverables">
    ${deliverableLink('High-level architecture', '1', '#d01')}
    ${deliverableLink('Detailed component designs', '2', '#d02')}
    ${deliverableLink('Data model & storage strategy', '3', '#d03')}
    ${deliverableLink('Scalability & performance', '4', '#d04')}
    ${deliverableLink('Security & compliance', '5', '#d05')}
    ${deliverableLink('Presentation (slides & script)', '6', pres, true)}
  </nav>
  <dl class="facts">
    <div><dt>Style</dt><dd>8 microservices in security zones, event-driven, zero trust</dd></div>
    <div><dt>Emergency access</dt><dd>Break-glass, 99.99 %, critical summary p95 &lt; 300 ms</dd></div>
    <div><dt>Encryption</dt><dd>TLS 1.3 / mTLS everywhere, per-patient keys in HSM-backed KMS</dd></div>
    <div><dt>Scale target</dt><dd>10 M patients, 200 k consultations/day, 10 k concurrent calls</dd></div>
  </dl>
  <figure class="diagram hero-figure"><div class="paper">${inlineSvg('medx-high-level-architecture', 'hero')}</div>
  <figcaption>High-level architecture. ①–⑧ are the components of Appendix 1; H / M / L are MedX priorities.</figcaption></figure>
</header>`;
  const toc = tocHtml();
  let content = body.replace(/@@MERMAID_(\d+)@@/g, (m, i) => mermaidSvgs[Number(i)]);
  const title = 'MedX Technical Design';
  const style = `<style>
/* Layout: clinical dossier — contents rail on the left, one reading column (~74ch), diagrams on light "paper" panels that span the column. */
:root {
  --bg: #FFFFFF; --surface: #F3F7F8; --surface-2: #E8F1F2; --ink: #0F172A; --text: #1F2A37; --muted: #516170;
  --line: #D5E0E3; --brand: #0B3B4A; --accent: #0E7C7B; --accent-ink: #0A6463; --high: #B8401C; --medium: #8A5A00;
  --code-bg: #F3F6F8; --paper: #FFFFFF; --paper-line: #D5E0E3; --focus: #E4572E;
  --font-body: 'Atkinson Hyperlegible Next', 'Segoe UI', Arial, sans-serif;
  --font-display: 'Bricolage Grotesque', 'Atkinson Hyperlegible Next', Arial, sans-serif;
  --font-mono: 'Atkinson Hyperlegible Mono', ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #0D1A1F; --surface: #13262D; --surface-2: #183039; --ink: #EAF2F4; --text: #D5E2E6; --muted: #9DB2B9;
  --line: #27434C; --brand: #9FD8D3; --accent: #5FC2BB; --accent-ink: #7FD3CC; --high: #F39473; --medium: #EDC36B;
  --code-bg: #10222A; --paper: #F7FAFB; --paper-line: #27434C; --focus: #F39473; color-scheme: dark;
} }
:root[data-theme="dark"] {
  --bg: #0D1A1F; --surface: #13262D; --surface-2: #183039; --ink: #EAF2F4; --text: #D5E2E6; --muted: #9DB2B9;
  --line: #27434C; --brand: #9FD8D3; --accent: #5FC2BB; --accent-ink: #7FD3CC; --high: #F39473; --medium: #EDC36B;
  --code-bg: #10222A; --paper: #F7FAFB; --paper-line: #27434C; --focus: #F39473; color-scheme: dark;
}
${FONTS}
*, *::before, *::after { box-sizing: border-box; }
html { scroll-behavior: smooth; }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
body { margin: 0; background: var(--bg); color: var(--text); font-family: var(--font-body); font-size: 17px; line-height: 1.6; -webkit-text-size-adjust: 100%; }
a { color: var(--accent-ink); text-underline-offset: 2px; text-decoration-thickness: 1px; }
a:hover { text-decoration-thickness: 2px; }
:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; border-radius: 4px; }
.shell { display: grid; grid-template-columns: 17rem minmax(0, 1fr); gap: 3rem; max-width: 84rem; margin: 0 auto; padding-inline: 24px; }
.rail { position: sticky; top: env(safe-area-inset-top, 0px); align-self: start; max-height: 100vh; overflow-y: auto; padding-block: 2rem; font-size: 14.5px; }
.rail-title { font-family: var(--font-display); font-weight: 800; color: var(--brand); font-size: 1.05rem; margin: 0 0 0.25rem; }
.rail-sub { color: var(--muted); margin: 0 0 1.25rem; font-size: 13px; }
.toc-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
.toc-list a { display: grid; grid-template-columns: 2.4rem 1fr; gap: 0.25rem; padding: 0.3rem 0.5rem; border-radius: 6px; color: var(--text); text-decoration: none; line-height: 1.35; }
.toc-list a:hover { background: var(--surface); }
.toc-list a[aria-current="true"] { background: var(--surface-2); color: var(--ink); font-weight: 700; }
.toc-list .num { color: var(--muted); font-variant-numeric: tabular-nums; }
.toc-list li.sub a { padding-left: 1.4rem; grid-template-columns: 2.4rem 1fr; font-size: 13.5px; }
.toc-mobile { display: none; margin: 1rem 0 0; border: 1px solid var(--line); border-radius: 10px; padding: 0.6rem 0.9rem; background: var(--surface); }
.toc-mobile summary { cursor: pointer; font-weight: 700; color: var(--ink); }
.toc-mobile .toc-list { margin-top: 0.6rem; }
.main { min-width: 0; padding-block: 2rem 4rem; }
.hero { padding-block: 1rem 2.5rem; border-bottom: 1px solid var(--line); }
.eyebrow { text-transform: uppercase; letter-spacing: 0.12em; font-size: 13px; font-weight: 700; color: var(--accent-ink); margin: 0 0 0.6rem; }
.hero-title { font-family: var(--font-display); font-weight: 800; font-size: clamp(2.1rem, 4.6vw, 3.4rem); line-height: 1.05; color: var(--ink); margin: 0 0 1rem; text-wrap: balance; letter-spacing: -0.01em; }
.lede { font-size: 1.12rem; max-width: 70ch; color: var(--text); margin: 0 0 1.6rem; }
.deliverables { display: grid; grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); gap: 0.6rem; margin: 0 0 1.6rem; }
.deliverable { display: flex; align-items: center; gap: 0.75rem; padding: 0.7rem 0.9rem; border: 1px solid var(--line); border-radius: 10px; text-decoration: none; color: var(--ink); background: var(--bg); }
.deliverable:hover { border-color: var(--accent); background: var(--surface); }
.dnum { display: inline-grid; place-items: center; width: 1.9rem; height: 1.9rem; border-radius: 50%; background: var(--brand); color: var(--bg); font-weight: 700; font-variant-numeric: tabular-nums; flex: none; }
.dlabel { font-weight: 700; line-height: 1.3; }
.facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); gap: 0.2rem 1.5rem; margin: 0 0 1.8rem; }
.facts div { padding-block: 0.55rem; border-top: 1px solid var(--line); }
.facts dt { text-transform: uppercase; letter-spacing: 0.08em; font-size: 12.5px; color: var(--muted); font-weight: 700; }
.facts dd { margin: 0.15rem 0 0; color: var(--ink); }
.doc { padding-block: 2.5rem 1rem; border-bottom: 1px solid var(--line); }
.doc > * { max-width: 74ch; }
.doc > .table-wrap, .doc > figure, .doc > pre { max-width: none; }
h1, h2, h3, h4 { color: var(--ink); text-wrap: balance; scroll-margin-top: 1rem; }
.doc h1 { font-family: var(--font-display); font-weight: 800; font-size: clamp(1.75rem, 3.2vw, 2.4rem); line-height: 1.1; margin: 0 0 1rem; letter-spacing: -0.005em; }
.doc h2 { font-family: var(--font-display); font-weight: 700; font-size: 1.5rem; line-height: 1.2; margin: 2.4rem 0 0.8rem; }
.doc h3 { font-size: 1.18rem; margin: 1.8rem 0 0.6rem; }
.doc h4 { font-size: 1.02rem; margin: 1.4rem 0 0.5rem; }
.anchor-alias { position: relative; top: -1rem; }
p, ul, ol { margin: 0 0 1rem; }
li + li { margin-top: 0.25rem; }
blockquote { margin: 0 0 1.4rem; padding: 0.8rem 1.1rem; background: var(--surface); border-radius: 10px; color: var(--text); }
blockquote p:last-child { margin-bottom: 0; }
strong { color: var(--ink); }
code { font-family: var(--font-mono); font-size: 0.88em; background: var(--code-bg); padding: 0.1em 0.35em; border-radius: 5px; }
pre.code { background: var(--code-bg); border: 1px solid var(--line); border-radius: 10px; padding: 1rem 1.1rem; overflow-x: auto; line-height: 1.5; font-size: 14px; margin: 0 0 1.4rem; }
pre.code code { background: none; padding: 0; font-size: inherit; }
.table-wrap { overflow-x: auto; margin: 0 0 1.6rem; border: 1px solid var(--line); border-radius: 10px; }
table { border-collapse: collapse; width: 100%; font-size: 15px; line-height: 1.45; font-variant-numeric: tabular-nums; }
th, td { text-align: left; vertical-align: top; padding: 0.55rem 0.75rem; border-bottom: 1px solid var(--line); }
th { background: var(--surface); color: var(--ink); font-weight: 700; white-space: nowrap; }
tbody tr:last-child td { border-bottom: none; }
td[align="center"], th[align="center"] { text-align: center; }
figure.diagram { margin: 0 0 1.8rem; }
.paper { background: var(--paper); border: 1px solid var(--paper-line); border-radius: 12px; padding: 0.75rem; overflow-x: auto; }
.paper svg { display: block; margin: 0 auto; max-width: 100%; height: auto; }
.paper .svg-diagram { width: 100%; min-width: 760px; height: auto; }
.mermaid-fig .paper svg { min-width: 0; }
figcaption { color: var(--muted); font-size: 14px; margin-top: 0.5rem; }
.hero-figure { margin-top: 0.5rem; }
.report-footer { color: var(--muted); font-size: 14px; padding-block: 2rem; }
.toc-print { display: none; }
@media (max-width: 1000px) {
  .shell { grid-template-columns: minmax(0, 1fr); gap: 0; padding-inline: 16px; }
  .rail { display: none; }
  .toc-mobile { display: block; }
  body { font-size: 16px; }
}
@page { size: A4; margin: 16mm 14mm 18mm 14mm; }
@page wide { size: A4 landscape; margin: 10mm 10mm 14mm 10mm; }
@media print {
  :root { --bg: #FFFFFF; --surface: #F3F7F8; --surface-2: #E8F1F2; --ink: #0F172A; --text: #1F2A37; --muted: #516170; --line: #D5E0E3; --brand: #0B3B4A; --accent: #0E7C7B; --accent-ink: #0A6463; --code-bg: #F3F6F8; --paper: #FFFFFF; color-scheme: light; }
  body { font-size: 10pt; line-height: 1.45; }
  .shell { display: block; max-width: none; padding: 0; }
  .rail, .toc-mobile, .hero-figure { display: none; }
  .main { padding: 0; }
  .hero { border: none; padding-top: 30mm; break-after: page; }
  .hero-title { font-size: 34pt; }
  .toc-print { display: block; break-after: page; }
  .toc-print h2 { font-family: var(--font-display); font-size: 18pt; margin: 0 0 6mm; color: var(--ink); }
  .toc-print .toc-list a { color: var(--text); padding: 1.2mm 0; }
  .doc { break-before: page; border: none; padding-top: 0; }
  .doc > * { max-width: none; }
  .doc h1 { font-size: 20pt; }
  .doc h2 { font-size: 14pt; margin-top: 7mm; }
  .doc h3 { font-size: 11.5pt; }
  h1, h2, h3, h4 { break-after: avoid; }
  pre.code, blockquote, tr, figure.mermaid-fig { break-inside: avoid; }
  .table-wrap { overflow: visible; border-radius: 6px; }
  table { font-size: 8pt; }
  th { white-space: normal; }
  th, td { padding: 1.2mm 1.8mm; }
  pre.code { font-size: 8pt; overflow: visible; white-space: pre-wrap; }
  a { color: inherit; text-decoration: none; }
  .paper { border: none; padding: 0; overflow: visible; }
  .paper .svg-diagram { min-width: 0; }
  figure.figure-wide { page: wide; break-before: page; break-after: page; margin: 0; }
  figure.figure-wide .svg-diagram { max-height: 176mm; width: auto; max-width: 100%; }
  figure.mermaid-fig svg { max-height: 235mm; }
  .report-footer { display: none; }
}
</style>`;
  const script = `<script>
(() => {
  const links = [...document.querySelectorAll('.rail .toc-list a')];
  const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
  if (!('IntersectionObserver' in window) || !links.length) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      links.forEach((a) => a.removeAttribute('aria-current'));
      const a = map.get(e.target.id.replace(/^sec-/, ''));
      if (a) a.setAttribute('aria-current', 'true');
    });
  }, { rootMargin: '0px 0px -75% 0px' });
  document.querySelectorAll('section.doc').forEach((s) => io.observe(s));
})();
</script>`;
  const bodyHtml = `<div class="shell">
<nav class="rail" aria-label="Contents"><p class="rail-title">MedX design</p><p class="rail-sub">5DESI · technical solution</p>${toc}</nav>
<main class="main">
${hero}
<details class="toc-mobile"><summary>Contents</summary>${toc}</details>
<section class="toc-print"><h2>Contents</h2>${toc}</section>
${content}
<footer class="report-footer">MedX Technical Solution Design · 5DESI mini-project · generated from the Markdown sources in <code>docs/</code>.</footer>
</main>
</div>
${script}`;
  return { title, style, bodyHtml };
}

async function main() {
  const variants = ['repo'].concat(ARTIFACT_OUT ? ['artifact'] : []);
  fs.mkdirSync(OUT, { recursive: true });
  for (const variant of variants) {
    figureCount = 0;
    const mermaidBlocks = [];
    // Section wrappers use a "sec-" prefix so they never collide with the h1 ids that links target.
    const body = DOCS.map((d) => `<section class="doc" id="sec-${d.key}">\n${convertDoc(d, variant, mermaidBlocks)}</section>`).join('\n');
    const svgs = await renderMermaid(mermaidBlocks);
    const { title, style, bodyHtml } = page(variant, body, svgs);
    if (variant === 'repo') {
      const full = `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<title>${title}</title>\n${style}\n</head>\n<body>\n${bodyHtml}\n</body>\n</html>\n`;
      const htmlPath = path.join(OUT, 'MedX-Technical-Design-Report.html');
      fs.writeFileSync(htmlPath, full);
      console.log(`written ${htmlPath} (${(full.length / 1024 / 1024).toFixed(2)} MB, ${mermaidBlocks.length} mermaid, ${figureCount} figures)`);
      const browser = await chromium.launch({ executablePath: CHROME });
      const pg = await browser.newPage();
      await pg.goto(`file://${htmlPath}`, { waitUntil: 'load' });
      await pg.evaluate(() => document.fonts.ready);
      await pg.emulateMedia({ media: 'print' });
      const pdfPath = path.join(OUT, 'MedX-Technical-Design-Report.pdf');
      await pg.pdf({
        path: pdfPath,
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: '<div style="font-family:Arial,sans-serif;font-size:7.5px;color:#64748B;width:100%;padding:0 12mm;display:flex;justify-content:space-between;"><span>MedX — Technical Solution Design</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
      });
      await browser.close();
      console.log(`written ${pdfPath}`);
    } else {
      const fragment = `<title>${title}</title>\n${style}\n${bodyHtml}\n`;
      fs.writeFileSync(ARTIFACT_OUT, fragment);
      console.log(`written ${ARTIFACT_OUT} (${(fragment.length / 1024 / 1024).toFixed(2)} MB)`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
