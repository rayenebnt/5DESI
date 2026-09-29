// Petite boîte à outils SVG utilisée pour dessiner les diagrammes d'architecture de MedX.
// Chaque diagramme est du SVG pur : il peut être versionné, comparé et régénéré (voir ../render-diagrams.js).

const FONT = "Inter, 'Liberation Sans', Arial, Helvetica, sans-serif";

const C = {
  ink: '#0F172A',
  text: '#1E293B',
  muted: '#475569',
  faint: '#64748B',
  line: '#334155',
  white: '#FFFFFF',
  petrol: '#0B3B4A',
  petrol2: '#12505F',
  teal: '#0E7C7B',
  tealBg: '#E7F5F3',
  tealLine: '#8CCFC7',
  indigo: '#4B4FA6',
  indigoBg: '#EEEFFB',
  indigoLine: '#AEB1E6',
  coral: '#E4572E',
  coralBg: '#FDEDE8',
  amber: '#D48A1A',
  amberBg: '#FFF5E3',
  amberLine: '#F0C987',
  sky: '#2F7FB8',
  skyBg: '#EAF3FA',
  skyLine: '#A9CDE8',
  slate: '#64748B',
  slateBg: '#F1F5F9',
  slateLine: '#CBD5E1',
  green: '#2E8B57',
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function defs() {
  const marker = (id, color) => `
    <marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="${color}"/>
    </marker>`;
  return `<defs>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="1.5" stdDeviation="2" flood-color="#0F172A" flood-opacity="0.10"/>
    </filter>
    ${marker('arr-ink', C.line)}
    ${marker('arr-teal', C.teal)}
    ${marker('arr-indigo', C.indigo)}
    ${marker('arr-coral', C.coral)}
    ${marker('arr-amber', C.amber)}
    ${marker('arr-sky', C.sky)}
    ${marker('arr-slate', C.slate)}
    ${marker('arr-petrol', C.petrol)}
    ${marker('arr-white', '#FFFFFF')}
  </defs>`;
}

function svgDoc({ width, height, body, title, bg = C.white }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONT}" role="img" aria-label="${esc(title)}">
  <title>${esc(title)}</title>
  ${defs()}
  <rect x="0" y="0" width="${width}" height="${height}" fill="${bg}"/>
  ${body}
</svg>
`;
}

function rect({ x, y, w, h, r = 10, fill = C.white, stroke = C.slateLine, sw = 1.5, dash = null, shadow = false, opacity = 1 }) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ''}${shadow ? ' filter="url(#shadow)"' : ''}${opacity !== 1 ? ` opacity="${opacity}"` : ''}/>`;
}

// Multi-line text. `lines` items are strings or {t, size, weight, fill, italic}.
// data-maxw lets the renderer flag any line wider than its container.
function text({ x, y, lines, size = 14, weight = 400, fill = C.text, anchor = 'start', lh = 1.3, maxw = null, italic = false }) {
  const arr = Array.isArray(lines) ? lines : [lines];
  let out = '';
  let cy = y;
  arr.forEach((ln, i) => {
    const o = typeof ln === 'string' ? { t: ln } : ln;
    const s = o.size || size;
    if (i > 0) cy += (o.gap != null ? o.gap : 0) + s * lh;
    out += `<text x="${x}" y="${cy}" font-size="${s}" font-weight="${o.weight || weight}" fill="${o.fill || fill}" text-anchor="${anchor}"${o.italic || italic ? ' font-style="italic"' : ''}${maxw ? ` data-maxw="${maxw}"` : ''}>${esc(o.t)}</text>`;
  });
  return out;
}

function badge({ x, y, label, fill, color = C.white, w = null, h = 20, size = 11.5, weight = 700, r = 10 }) {
  const width = w || Math.max(h, label.length * size * 0.62 + 12);
  return `<g>${rect({ x, y, w: width, h, r, fill, stroke: fill, sw: 1 })}<text x="${x + width / 2}" y="${y + h / 2 + size * 0.36}" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="middle">${esc(label)}</text></g>`;
}

const PRIORITY = {
  H: { label: 'HAUTE', fill: C.coral, color: C.white },
  M: { label: 'MOYENNE', fill: '#F2B544', color: '#3B2A05' },
  B: { label: 'BASSE', fill: '#94A3B8', color: C.white },
};

function priorityBadge(xRight, y, p) {
  // Pastille circulaire compacte (H / M / B) ancrée par son bord droit.
  const b = PRIORITY[p];
  const r = 10.5;
  const cx = xRight - r;
  const cy = y + r;
  return `<g><circle cx="${cx}" cy="${cy}" r="${r}" fill="${b.fill}"/><text x="${cx}" y="${cy + 4.2}" font-size="11.5" font-weight="800" fill="${b.color}" text-anchor="middle">${p}</text></g>`;
}

// A service/component box: title + subtitle lines + optional priority badge + optional number bubble.
function box({ x, y, w, h, title, sub = [], fill = C.white, stroke = C.slateLine, sw = 1.5, titleSize = 16, subSize = 12.5, num = null, numFill = C.petrol, priority = null, titleFill = C.ink, subFill = C.muted, dash = null, shadow = true, pad = 14, r = 10 }) {
  let out = rect({ x, y, w, h, r, fill, stroke, sw, dash, shadow });
  let tx = x + pad;
  if (num != null) {
    out += `<circle cx="${x + pad + 11}" cy="${y + pad + 10}" r="11" fill="${numFill}"/>`;
    out += `<text x="${x + pad + 11}" y="${y + pad + 14.2}" font-size="12.5" font-weight="700" fill="#fff" text-anchor="middle">${esc(num)}</text>`;
    tx += 29;
  }
  const reserve = priority ? 30 : 0;
  const titleLines = Array.isArray(title) ? title : [title];
  out += text({ x: tx, y: y + pad + 15, lines: titleLines.map((t) => ({ t, weight: 700 })), size: titleSize, fill: titleFill, maxw: x + w - pad - reserve - tx, lh: 1.2 });
  if (priority) out += priorityBadge(x + w - pad + 3, y + pad - 1, priority);
  if (sub.length) {
    const sy = y + pad + 15 + (titleLines.length - 1) * titleSize * 1.2 + subSize * 1.55;
    out += text({ x: x + pad, y: sy, lines: sub, size: subSize, fill: subFill, maxw: w - 2 * pad, lh: 1.32 });
  }
  return out;
}

function zone({ x, y, w, h, label, sublabel = null, fill, stroke, labelFill = null, dash = null, r = 14, size = 12.5 }) {
  let out = rect({ x, y, w, h, r, fill, stroke, sw: 1.4, dash });
  out += `<text x="${x + 14}" y="${y + 21}" font-size="${size}" font-weight="800" fill="${labelFill || stroke}" letter-spacing="0.9">${esc(label.toUpperCase())}</text>`;
  if (sublabel) {
    const approx = label.length * size * 0.72 + 30;
    out += `<text x="${x + 14 + approx}" y="${y + 21}" font-size="${size - 0.5}" font-weight="500" fill="${labelFill || stroke}">${esc(sublabel)}</text>`;
  }
  return out;
}

// Poly-line arrow; label drawn on a white pill at `labelAt` (defaults to the middle of the first segment).
function arrow({ points, color = C.line, sw = 1.8, dash = null, head = 'end', marker = 'arr-ink', label = null, labelAt = null, labelSize = 11.5, labelFill = null, labelBg = C.white }) {
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ');
  const ms = head === 'both' || head === 'start' ? ` marker-start="url(#${marker})"` : '';
  const me = head === 'both' || head === 'end' ? ` marker-end="url(#${marker})"` : '';
  let out = `<path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ''} stroke-linejoin="round"${ms}${me}/>`;
  if (label) {
    const [lx, ly] = labelAt || [(points[0][0] + points[1][0]) / 2, (points[0][1] + points[1][1]) / 2];
    const labels = Array.isArray(label) ? label : [label];
    const lw = Math.max(...labels.map((l) => l.length)) * labelSize * 0.56 + 12;
    const lh = labels.length * labelSize * 1.25 + 6;
    out += rect({ x: lx - lw / 2, y: ly - lh / 2, w: lw, h: lh, r: 6, fill: labelBg, stroke: labelBg, sw: 0.5 });
    out += text({ x: lx, y: ly - lh / 2 + labelSize + 2, lines: labels, size: labelSize, weight: 600, fill: labelFill || color, anchor: 'middle', lh: 1.25 });
  }
  return out;
}

// Database cylinder.
function cylinder({ x, y, w, h, title, sub = [], fill = C.white, stroke = C.petrol, titleSize = 14, subSize = 11.5 }) {
  const ry = 9;
  let out = `<g filter="url(#shadow)">`;
  out += `<path d="M${x},${y + ry} L${x},${y + h - ry} A${w / 2},${ry} 0 0 0 ${x + w},${y + h - ry} L${x + w},${y + ry}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
  out += `<ellipse cx="${x + w / 2}" cy="${y + ry}" rx="${w / 2}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
  out += `</g>`;
  out += text({ x: x + w / 2, y: y + ry * 2 + titleSize + 4, lines: [{ t: title, weight: 700 }], size: titleSize, fill: C.ink, anchor: 'middle', maxw: w - 12 });
  if (sub.length) out += text({ x: x + w / 2, y: y + ry * 2 + titleSize + 6 + subSize * 1.55, lines: sub, size: subSize, fill: C.muted, anchor: 'middle', maxw: w - 12, lh: 1.3 });
  return out;
}

// Simple person glyph (head + shoulders) for actors.
function person({ cx, cy, color = C.petrol, s = 1 }) {
  return `<g fill="${color}"><circle cx="${cx}" cy="${cy - 9 * s}" r="${7 * s}"/><path d="M${cx - 13 * s},${cy + 12 * s} Q${cx - 13 * s},${cy} ${cx},${cy} Q${cx + 13 * s},${cy} ${cx + 13 * s},${cy + 12 * s} Z"/></g>`;
}

// Padlock glyph used to mark encrypted links/stores.
function lock({ x, y, color = C.teal, s = 1 }) {
  return `<g fill="none" stroke="${color}" stroke-width="${1.8 * s}"><path d="M${x + 3 * s},${y + 7 * s} v${-3 * s} a${4 * s},${4 * s} 0 0 1 ${8 * s},0 v${3 * s}"/></g><rect x="${x}" y="${y + 7 * s}" width="${14 * s}" height="${10 * s}" rx="${2 * s}" fill="${color}"/>`;
}

module.exports = { C, FONT, esc, svgDoc, rect, text, badge, box, zone, arrow, cylinder, person, lock, priorityBadge, PRIORITY };
