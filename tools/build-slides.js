// Deliverable 6 — builds presentation/MedX-Technical-Solution.pptx (+ speaker-notes.md) with pptxgenjs.
// Usage: node build-slides.js
const fs = require('fs');
const path = require('path');
const PptxGenJS = require('pptxgenjs');
const React = require('react');
const RDS = require('react-dom/server');
const sharp = require('sharp');
const lu = require('react-icons/lu');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'presentation');
const DIAG = path.join(ROOT, 'diagrams');

const C = {
  petrol: '0B3B4A', petrol2: '12505F', teal: '0E7C7B', tealLight: 'E7F5F3', tealLine: '8CCFC7', mint: 'BFE3DF',
  coral: 'E4572E', coralLight: 'FDEDE8', coralLine: 'F4B6A3', coralDark: '8C2A10',
  amber: 'F2B544', amberLight: 'FFF5E3', amberLine: 'F0C987', amberDark: '7A5200',
  slate: '64748B', slateLight: 'F1F5F9', slateLine: 'CBD5E1', grey: '94A3B8',
  indigo: '4B4FA6', indigoLight: 'EEEFFB', indigoLine: 'AEB1E6',
  sky: '2F7FB8', skyLight: 'EAF3FA', skyLine: 'A9CDE8',
  ink: '0F172A', text: '1E293B', muted: '475569', white: 'FFFFFF',
};
const F = 'Calibri';

const pres = new PptxGenJS();
pres.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5 in
pres.author = 'MedX architecture team';
pres.company = 'MedX';
pres.title = 'MedX — Technical Solution Design';
pres.subject = 'High-level architecture, component design, data, scalability, security & compliance';

// ---------- icons ----------
const iconCache = new Map();
async function icon(name, color) {
  const key = `${name}-${color}`;
  if (!iconCache.has(key)) {
    const Cmp = lu[name];
    if (!Cmp) throw new Error(`icon ${name} not found`);
    const svg = RDS.renderToStaticMarkup(React.createElement(Cmp, { color: `#${color}`, size: 256 }));
    const buf = await sharp(Buffer.from(svg)).resize(256, 256).png().toBuffer();
    iconCache.set(key, `image/png;base64,${buf.toString('base64')}`);
  }
  return iconCache.get(key);
}

// ---------- helpers ----------
const notes = [];
let slideNo = 0;

function newSlide({ dark = false, note = '' } = {}) {
  const s = pres.addSlide();
  slideNo += 1;
  s.background = { color: dark ? C.petrol : C.white };
  if (!dark) {
    s.addText('MedX · Technical Solution Design', { x: 0.6, y: 7.08, w: 6, h: 0.25, fontFace: F, fontSize: 9, color: C.grey, margin: 0, isTextBox: true });
    s.slideNumber = { x: 12.35, y: 7.08, w: 0.4, h: 0.25, fontFace: F, fontSize: 9, color: C.grey, align: 'right' };
  }
  if (note) {
    s.addNotes(note);
    notes.push({ no: slideNo, note });
  }
  return s;
}

function title(s, kicker, text, kickerColor = C.teal) {
  if (kicker) s.addText(kicker, { x: 0.6, y: 0.32, w: 11, h: 0.3, fontFace: F, fontSize: 12, bold: true, color: kickerColor, charSpacing: 1.5, margin: 0, isTextBox: true });
  s.addText(text, { x: 0.6, y: 0.6, w: 12.1, h: 0.72, fontFace: F, fontSize: 30, bold: true, color: C.ink, margin: 0, valign: 'top', isTextBox: true });
}

function box(s, x, y, w, h, o = {}) {
  s.addShape(o.shape || pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h,
    rectRadius: o.r != null ? o.r : 0.08,
    fill: { color: o.fill || C.white, transparency: o.transparency || 0 },
    line: { color: o.line || C.slateLine, width: o.lw != null ? o.lw : 1, dashType: o.dash || 'solid' },
    shadow: o.shadow ? { type: 'outer', color: '0F172A', opacity: 0.12, blur: 5, offset: 1.5, angle: 90 } : undefined,
  });
}

function txt(s, text, x, y, w, h, o = {}) {
  s.addText(text, {
    x, y, w, h, fontFace: F, fontSize: o.size || 12, color: o.color || C.text, bold: !!o.bold, italic: !!o.italic,
    align: o.align || 'left', valign: o.valign || 'top', margin: o.margin != null ? o.margin : 0,
    lineSpacingMultiple: o.lsm || 1.0, paraSpaceAfter: o.psa || 0, charSpacing: o.cs || 0, isTextBox: true,
  });
}

function bullets(s, items, x, y, w, h, o = {}) {
  const runs = items.map((t, i) => ({
    text: t,
    options: { bullet: o.bullet === false ? false : { indent: 12 }, breakLine: i < items.length - 1, paraSpaceAfter: o.psa != null ? o.psa : 5 },
  }));
  s.addText(runs, { x, y, w, h, fontFace: F, fontSize: o.size || 12, color: o.color || C.text, valign: 'top', margin: 0, isTextBox: true });
}

const PRIO = { H: [C.coral, C.white], M: [C.amber, '3B2A05'], L: [C.grey, C.white] };
function prio(s, x, y, p, d = 0.26) {
  const [bg, fg] = PRIO[p];
  s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: bg }, line: { color: bg, width: 0.5 } });
  s.addText(p, { x, y, w: d, h: d, fontFace: F, fontSize: Math.round(d * 40), bold: true, color: fg, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
}

function num(s, x, y, n, d = 0.36, fill = C.teal, color = C.white, size = null) {
  s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill, width: 0.5 } });
  s.addText(String(n), { x, y, w: d, h: d, fontFace: F, fontSize: size || Math.round(d * 36), bold: true, color, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
}

async function iconIn(s, name, x, y, d, bg, fg) {
  if (bg) s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: bg }, line: { color: bg, width: 0.5 } });
  const pad = bg ? d * 0.22 : 0;
  s.addImage({ data: await icon(name, fg), x: x + pad, y: y + pad, w: d - 2 * pad, h: d - 2 * pad });
}

function arrow(s, x1, y1, x2, y2, color = C.slate, width = 1.5, both = false, dash = 'solid') {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  s.addShape(pres.shapes.LINE, {
    x, y, w: Math.max(Math.abs(x2 - x1), 0.001), h: Math.max(Math.abs(y2 - y1), 0.001),
    flipH: x2 < x1, flipV: y2 < y1,
    line: { color, width, dashType: dash, endArrowType: 'triangle', beginArrowType: both ? 'triangle' : undefined },
  });
}

function chip(s, text, x, y, w, h, o = {}) {
  box(s, x, y, w, h, { fill: o.fill || C.white, line: o.line || C.slateLine, r: o.r != null ? o.r : 0.06, lw: o.lw || 0.75 });
  txt(s, text, x + 0.06, y, w - 0.12, h, { size: o.size || 11, color: o.color || C.text, bold: o.bold, align: o.align || 'center', valign: 'middle' });
}

// =====================================================================
async function build() {
  // ---------------------------------------------------------------- 1. Title
  {
    const s = newSlide({ dark: true, note:
`Opening (30 s).
Good morning. We were asked to design the technical solution for MedX: a platform for teleconsultations, patient records and prescription tracking.
In the next 15 minutes I will show the architecture, how each component works, how data is stored, how the platform scales, and how it protects health data.
One idea guides every choice: MedX's own priorities. Data protection and emergency access come first; everything else is built on top of them.` });
    txt(s, 'MEDX HEALTH PLATFORM', 0.8, 1.35, 7, 0.4, { size: 14, bold: true, color: C.mint, cs: 3 });
    txt(s, 'Technical Solution Design', 0.8, 1.8, 7.2, 1.7, { size: 46, bold: true, color: C.white });
    txt(s, 'Telehealth consultations · Patient records · Prescription tracking', 0.8, 3.55, 7.2, 0.5, { size: 18, color: C.mint });
    txt(s, 'High-level architecture · component design · data & storage · scalability & performance · security & compliance', 0.8, 4.15, 6.8, 0.8, { size: 14, color: 'D6E6EA' });
    txt(s, 'Mini-project 5DESI · Architecture proposal · 2026', 0.8, 6.45, 7, 0.35, { size: 12, color: C.mint });
    const tiles = [
      ['LuVideo', 'Consult', C.petrol2, C.mint],
      ['LuFileText', 'Records', C.petrol2, C.mint],
      ['LuPill', 'Prescribe', C.petrol2, C.mint],
      ['LuShieldCheck', 'Protect', C.coral, C.white],
    ];
    for (const [i, [ic, label, bg, fg]] of tiles.entries()) {
      const x = 8.35 + (i % 2) * 2.2;
      const y = 1.45 + Math.floor(i / 2) * 2.2;
      box(s, x, y, 1.95, 1.95, { fill: bg, line: i === 3 ? C.coral : '2B7285', r: 0.12 });
      s.addImage({ data: await icon(ic, fg), x: x + 0.62, y: y + 0.35, w: 0.72, h: 0.72 });
      txt(s, label, x, y + 1.25, 1.95, 0.4, { size: 16, bold: true, color: fg, align: 'center' });
    }
  }

  // ---------------------------------------------------------------- 2. Design drivers
  {
    const s = newSlide({ note:
`Design drivers (1 min).
MedX has three pillars: teleconsultation, a lifelong patient record, and prescription tracking up to the pharmacy.
The brief ranks requirements. The five HIGH priorities — encryption, records, emergency access, authentication and integrity — are not features we add at the end: they are the foundations and the non-negotiable principles of the architecture.
The MEDIUM priorities are the care workflows built on that foundation, and the LOW priorities are fully designed now but delivered last, mostly with partners such as a payment provider.` });
    title(s, 'DESIGN DRIVERS', 'What MedX needs — and what comes first');
    const pillars = [
      ['LuVideo', 'Telehealth consultations', 'Book, meet a doctor by video, chat and share documents'],
      ['LuFileText', 'Patient records', 'A lifelong, trustworthy record — available in emergencies'],
      ['LuPill', 'Prescription tracking', 'From the doctor\'s signature to the pharmacy counter'],
    ];
    txt(s, 'MEDX MISSION', 0.6, 1.6, 4, 0.3, { size: 11, bold: true, color: C.slate, cs: 1 });
    for (const [i, [ic, t, d]] of pillars.entries()) {
      const y = 2.0 + i * 1.3;
      await iconIn(s, ic, 0.6, y, 0.75, C.tealLight, C.teal);
      txt(s, t, 1.55, y + 0.02, 3.2, 0.35, { size: 16, bold: true, color: C.ink });
      txt(s, d, 1.55, y + 0.4, 3.1, 0.6, { size: 12, color: C.muted });
    }
    const bands = [
      ['HIGH', 'Non-negotiable foundations', C.coralLight, C.coral, C.coralDark, ['Encryption at rest & in transit', 'Patient records management', 'Emergency access', 'Authentication & authorization', 'Integrity & secure files']],
      ['MEDIUM', 'Care workflows', C.amberLight, C.amber, C.amberDark, ['Scheduling', 'Video · chat · files', 'Prescriptions', 'Masking & redaction', 'External calendars']],
      ['LOW', 'Designed now, delivered last', C.slateLight, C.grey, C.muted, ['Pharmacy interface', 'Preferences', 'Notification tracking', 'Anonymization', 'Payments', 'Refunds']],
    ];
    for (const [i, [lvl, sub, bg, line, dark, items]] of bands.entries()) {
      const y = 1.6 + i * 1.42;
      box(s, 5.0, y, 7.73, 1.28, { fill: bg, line, lw: 1.25 });
      prio(s, 5.18, y + 0.14, lvl[0], 0.32);
      txt(s, lvl, 5.6, y + 0.13, 1.2, 0.34, { size: 14, bold: true, color: dark });
      txt(s, sub, 6.55, y + 0.15, 5, 0.34, { size: 12, color: dark, italic: true });
      const n = items.length;
      const gap = 0.1;
      const cw = (7.73 - 0.36 - gap * (n - 1)) / n;
      items.forEach((it, j) => chip(s, it, 5.18 + j * (cw + gap), y + 0.58, cw, 0.56, { size: 11, fill: C.white, line }));
    }
    box(s, 0.6, 6.05, 12.13, 0.7, { fill: C.petrol, line: C.petrol, r: 0.08 });
    txt(s, 'High priorities become architecture principles  ·  Medium features are built on them  ·  Low features are designed now, delivered last', 0.8, 6.05, 11.73, 0.7, { size: 14, bold: true, color: C.white, valign: 'middle', align: 'center' });
  }

  // ---------------------------------------------------------------- 3. Targets & principles
  {
    const s = newSlide({ note:
`Targets and principles (1 min).
We sized the platform for year 3: 10 million patients, 200 thousand teleconsultations a day, up to 10 thousand simultaneous video calls — and we keep a 2x headroom on top of that.
Two numbers matter most because they come from the HIGH priorities: emergency access must be available 99.99% of the time and return the critical summary in under 300 milliseconds.
The eight principles below turn the priorities into rules every team follows — for example "integrity first": clinical history is never overwritten.` });
    title(s, 'DESIGN TARGETS & PRINCIPLES', 'Sized for 10× growth, guided by eight principles');
    const stats = [
      ['10 M', 'registered patients (Year 3)', C.teal],
      ['200 k', 'teleconsultations per day', C.teal],
      ['10 k', 'concurrent video calls at peak', C.teal],
      ['99.99 %', 'availability of emergency access', C.coral],
      ['< 300 ms', 'to serve a critical summary', C.coral],
    ];
    stats.forEach(([n, l, col], i) => {
      const x = 0.6 + i * 2.465;
      box(s, x, 1.6, 2.3, 1.45, { fill: C.white, line: C.slateLine, shadow: true });
      txt(s, n, x, 1.72, 2.3, 0.7, { size: 30, bold: true, color: col, align: 'center' });
      txt(s, l, x + 0.1, 2.45, 2.1, 0.5, { size: 12, color: C.muted, align: 'center' });
    });
    const pr = [
      ['LuShieldCheck', 'Privacy by design', 'Encrypt everything, minimise, deny by default'],
      ['LuHeartPulse', 'Patient safety first', 'The emergency path works when all else fails'],
      ['LuHistory', 'Integrity first', 'Clinical history is never rewritten'],
      ['LuBadgeCheck', 'Standards over custom', 'FHIR · OpenID Connect · WebRTC · OpenAPI'],
      ['LuWorkflow', 'Loose coupling', 'Domain events, one database per service'],
      ['LuPackage', 'Reuse, then build', 'Reuse IdP, PSP, SFU — build care logic'],
      ['LuTrendingUp', 'Scale out & automate', 'Stateless, autoscaled, infrastructure as code'],
      ['LuEye', 'Observable & auditable', 'Every request traced, every access audited'],
    ];
    for (const [i, [ic, t, d]] of pr.entries()) {
      const x = 0.6 + (i % 4) * 3.083;
      const y = 3.35 + Math.floor(i / 4) * 1.72;
      box(s, x, y, 2.93, 1.55, { fill: C.slateLight, line: C.slateLight });
      await iconIn(s, ic, x + 0.18, y + 0.2, 0.55, C.white, C.teal);
      txt(s, `P${i + 1}`, x + 2.35, y + 0.2, 0.45, 0.3, { size: 11, bold: true, color: C.grey, align: 'right' });
      txt(s, t, x + 0.18, y + 0.85, 2.65, 0.32, { size: 14, bold: true, color: C.ink });
      txt(s, d, x + 0.18, y + 1.15, 2.65, 0.35, { size: 11, color: C.muted });
    }
  }

  // ---------------------------------------------------------------- 4. Architecture at a glance
  {
    const s = newSlide({ note:
`Architecture at a glance (2 min) — the key slide.
Read it from left to right. Users reach MedX only through the edge: CDN and firewall, the API gateway, a real-time gateway for chat and live statuses, and the media plane for video.
Behind it, the eight components of the brief are microservices grouped in security zones. The identity zone decides who you are and what you may do. The clinical zone holds all health data and has the strictest controls. Notification never stores health data, and billing sits in its own payment zone.
Services talk through a Kafka event bus; shared platform services provide audit, secure documents and key management; each service owns its database.
Emergency access — in red — is deployed separately so nothing else can slow it down.` });
    title(s, 'HIGH-LEVEL ARCHITECTURE', 'Architecture at a glance');
    // Users
    txt(s, 'USERS', 0.45, 1.42, 1.4, 0.25, { size: 10, bold: true, color: C.petrol, cs: 1 });
    const users = [['LuUser', 'Patients & proxies', C.teal], ['LuStethoscope', 'Doctors', C.teal], ['LuSiren', 'Emergency clinicians', C.coral], ['LuStore', 'Pharmacies', C.teal], ['LuUserCog', 'MedX operations', C.slate]];
    for (const [i, [ic, l, col]] of users.entries()) {
      const y = 1.72 + i * 0.72;
      box(s, 0.45, y, 1.4, 0.6, { fill: col === C.coral ? C.coralLight : C.white, line: col === C.coral ? C.coralLine : C.slateLine });
      await iconIn(s, ic, 0.52, y + 0.12, 0.36, null, col);
      txt(s, l, 0.93, y, 0.9, 0.6, { size: 9.5, bold: true, color: C.ink, valign: 'middle' });
      arrow(s, 1.87, y + 0.3, 2.02, y + 0.3, C.slate, 1.25);
    }
    // Edge
    box(s, 2.02, 1.42, 1.58, 3.72, { fill: C.slateLight, line: C.slate, lw: 1 });
    txt(s, 'EDGE · PUBLIC', 2.12, 1.47, 1.4, 0.25, { size: 9, bold: true, color: C.slate, cs: 1 });
    const edge = [['CDN · WAF · DDoS', 'TLS 1.3'], ['API Gateway', 'JWT · rate limits'], ['Real-time Gateway', 'WebSocket'], ['Media plane', 'SFU · TURN']];
    edge.forEach(([t, d], i) => {
      const y = 1.78 + i * 0.83;
      box(s, 2.1, y, 1.42, 0.7, { fill: C.white, line: C.slateLine });
      txt(s, t, 2.16, y + 0.07, 1.32, 0.3, { size: 10, bold: true, color: C.ink });
      txt(s, d, 2.16, y + 0.37, 1.32, 0.28, { size: 9, color: C.muted });
    });
    arrow(s, 3.6, 2.55, 3.72, 2.55, C.slate, 1.25);
    arrow(s, 3.6, 3.35, 3.72, 3.35, C.slate, 1.25);
    arrow(s, 3.6, 4.1, 3.72, 4.1, C.slate, 1.25);
    // Identity zone
    const X0 = 3.72;
    const ZW = 6.95;
    box(s, X0, 1.42, ZW, 0.9, { fill: C.indigoLight, line: C.indigo });
    txt(s, 'IDENTITY & ACCESS', X0 + 0.1, 1.46, 3, 0.25, { size: 9, bold: true, color: C.indigo, cs: 1 });
    const svc = (x, y, w, h, t, d, p, o = {}) => {
      box(s, x, y, w, h, { fill: o.fill || C.white, line: o.line || C.slateLine, lw: o.lw || 1 });
      txt(s, t, x + 0.08, y + 0.05, w - 0.45, 0.3, { size: 10.5, bold: true, color: o.tc || C.ink });
      if (d) txt(s, d, x + 0.08, y + 0.33, w - 0.16, h - 0.36, { size: 8.5, color: o.dc || C.muted });
      if (p) prio(s, x + w - 0.3, y + 0.07, p, 0.22);
    };
    svc(X0 + 0.1, 1.72, 3.3, 0.52, '① User Management + IdP', 'OIDC · MFA · passkeys · roles · preferences', 'H', { line: C.indigoLine });
    svc(X0 + 3.55, 1.72, 3.3, 0.52, 'Policy engine (OPA)', 'RBAC + ABAC · consent · masking obligations', 'H', { line: C.indigoLine });
    // Clinical zone
    box(s, X0, 2.42, ZW, 1.86, { fill: C.tealLight, line: C.teal });
    txt(s, 'CLINICAL ZONE · HEALTH DATA', X0 + 0.1, 2.46, 4, 0.25, { size: 9, bold: true, color: C.teal, cs: 1 });
    const cw = (ZW - 0.2 - 0.2) / 3;
    svc(X0 + 0.1, 2.74, cw, 0.66, '② Scheduling', 'Booking · waitlist · urgent · calendars', 'M', { line: C.tealLine });
    svc(X0 + 0.2 + cw, 2.74, cw, 0.66, '③ Consultation', 'Rooms · video · chat · files', 'M', { line: C.tealLine });
    svc(X0 + 0.3 + 2 * cw, 2.74, cw, 0.66, '⑤ Prescription', 'E-signature · checks · tracking', 'M', { line: C.tealLine });
    svc(X0 + 0.1, 3.5, cw, 0.7, '④ Patient Records', 'FHIR · versioned · hash-chained', 'H', { line: C.teal, lw: 1.5 });
    svc(X0 + 0.2 + cw, 3.5, cw, 0.7, 'Emergency Access', 'Break-glass · Tier 0 · 2 regions', 'H', { fill: C.coralLight, line: C.coral, lw: 1.5, tc: C.coralDark, dc: C.coralDark });
    svc(X0 + 0.3 + 2 * cw, 3.5, cw, 0.7, '⑥ Pharmacy Interface', 'Inbox · status · inventory', 'L', { line: C.tealLine });
    // Engagement & payment
    const hw = (ZW - 0.12) / 2;
    box(s, X0, 4.38, hw, 0.76, { fill: C.skyLight, line: C.sky });
    svc(X0 + 0.1, 4.46, hw - 0.2, 0.6, '⑦ Notification', 'SMS · e-mail · push · in-app — no health data', 'L', { line: C.skyLine });
    box(s, X0 + hw + 0.12, 4.38, hw, 0.76, { fill: C.amberLight, line: C.amber });
    svc(X0 + hw + 0.22, 4.46, hw - 0.2, 0.6, '⑧ Billing & Payment', 'PSP tokens only (PCI SAQ A) · ledger', 'L', { line: C.amberLine });
    // Event bus
    box(s, 2.02, 5.26, 8.65, 0.36, { fill: C.petrol, line: C.petrol, r: 0.05 });
    txt(s, 'EVENT BUS · Kafka — domain events via transactional outbox · schema registry', 2.02, 5.26, 8.65, 0.36, { size: 10.5, bold: true, color: C.white, align: 'center', valign: 'middle' });
    // Platform row
    const plat = ['Audit trail (WORM)', 'Document store', 'Keys & secrets (HSM)', 'Observability & SIEM', 'De-identified data'];
    const pw = (8.65 - 0.1 * 4) / 5;
    plat.forEach((p, i) => chip(s, p, 2.02 + i * (pw + 0.1), 5.72, pw, 0.42, { size: 10, fill: C.slateLight, line: C.slateLine, bold: true, color: C.text }));
    // Data row (cylinders)
    const data = ['PostgreSQL ×8', 'Redis', 'Cassandra', 'Object storage', 'OpenSearch', 'Backups · DR'];
    const dw = (8.65 - 0.1 * 5) / 6;
    data.forEach((d, i) => {
      s.addShape(pres.shapes.CAN, { x: 2.02 + i * (dw + 0.1), y: 6.24, w: dw, h: 0.62, fill: { color: C.white }, line: { color: C.petrol2, width: 1 } });
      txt(s, d, 2.02 + i * (dw + 0.1), 6.36, dw, 0.46, { size: 10, bold: true, color: C.petrol, align: 'center', valign: 'middle' });
    });
    // External
    box(s, 10.82, 1.42, 2.08, 5.44, { fill: 'FBFCFD', line: C.grey, dash: 'dash' });
    txt(s, 'EXTERNAL SYSTEMS', 10.92, 1.47, 1.9, 0.25, { size: 9, bold: true, color: C.slate, cs: 1 });
    const ext = [['Identity federation', '①'], ['External calendars', '②'], ['Drug database', '⑤'], ['National e-health', '④ ⑤'], ['Pharmacy systems', '⑥'], ['SMS · e-mail · push', '⑦'], ['Payment provider', '⑧']];
    ext.forEach(([t, n], i) => {
      const y = 1.8 + i * 0.72;
      box(s, 10.92, y, 1.88, 0.6, { fill: C.white, line: C.slateLine, dash: 'dash' });
      txt(s, t, 11.0, y + 0.06, 1.75, 0.28, { size: 9.5, bold: true, color: C.ink });
      txt(s, `used by ${n}`, 11.0, y + 0.32, 1.75, 0.24, { size: 8.5, color: C.teal });
      arrow(s, 10.9, y + 0.3, 10.7, y + 0.3, C.slate, 1, true);
    });
  }

  // ---------------------------------------------------------------- 5. Care journey
  {
    const s = newSlide({ note:
`How the pieces work together (1.5 min).
Here is one care journey. The patient books: Scheduling holds the slot for 10 minutes, a database constraint makes double booking impossible, and Billing pre-authorises the fee.
They meet by video in the Consultation service; the doctor documents in the Records service, then signs a prescription, which the pharmacy receives within seconds; finally the payment is captured.
Below, the event bus: each step publishes an event. Three rules keep this robust: synchronous calls only when a user is waiting, events never carry clinical content, and the outbox pattern guarantees we never lose or invent an event.` });
    title(s, 'ARCHITECTURE LOGIC', 'One care journey across the services');
    const st = [
      ['LuCalendarClock', 'Book', '② Scheduling · ⑧ Billing', '10-min slot hold + database exclusion constraint · fee pre-authorised'],
      ['LuVideo', 'Consult', '③ Consultation', 'Waiting room · WebRTC SFU · end-to-end encryption · chat & files'],
      ['LuFileText', 'Document', '④ Patient Records', 'FHIR note, signed · versioned · hash-chained · audited'],
      ['LuPill', 'Prescribe', '⑤ Prescription', 'Allergy & interaction checks · e-signature in HSM · QR verification'],
      ['LuStore', 'Dispense & pay', '⑥ Pharmacy · ⑧ Billing · ⑦', 'Pharmacy statuses · payment captured · invoice · patient notified'],
    ];
    const w = 2.25;
    const gap = 0.22;
    for (const [i, [ic, t, svc, d]] of st.entries()) {
      const x = 0.6 + i * (w + gap);
      box(s, x, 1.6, w, 2.95, { fill: C.white, line: C.tealLine, shadow: true });
      await iconIn(s, ic, x + 0.18, 1.8, 0.62, C.tealLight, C.teal);
      num(s, x + w - 0.5, 1.8, i + 1, 0.32, C.petrol);
      txt(s, t, x + 0.18, 2.55, w - 0.3, 0.4, { size: 17, bold: true, color: C.ink });
      txt(s, svc, x + 0.18, 2.97, w - 0.3, 0.35, { size: 11, bold: true, color: C.teal });
      txt(s, d, x + 0.18, 3.35, w - 0.32, 1.35, { size: 11.5, color: C.muted });
      if (i < st.length - 1) arrow(s, x + w + 0.02, 3.07, x + w + gap - 0.02, 3.07, C.teal, 2);
    }
    box(s, 0.6, 4.75, 12.13, 0.5, { fill: C.petrol, line: C.petrol, r: 0.06 });
    txt(s, 'Kafka events:   AppointmentBooked  →  ConsultationCompleted  →  RecordUpdated  →  PrescriptionIssued  →  FulfilmentStatusUpdated · PaymentCaptured', 0.75, 4.75, 11.9, 0.5, { size: 12, bold: true, color: C.white, valign: 'middle' });
    const rules = [
      ['LuTimer', 'Synchronous only when a user waits', 'At most 2 hops, timeouts and circuit breakers everywhere'],
      ['LuEyeOff', 'Events carry IDs, never clinical data', 'Consumers fetch details under their own authorization'],
      ['LuListChecks', 'Transactional outbox', 'No lost or phantom events · idempotent consumers'],
    ];
    for (const [i, [ic, t, d]] of rules.entries()) {
      const x = 0.6 + i * 4.1;
      box(s, x, 5.5, 3.93, 1.2, { fill: C.slateLight, line: C.slateLight });
      await iconIn(s, ic, x + 0.15, 5.68, 0.45, C.white, C.petrol);
      txt(s, t, x + 0.75, 5.62, 3.1, 0.35, { size: 12.5, bold: true, color: C.ink });
      txt(s, d, x + 0.75, 5.97, 3.1, 0.6, { size: 11, color: C.muted });
    }
  }

  // ---------------------------------------------------------------- 6. Identity & access (H4)
  {
    const s = newSlide({ note:
`HIGH priority H4 — authentication and authorization (1.5 min).
We do not build authentication ourselves: Keycloak, a proven identity provider, handles OpenID Connect, MFA and passkeys, with three separate realms. Patients get a smooth experience; professionals always use phishing-resistant MFA and must re-authenticate before signing a prescription or breaking the glass; MedX staff never see health data.
Authorization is two layers: roles for the coarse rules, and attribute-based policies for the fine ones — is this doctor treating this patient, for which purpose, with which consent. OPA evaluates them next to every service in under a millisecond, and returns masking obligations with the decision.` });
    title(s, 'HIGH PRIORITY · H4', 'Strong identity, fine-grained authorization', C.coral);
    const realms = [
      ['LuUser', 'Patients', 'Passkey or password · risk-based MFA · biometric unlock on mobile · DPoP-bound 10-min tokens'],
      ['LuStethoscope', 'Professionals', 'Phishing-resistant MFA always (passkey, e-CPS smart card) · step-up before signing or break-glass · 15-min idle timeout'],
      ['LuUserCog', 'MedX workforce', 'Corporate SSO + hardware keys · just-in-time admin, recorded · no access to health data'],
    ];
    txt(s, 'KEYCLOAK — 3 REALMS, 3 RISK PROFILES', 0.6, 1.55, 5, 0.3, { size: 11, bold: true, color: C.slate, cs: 1 });
    for (const [i, [ic, t, d]] of realms.entries()) {
      const y = 1.95 + i * 1.62;
      box(s, 0.6, y, 4.9, 1.45, { fill: C.indigoLight, line: C.indigoLight });
      await iconIn(s, ic, 0.78, y + 0.2, 0.55, C.white, C.indigo);
      txt(s, t, 1.5, y + 0.18, 3.8, 0.35, { size: 15, bold: true, color: C.ink });
      txt(s, d, 1.5, y + 0.55, 3.85, 0.85, { size: 11.5, color: C.muted });
    }
    txt(s, 'EVERY REQUEST ON HEALTH DATA', 5.9, 1.55, 6, 0.3, { size: 11, bold: true, color: C.slate, cs: 1 });
    const nodes = [
      [5.9, 'App', 'access token\n(DPoP-bound)'],
      [7.75, 'API Gateway', 'signature, expiry,\naudience, rate limit'],
      [9.6, 'Service (PEP)', 'looks up care grant,\nconsent, labels'],
    ];
    nodes.forEach(([x, t, d]) => {
      box(s, x, 1.95, 1.6, 1.25, { fill: C.white, line: C.slateLine, shadow: true });
      txt(s, t, x, 2.02, 1.6, 0.35, { size: 13, bold: true, color: C.ink, align: 'center' });
      txt(s, d, x + 0.05, 2.4, 1.5, 0.75, { size: 10.5, color: C.muted, align: 'center' });
    });
    arrow(s, 7.52, 2.57, 7.73, 2.57, C.slate, 1.75);
    arrow(s, 9.37, 2.57, 9.58, 2.57, C.slate, 1.75);
    box(s, 11.45, 1.95, 1.28, 1.25, { fill: C.petrol, line: C.petrol });
    txt(s, 'Data', 11.45, 2.05, 1.28, 0.35, { size: 13, bold: true, color: C.white, align: 'center' });
    txt(s, 'decrypt +\nmask', 11.45, 2.42, 1.28, 0.7, { size: 10.5, color: C.mint, align: 'center' });
    arrow(s, 11.22, 2.57, 11.43, 2.57, C.slate, 1.75);
    box(s, 9.6, 3.55, 1.6, 1.0, { fill: C.coralLight, line: C.coral });
    txt(s, 'OPA sidecar', 9.6, 3.62, 1.6, 0.32, { size: 13, bold: true, color: C.coralDark, align: 'center' });
    txt(s, '< 1 ms, no network hop', 9.6, 3.95, 1.6, 0.5, { size: 10, color: C.coralDark, align: 'center' });
    arrow(s, 10.4, 3.22, 10.4, 3.53, C.coral, 1.5, true);
    txt(s, 'permit / deny\n+ masking obligations', 7.55, 3.62, 1.95, 0.7, { size: 10.5, color: C.coralDark, align: 'right', italic: true });
    box(s, 5.9, 4.85, 6.83, 1.95, { fill: C.slateLight, line: C.slateLight });
    txt(s, 'RBAC + ABAC decision', 6.1, 4.97, 6.4, 0.35, { size: 14, bold: true, color: C.ink });
    const parts = [['Role', 'doctor'], ['Relationship', 'care grant'], ['Purpose', 'treatment'], ['Consent', 'labels'], ['Assurance', 'MFA level']];
    parts.forEach(([a, b], i) => {
      const x = 6.1 + i * 1.3;
      chip(s, `${a}\n${b}`, x, 5.42, 1.15, 0.62, { size: 10.5, fill: C.white, line: C.slateLine });
      if (i < parts.length - 1) txt(s, '+', x + 1.15, 5.42, 0.15, 0.62, { size: 13, bold: true, color: C.slate, align: 'center', valign: 'middle' });
    });
    txt(s, 'Policies as code: Git → unit tests → signed bundles → sidecars. Deny by default.', 6.1, 6.22, 6.4, 0.45, { size: 11.5, color: C.muted, italic: true });
  }

  // ---------------------------------------------------------------- 7. Patient records (H2, H5)
  {
    const s = newSlide({ note:
`HIGH priorities H2 and H5 — patient records (1.5 min).
Records are stored in HL7 FHIR, the healthcare standard, so validation, versioning and future integration with national services come for free.
Every request goes through the same seven-step chain on the left, so no endpoint can forget a control.
Integrity is provable: history is append-only, each version is chained by a hash, and every night the chain heads are signed in a hardware security module and stored in write-once storage — even an administrator cannot rewrite history unnoticed.
Access is explicit: the patient, a proxy, a treating doctor with a time-limited care grant, a doctor the patient shared with, or break-glass. Pharmacists and MedX staff have no access to the record.` });
    title(s, 'HIGH PRIORITY · H2 · H5', 'Patient records: complete, correct, tamper-evident', C.coral);
    txt(s, 'EVERY REQUEST CROSSES THE SAME CHAIN', 0.6, 1.55, 4, 0.3, { size: 11, bold: true, color: C.slate, cs: 1 });
    const chain = ['Authorization (PEP → OPA)', 'Validation (FHIR profiles)', 'Provenance (who, why)', 'Encryption (patient key)', 'Hash chain', 'Audit (same transaction)', 'Masking (obligations)'];
    chain.forEach((c, i) => {
      const y = 1.95 + i * 0.66;
      box(s, 0.6, y, 3.7, 0.54, { fill: i === 3 || i === 4 ? C.tealLight : C.white, line: C.tealLine });
      num(s, 0.7, y + 0.1, i + 1, 0.34, C.teal);
      txt(s, c, 1.15, y, 3.1, 0.54, { size: 12.5, bold: true, color: C.ink, valign: 'middle' });
      if (i < chain.length - 1) arrow(s, 2.45, y + 0.54, 2.45, y + 0.66, C.teal, 1.25);
    });
    const cards = [
      ['LuBadgeCheck', 'FHIR R4 + International Patient Summary', 'Standard model with validation, versioning and search — ready for national services and hospitals.'],
      ['LuHistory', 'History is never rewritten', 'Append-only versions · signed notes, then addenda · "entered-in-error" instead of delete.'],
      ['LuFileLock', 'Tamper-evident', 'Per-patient hash chain · daily Merkle root signed in HSM, timestamped, stored write-once.'],
      ['LuUserCheck', 'Right person, right reason', 'Self · proxy · care grant (30 days) · patient share · break-glass. Pharmacists and staff: no access.'],
    ];
    for (const [i, [ic, t, d]] of cards.entries()) {
      const x = 4.7 + (i % 2) * 4.07;
      const y = 1.55 + Math.floor(i / 2) * 2.0;
      box(s, x, y, 3.95, 1.85, { fill: C.white, line: C.slateLine, shadow: true });
      await iconIn(s, ic, x + 0.2, y + 0.2, 0.55, C.tealLight, C.teal);
      txt(s, t, x + 0.9, y + 0.2, 2.95, 0.6, { size: 14, bold: true, color: C.ink, valign: 'middle' });
      txt(s, d, x + 0.2, y + 0.9, 3.6, 0.9, { size: 12, color: C.muted });
    }
    box(s, 4.7, 5.62, 8.03, 1.2, { fill: C.amberLight, line: C.amberLine });
    txt(s, 'MASKING & REDACTION (M4)', 4.9, 5.72, 5, 0.3, { size: 11, bold: true, color: C.amberDark, cs: 1 });
    txt(s, 'Support agent: +33 6 •• •• •• 42   ·   Pharmacist: no diagnosis   ·   Break-glass: psychotherapy notes excluded   ·   Patient: results released after review   ·   Logs: never any PHI', 4.9, 6.05, 7.7, 0.7, { size: 11.5, color: C.text });
  }

  // ---------------------------------------------------------------- 8. Emergency access (H3)
  {
    const s = newSlide({ note:
`HIGH priority H3 — emergency access (2 min).
In an emergency, minutes matter, so access is never blocked by a workflow: it is narrow, time-boxed and answered for afterwards.
The clinician identifies the patient by exact match only, declares the emergency with a reason, re-authenticates with a passkey or smart card, and immediately gets a four-hour read-only grant. The International Patient Summary — allergies, problems, medications, blood group, directives — comes back in under 300 milliseconds.
Accountability: the audit record is written in the same transaction, the privacy office is alerted in real time, the patient is informed within 24 hours, and every case is reviewed within 72 hours.
And it survives failures: separate deployment, pre-computed summaries on replicas, active in two regions.` });
    title(s, 'HIGH PRIORITY · H3', 'Emergency access in seconds — accountable afterwards', C.coral);
    const steps = [
      ['Identify', 'Exact match only: national ID, or name + birth date + sex'],
      ['Declare', 'Reason code + free-text justification'],
      ['Step-up MFA', 'Passkey or smart card · entitlement & opt-out checked'],
      ['Time-boxed grant', '4 hours · read-only · this patient only'],
      ['Summary < 1 s', 'Allergies, problems, medications, blood group, directives'],
    ];
    const w = 2.25;
    const gap = 0.22;
    steps.forEach(([t, d], i) => {
      const x = 0.6 + i * (w + gap);
      const hot = i === 4;
      box(s, x, 1.55, w, 1.75, { fill: hot ? C.coralLight : C.white, line: hot ? C.coral : C.tealLine, lw: hot ? 1.75 : 1, shadow: true });
      num(s, x + 0.18, 1.72, i + 1, 0.4, hot ? C.coral : C.teal);
      txt(s, t, x + 0.68, 1.72, w - 0.75, 0.4, { size: 15, bold: true, color: hot ? C.coralDark : C.ink, valign: 'middle' });
      txt(s, d, x + 0.18, 2.3, w - 0.33, 0.95, { size: 12, color: hot ? C.coralDark : C.muted });
      if (i < steps.length - 1) arrow(s, x + w + 0.02, 2.42, x + w + gap - 0.02, 2.42, C.teal, 2);
    });
    box(s, 0.6, 3.5, 12.13, 0.46, { fill: C.petrol, line: C.petrol, r: 0.2 });
    txt(s, '≈ 30 s for the clinician  ·  p95 < 300 ms per API call  ·  99.99 % availability  ·  active in two regions', 0.6, 3.5, 12.13, 0.46, { size: 14, bold: true, color: C.white, align: 'center', valign: 'middle' });
    box(s, 0.6, 4.18, 5.95, 2.65, { fill: C.coralLight, line: C.coralLine });
    await iconIn(s, 'LuEye', 0.8, 4.33, 0.45, C.white, C.coral);
    txt(s, 'Guardrails — accountable afterwards', 1.4, 4.35, 5, 0.4, { size: 15, bold: true, color: C.coralDark });
    bullets(s, ['Audit event written in the same transaction as the grant', 'Real-time alert to the privacy office (SIEM)', 'Patient informed within 24 h: who, when, what', 'Mandatory review within 72 h; misuse → suspension', 'Patients may opt out where the law allows it'], 0.85, 4.9, 5.55, 1.9, { size: 13.5, color: C.coralDark, psa: 6 });
    box(s, 6.78, 4.18, 5.95, 2.65, { fill: C.tealLight, line: C.tealLine });
    await iconIn(s, 'LuShieldCheck', 6.98, 4.33, 0.45, C.white, C.teal);
    txt(s, 'Tier 0 — survives failures', 7.58, 4.35, 5, 0.4, { size: 15, bold: true, color: C.petrol });
    bullets(s, ['Separate deployment with reserved capacity (bulkhead)', 'Pre-computed summary read from local replicas', 'Active in the DR region with its own grant database', 'Token and policy checks are local (cached keys, OPA)', 'Audit buffered in an outbox if the pipeline is down'], 7.03, 4.9, 5.55, 1.9, { size: 13.5, color: C.text, psa: 6 });
  }

  // ---------------------------------------------------------------- 9. Encryption & integrity (H1, H5)
  {
    const s = newSlide({ note:
`HIGH priorities H1 and H5 — encryption and integrity (1.5 min).
In transit, there is no plaintext hop: TLS 1.3 at the edge, mutual TLS between services, verified TLS to every database, and end-to-end encryption for video. Because health data must stay secret for decades, we enable hybrid post-quantum key exchange where supported.
At rest we have two independent layers: storage encryption everywhere, plus application-level encryption with one key per patient, wrapped by keys that never leave hardware security modules. A stolen backup is useless, and destroying a patient's keys at the end of retention makes every copy unreadable.
Integrity is enforced by constraints and append-only history, and proven by hash chains, checksums and immutable backups that we restore every week.` });
    title(s, 'HIGH PRIORITY · H1 · H5', 'Encrypted everywhere, integrity you can prove', C.coral);
    const colW = 3.93;
    const heads = [['LuLock', 'In transit', C.teal], ['LuKeyRound', 'At rest — envelope encryption', C.indigo], ['LuFileCheck', 'Integrity', C.petrol]];
    for (const [i, [ic, t, col]] of heads.entries()) {
      const x = 0.6 + i * (colW + 0.17);
      await iconIn(s, ic, x, 1.55, 0.5, null, col);
      txt(s, t, x + 0.62, 1.58, colW - 0.6, 0.45, { size: 16, bold: true, color: col });
    }
    const transit = [['Apps ↔ edge', 'TLS 1.3 · HSTS · pinning · hybrid post-quantum'], ['Service ↔ service', 'mTLS in the mesh, STRICT mode'], ['Service ↔ data', 'TLS verify-full, short-lived credentials'], ['Video & audio', 'DTLS-SRTP + end-to-end (SFrame)'], ['Partners', 'mTLS + OAuth 2.0 · signed webhooks']];
    transit.forEach(([a, b], i) => {
      const y = 2.2 + i * 0.9;
      box(s, 0.6, y, colW, 0.78, { fill: C.tealLight, line: C.tealLight });
      txt(s, a, 0.78, y + 0.07, colW - 0.3, 0.32, { size: 12.5, bold: true, color: C.ink });
      txt(s, b, 0.78, y + 0.4, colW - 0.3, 0.33, { size: 11, color: C.muted });
    });
    const x2 = 0.6 + colW + 0.17;
    const lv = [['HSM root keys', 'FIPS 140-3 level 3 · never exported', C.petrol, C.white, C.mint], ['KEK per service · env · class', 'in KMS · rotated yearly · every use logged', C.indigoLight, C.ink, C.muted], ['Data key per patient / file / chat', 'AES-256-GCM · cached ≤ 5 min in memory', C.indigoLight, C.ink, C.muted], ['Ciphertext + storage encryption', 'two independent layers', C.tealLight, C.ink, C.muted]];
    lv.forEach(([a, b, bg, tc, dc], i) => {
      const y = 2.2 + i * 1.12;
      box(s, x2, y, colW, 0.86, { fill: bg, line: bg === C.petrol ? C.petrol : C.indigoLine });
      txt(s, a, x2 + 0.18, y + 0.08, colW - 0.3, 0.35, { size: 12.5, bold: true, color: tc });
      txt(s, b, x2 + 0.18, y + 0.45, colW - 0.3, 0.35, { size: 11, color: dc });
      if (i < lv.length - 1) arrow(s, x2 + colW / 2, y + 0.86, x2 + colW / 2, y + 1.12, C.indigo, 1.5);
    });
    txt(s, 'Crypto-shredding: destroy a patient\'s keys at end of retention → every copy unreadable', x2, 6.7 - 0.2, colW, 0.5, { size: 10.5, italic: true, color: C.indigo });
    const x3 = 0.6 + 2 * (colW + 0.17);
    const integ = ['ACID transactions, constraints, optimistic concurrency', 'Append-only history + per-patient hash chains', 'Daily signed anchors in write-once storage', 'SHA-256 on every file · scanned uploads', 'Immutable cross-account backups · weekly restore tests'];
    for (const [i, t] of integ.entries()) {
      const y = 2.2 + i * 0.9;
      box(s, x3, y, colW, 0.78, { fill: C.slateLight, line: C.slateLight });
      s.addImage({ data: await icon('LuCircleCheck', C.teal), x: x3 + 0.15, y: y + 0.22, w: 0.34, h: 0.34 });
      txt(s, t, x3 + 0.6, y, colW - 0.7, 0.78, { size: 12, color: C.text, valign: 'middle' });
    }
  }

  // ---------------------------------------------------------------- 10. Care workflows (Medium)
  {
    const s = newSlide({ note:
`MEDIUM priorities — the care workflows (1.5 min).
Scheduling: a short hold plus a database constraint make double booking impossible; waitlists and an urgent queue serve priority cases, and red-flag symptoms redirect to emergency services. External calendars are read as free/busy only — no patient data ever leaves MedX.
Consultation: a self-hosted WebRTC media server in the EU, with adaptive quality, audio-only fallback and end-to-end encryption for one-to-one calls; chat and file sharing are persisted securely.
Prescription: safety checks against the patient's allergies at signing, a signature in a hardware module, and a revocation that reaches the pharmacy as a critical alert. Masking guarantees pharmacists see only what dispensing requires.` });
    title(s, 'MEDIUM PRIORITY · M1 – M5', 'Care workflows built on the secure core', C.amberDark);
    const cols = [
      ['LuCalendarClock', 'Scheduling & calendars', 'M1 · M5', 'A PostgreSQL exclusion constraint on (doctor, time range) makes overlapping bookings physically impossible.', ['10-min slot hold + database exclusion constraint → no double booking', 'Waitlist offers and an urgent queue for on-call doctors; red flags → call 15 / 112', 'Doctors notified live (WebSocket + push)', 'Google · Microsoft · CalDAV: free/busy only, no patient data written']],
      ['LuVideo', 'Consultation', 'M2', 'Control plane (rooms, tokens) is separated from the media plane (SFU): media never touches business services.', ['Waiting room, short-lived room tokens', 'Self-hosted WebRTC SFU in the EU + TURN on port 443', 'Simulcast, audio-only fallback, auto-reconnect', 'End-to-end encryption for 1-to-1 · no recording', 'Chat with receipts · files scanned & encrypted']],
      ['LuPill', 'Prescription & masking', 'M3 · M4', 'Two state machines — legal status (prescriber) and fulfilment (pharmacy): never "ready" on a revoked prescription.', ['Allergy & interaction checks at signing', 'E-signature in HSM · QR code for pharmacy verification', 'Modify = new signed version; revoke = critical alert to the pharmacy', 'Pharmacists see only what dispensing requires']],
    ];
    for (const [i, [ic, t, tag, key, items]] of cols.entries()) {
      const x = 0.6 + i * 4.1;
      box(s, x, 1.55, 3.93, 5.27, { fill: C.white, line: C.amberLine, shadow: true });
      await iconIn(s, ic, x + 0.22, 1.75, 0.66, C.amberLight, C.amberDark);
      txt(s, t, x + 1.05, 1.75, 2.8, 0.4, { size: 16, bold: true, color: C.ink });
      txt(s, tag, x + 1.05, 2.12, 2.8, 0.3, { size: 11.5, bold: true, color: C.amberDark });
      bullets(s, items, x + 0.25, 2.7, 3.5, 2.55, { size: 12.5, psa: 6 });
      box(s, x + 0.2, 5.3, 3.53, 1.35, { fill: C.amberLight, line: C.amberLight });
      txt(s, 'KEY MECHANISM', x + 0.38, 5.4, 3.2, 0.28, { size: 10, bold: true, color: C.amberDark, cs: 1 });
      txt(s, key, x + 0.38, 5.68, 3.2, 0.92, { size: 11.5, color: C.text });
    }
  }

  // ---------------------------------------------------------------- 11. Ecosystem (Low)
  {
    const s = newSlide({ note:
`LOW priorities — designed now, delivered last (1 min).
These services complete the platform. The pharmacy interface offers a web portal to every pharmacy on day one and an API with signed webhooks for integrated systems.
Notifications have priority lanes so a revocation alert is never stuck behind reminders, and they never contain health data.
Billing uses the payment provider's hosted fields, so card numbers never touch MedX, which keeps us in the lightest PCI scope.
And non-production environments only ever see synthetic or anonymised data.` });
    title(s, 'LOW PRIORITY · L1 – L6', 'Ecosystem services — designed now, delivered last', C.slate);
    const cards = [
      ['LuStore', 'Pharmacy interface', 'L1', 'Until then: printable prescription with a verifiable QR code, usable in any pharmacy', ['Portal for every pharmacy + partner API with signed webhooks', 'Statuses: received → ready → dispensed', 'Inventory adapters, nearby availability']],
      ['LuBellRing', 'Notifications', 'L2 · L3', 'A thin transactional version (confirmations, reminders) ships with the Medium features', ['SMS · e-mail · push · in-app, with priority lanes', 'Preferences, quiet hours, frequency caps', 'Delivery & read tracking — no health data in messages']],
      ['LuCreditCard', 'Billing & refunds', 'L5 · L6', 'Bought, not built: the payment provider carries card data and fraud checks', ['PSP hosted fields → PCI DSS SAQ A', 'Pre-authorise at booking, capture after', 'Ledger, invoices, credit notes, 4-eyes refunds']],
      ['LuFlaskConical', 'Anonymization', 'L4', 'Rule from day one: production health data never leaves production', ['Synthetic patients for dev, staging, demo', 'Anonymisation pipeline with k-anonymity', 'DPO approval · production keys unusable elsewhere']],
    ];
    for (const [i, [ic, t, tag, meanwhile, items]] of cards.entries()) {
      const x = 0.6 + (i % 2) * 6.1;
      const y = 1.55 + Math.floor(i / 2) * 2.68;
      box(s, x, y, 5.93, 2.5, { fill: C.slateLight, line: C.slateLine });
      await iconIn(s, ic, x + 0.22, y + 0.22, 0.62, C.white, C.slate);
      txt(s, t, x + 1.0, y + 0.22, 3.8, 0.4, { size: 16, bold: true, color: C.ink });
      txt(s, tag, x + 1.0, y + 0.58, 3.8, 0.3, { size: 11.5, bold: true, color: C.slate });
      bullets(s, items, x + 0.3, y + 1.0, 5.4, 0.95, { size: 12.5, psa: 3 });
      txt(s, meanwhile, x + 0.3, y + 1.98, 5.4, 0.4, { size: 11, italic: true, color: C.slate });
    }
  }

  // ---------------------------------------------------------------- 12. Data & storage
  {
    const s = newSlide({ note:
`Data model and storage (1.5 min).
Each service owns its database. PostgreSQL is our default because transactions and constraints protect integrity — for example the exclusion constraint that forbids double booking, or the balanced double-entry ledger.
We add a specialised store only when PostgreSQL is a poor fit: Cassandra for append-heavy logs with expiry, object storage for 150 terabytes of documents with write-once retention, Redis and OpenSearch for derived data that can always be rebuilt.
Clinical data is modelled in FHIR and kept 20 years; at the end, crypto-shredding makes it unrecoverable.` });
    title(s, 'DATA MODEL & STORAGE', 'PostgreSQL by default, specialised stores only when justified');
    const H = (t) => ({ text: t, options: { bold: true, color: C.white, fill: { color: C.petrol } } });
    const rows = [
      [H('Component'), H('System of record'), H('Also uses'), H('Why')],
      ['① User Management', 'PostgreSQL', 'Redis (sessions)', 'Identities; e-mail encrypted with blind index'],
      ['② Scheduling', 'PostgreSQL', 'Redis · OpenSearch', 'Exclusion constraint: no double booking'],
      ['③ Consultation', 'PostgreSQL', 'Cassandra (chat, 30 d)', 'Append-heavy chat with expiry'],
      ['④ Patient Records', 'PostgreSQL (FHIR JSONB)', 'Replicas ×3 + DR', 'ACID, versions, hash chain · ~10 TB'],
      ['⑤ Prescription', 'PostgreSQL', 'OpenSearch (drugs)', 'Signed, immutable versions'],
      ['⑥ Pharmacy', 'PostgreSQL + PostGIS', 'Redis (availability)', 'Geo search, status events'],
      ['⑦ Notification', 'Cassandra', 'PostgreSQL · Redis', 'Write-heavy log, 13-month TTL'],
      ['⑧ Billing', 'PostgreSQL', 'Object storage (PDF)', 'Double-entry, append-only ledger'],
      ['Documents', 'Object storage', 'PostgreSQL (metadata)', '~150 TB · versioning · Object Lock'],
      ['Audit trail', 'Object storage (WORM)', 'OpenSearch · SIEM', 'Tamper-evident archive'],
    ].map((r, i) => (i === 0 ? r : r.map((c, j) => ({ text: c, options: { bold: j === 0, color: C.text, fill: { color: i % 2 ? C.white : C.slateLight } } }))));
    s.addTable(rows, { x: 0.6, y: 1.55, w: 8.45, colW: [1.95, 2.1, 1.95, 2.45], fontFace: F, fontSize: 11, border: { type: 'solid', color: C.slateLine, pt: 0.5 }, rowH: 0.43, valign: 'middle', margin: [0.03, 0.08, 0.03, 0.08] });
    box(s, 9.3, 1.55, 3.43, 5.25, { fill: C.tealLight, line: C.tealLine });
    txt(s, 'PRINCIPLES', 9.5, 1.7, 3, 0.3, { size: 11, bold: true, color: C.teal, cs: 1 });
    bullets(s, ['One database per service; references by ID only', 'Classify first: C0 public → C4 sensitive health data', 'Clinical, legal and financial data are append-only', 'Caches and indexes are rebuildable, never the only copy', 'Record kept 20 years, then crypto-shredded', 'Everything encrypted, private, backed up, monitored'], 9.5, 2.1, 3.05, 4.6, { size: 12.5, psa: 9 });
  }

  // ---------------------------------------------------------------- 13. Scalability & performance
  {
    const s = newSlide({ note:
`Scalability and performance (1.5 min).
At year 3 we expect about 5 thousand requests per second at peak, and we design for 10 thousand; 10 thousand simultaneous calls means about 24 gigabits per second through roughly 100 media servers.
The levers: stateless services autoscaled on their real bottleneck, pre-computed availability and summaries, Kafka to absorb peaks, and a clear database path — replicas, partitions, then sharding by patient, and finally regional cells.
The latency budget of the emergency path shows the design leaves a wide margin: about 40 to 70 milliseconds typical against a 300 millisecond objective. Everything is load-tested at twice the forecast peak before each major release.` });
    title(s, 'SCALABILITY & PERFORMANCE', 'Built for 10× growth, tested at 2× peak');
    const st = [['5 k → 10 k', 'API req/s at peak → design capacity'], ['10 k', 'concurrent video calls ≈ 100 SFU nodes'], ['24 Gbit/s', 'media egress at Year-3 peak'], ['150 TB', 'documents in object storage']];
    st.forEach(([n, l], i) => {
      const x = 0.6 + i * 3.08;
      box(s, x, 1.55, 2.9, 1.2, { fill: C.white, line: C.slateLine, shadow: true });
      txt(s, n, x, 1.62, 2.9, 0.6, { size: 26, bold: true, color: C.teal, align: 'center' });
      txt(s, l, x + 0.1, 2.22, 2.7, 0.45, { size: 11, color: C.muted, align: 'center' });
    });
    const lev = [['LuTrendingUp', 'Autoscale on the real bottleneck', 'RPS, connections, queue lag, participants'], ['LuZap', 'Pre-compute the hot paths', 'Availability, emergency summaries'], ['LuWorkflow', 'Absorb peaks with Kafka', 'Priority lanes for notifications'], ['LuDatabase', 'Replicas → partitions → shards', 'Records sharded by patient when triggered'], ['LuRadio', 'Adaptive video', 'Simulcast, audio-first, drain on scale-in'], ['LuGlobe', 'Regional cells', 'Isolated copies per country / population']];
    for (const [i, [ic, t, d]] of lev.entries()) {
      const x = 0.6 + (i % 3) * 4.1;
      const y = 3.0 + Math.floor(i / 3) * 0.95;
      box(s, x, y, 3.93, 0.82, { fill: C.slateLight, line: C.slateLight });
      await iconIn(s, ic, x + 0.14, y + 0.16, 0.5, C.white, C.teal);
      txt(s, t, x + 0.78, y + 0.08, 3.05, 0.33, { size: 12.5, bold: true, color: C.ink });
      txt(s, d, x + 0.78, y + 0.42, 3.05, 0.33, { size: 10.5, color: C.muted });
    }
    txt(s, 'EMERGENCY PATH LATENCY BUDGET (server side)', 0.6, 5.08, 8, 0.3, { size: 11, bold: true, color: C.slate, cs: 1 });
    const segs = [['Gateway', 5, C.slate], ['Policy', 1, C.coral], ['Grant + audit', 15, C.indigo], ['Summary read', 10, C.teal], ['Key + decrypt', 6, C.petrol2]];
    const total = 300;
    const barX = 0.6;
    const barW = 12.13;
    box(s, barX, 5.45, barW, 0.55, { fill: C.slateLight, line: C.slateLine, r: 0.05 });
    let cx = barX;
    const scale = (barW * 0.8) / total; // 300 ms at 80 % of the bar width
    segs.forEach(([l, ms, col]) => {
      const w = Math.max(ms * scale, 0.04);
      s.addShape(pres.shapes.RECTANGLE, { x: cx, y: 5.45, w, h: 0.55, fill: { color: col }, line: { color: col, width: 0.5 } });
      cx += w;
    });
    s.addShape(pres.shapes.LINE, { x: barX + total * scale, y: 5.35, w: 0.001, h: 0.75, line: { color: C.coral, width: 2, dashType: 'dash' } });
    txt(s, '300 ms objective (p95)', barX + total * scale + 0.08, 5.52, 2.3, 0.4, { size: 11, bold: true, color: C.coral, valign: 'middle' });
    txt(s, '≈ 40–70 ms typical', cx + 0.12, 5.52, 2.4, 0.4, { size: 12, bold: true, color: C.petrol, valign: 'middle' });
    txt(s, 'Gateway 5 ms · policy < 1 ms · grant + audit 15 ms · summary read 10 ms · key + decrypt 6 ms — large margin for network jitter and failover', 0.6, 6.12, 12.1, 0.4, { size: 11, color: C.muted, italic: true });
    txt(s, 'Load, soak, chaos and WebRTC tests at 2× forecast peak before every major release · SLOs with error budgets', 0.6, 6.47, 12.1, 0.35, { size: 11, color: C.muted, italic: true });
  }

  // ---------------------------------------------------------------- 14. Resilience & DR
  {
    const s = newSlide({ note:
`Resilience and disaster recovery (1.5 min).
Services are grouped in three criticality tiers. Tier 0 — emergency access and sign-in — targets 99.99% and keeps working even if the whole primary region is lost, because it is active in both regions.
Inside a region, every tier is replicated across three availability zones with a synchronous database standby, so losing a zone loses no data. Across regions, a warm standby receives asynchronous replication with less than a minute of potential loss; care services are back within an hour.
Under extreme load we shed in a fixed order: emergency access and ongoing consultations are protected first; analytics are sacrificed first.` });
    title(s, 'RESILIENCE & DISASTER RECOVERY', 'Resilient by tier — emergency access survives a region loss');
    const H = (t) => ({ text: t, options: { bold: true, color: C.white, fill: { color: C.petrol } } });
    const rows = [
      [H('Tier'), H('Scope'), H('Availability'), H('RPO'), H('RTO (region loss)')],
      [{ text: 'Tier 0', options: { bold: true, color: C.coralDark, fill: { color: C.coralLight } } }, { text: 'Emergency access, sign-in, record reads', options: { fill: { color: C.coralLight } } }, { text: '99.99 %', options: { bold: true, fill: { color: C.coralLight } } }, { text: '0 in-region · ≤ 1 min', options: { fill: { color: C.coralLight } } }, { text: '≤ 15 min · active in both regions', options: { fill: { color: C.coralLight } } }],
      [{ text: 'Tier 1', options: { bold: true } }, 'Records writes, consultation, scheduling, prescription', { text: '99.95 %', options: { bold: true } }, '0 in-region · ≤ 1 min', '≤ 1 h'],
      [{ text: 'Tier 2', options: { bold: true } }, 'Pharmacy, notification, billing, analytics', { text: '99.9 %', options: { bold: true } }, '≤ 5 min', '≤ 4 h'],
    ];
    s.addTable(rows, { x: 0.6, y: 1.6, w: 6.6, colW: [0.72, 2.0, 1.05, 1.35, 1.48], fontFace: F, fontSize: 11, color: C.text, border: { type: 'solid', color: C.slateLine, pt: 0.5 }, rowH: [0.42, 0.75, 0.75, 0.75], valign: 'middle', margin: [0.04, 0.08, 0.04, 0.08] });
    // regions diagram
    box(s, 7.5, 1.6, 2.5, 3.1, { fill: C.tealLight, line: C.teal, lw: 1.5 });
    txt(s, 'PRIMARY · PARIS', 7.6, 1.68, 2.3, 0.3, { size: 11, bold: true, color: C.teal });
    ['3 availability zones', 'All services', 'DB primary + sync standby', 'Kafka × 3 brokers'].forEach((t, i) => chip(s, t, 7.65, 2.1 + i * 0.62, 2.2, 0.5, { size: 10.5, fill: C.white, line: C.tealLine }));
    box(s, 10.23, 1.6, 2.5, 3.1, { fill: C.indigoLight, line: C.indigo, lw: 1.5, dash: 'dash' });
    txt(s, 'DR · FRANKFURT', 10.33, 1.68, 2.3, 0.3, { size: 11, bold: true, color: C.indigo });
    [['Emergency Access ACTIVE', C.coralLight, C.coral], ['Identity provider ACTIVE', C.coralLight, C.coral], ['DB replicas (lag < 1 s)', C.white, C.indigoLine], ['Services scaled down', C.white, C.indigoLine]].forEach(([t, f, l], i) => chip(s, t, 10.38, 2.1 + i * 0.62, 2.2, 0.5, { size: 10.5, fill: f, line: l, bold: i < 2, color: i < 2 ? C.coralDark : C.text }));
    arrow(s, 10.0, 3.35, 10.23, 3.35, C.indigo, 2);
    txt(s, 'async replication · encrypted', 7.5, 4.8, 5.23, 0.3, { size: 10.5, italic: true, color: C.indigo, align: 'center' });
    txt(s, 'LOAD-SHEDDING ORDER UNDER EXTREME LOAD (protected first → shed first)', 0.6, 5.3, 12, 0.3, { size: 11, bold: true, color: C.slate, cs: 1 });
    const order = ['Emergency access', 'Ongoing consultations', 'Clinical writes', 'Booking', 'Notifications', 'Analytics'];
    const ow = (12.13 - 5 * 0.25) / 6;
    order.forEach((t, i) => {
      const x = 0.6 + i * (ow + 0.25);
      const col = i === 0 ? C.coral : i < 3 ? C.teal : C.grey;
      box(s, x, 5.7, ow, 0.9, { fill: C.white, line: col, lw: 1.5 });
      num(s, x + 0.12, 5.94, i + 1, 0.4, col);
      txt(s, t, x + 0.6, 5.7, ow - 0.66, 0.9, { size: 12, bold: true, color: C.ink, valign: 'middle' });
      if (i < order.length - 1) arrow(s, x + ow + 0.02, 6.15, x + ow + 0.23, 6.15, C.slate, 1.25);
    });
  }

  // ---------------------------------------------------------------- 15. Compliance & privacy
  {
    const s = newSlide({ note:
`Security and compliance (1.5 min).
Health data puts MedX under GDPR article 9: we need a DPIA before launch, a DPO, and 72-hour breach notification. In France, hosting requires HDS certification, so we only use HDS-certified regions in the European Economic Area. Telemedicine rules, NIS2, eIDAS for signatures, PCI DSS for payments and the European Health Data Space are covered by design, and a separate US cell would make MedX HIPAA-ready.
Privacy by design is visible in concrete rules: no health data in SMS, e-mails, calendars or logs; production data never leaves production; records are crypto-shredded at the end of retention; and patients can see who accessed their record.` });
    title(s, 'SECURITY & COMPLIANCE', 'Compliance by design, not by audit');
    const regs = [
      ['GDPR', 'Health data (art. 9) · DPIA · DPO · 72-h breach notice'],
      ['HDS', 'Certified hosting · data stays in the EEA'],
      ['Telemedicine rules', 'Identified patient, consent, report in the record'],
      ['NIS2', 'Risk measures · incident reports 24 h / 72 h'],
      ['eIDAS', 'Prescription signatures · qualified timestamps'],
      ['PCI DSS', 'SAQ A: card data only at the PSP'],
      ['EHDS', 'Patient access & exchange · access logging'],
      ['HIPAA-ready', 'Separate US cell, same controls, BAAs'],
    ];
    regs.forEach(([t, d], i) => {
      const x = 0.6 + (i % 2) * 3.6;
      const y = 1.55 + Math.floor(i / 2) * 1.32;
      box(s, x, y, 3.45, 1.18, { fill: C.white, line: C.slateLine, shadow: true });
      txt(s, t, x + 0.2, y + 0.12, 3.1, 0.35, { size: 15, bold: true, color: C.petrol });
      txt(s, d, x + 0.2, y + 0.5, 3.1, 0.62, { size: 11.5, color: C.muted });
    });
    box(s, 7.95, 1.55, 4.78, 5.15, { fill: C.tealLight, line: C.tealLine });
    await iconIn(s, 'LuShieldCheck', 8.15, 1.72, 0.5, C.white, C.teal);
    txt(s, 'Privacy by design', 8.8, 1.76, 3.8, 0.4, { size: 16, bold: true, color: C.petrol });
    bullets(s, ['No health data in SMS, e-mail, push, calendars, events or logs', 'Production data never leaves production — synthetic data elsewhere', '20-year retention, then crypto-shredding', 'Patients see who accessed their record', 'STRIDE threat model: 15 top threats mitigated', 'Pentest before launch, then yearly; ISO 27001 in year 1–2'], 8.2, 2.45, 4.35, 4.1, { size: 13, psa: 9 });
  }

  // ---------------------------------------------------------------- 16. Trade-offs
  {
    const s = newSlide({ note:
`Key decisions and trade-offs (1.5 min).
Every decision has a cost, and we chose the cost that MedX's priorities make acceptable.
Microservices in security zones cost operational complexity, but isolate health data and the emergency path. Break-glass without pre-approval accepts that misuse is possible — it is detected, reviewed and sanctioned — because a pre-approval would be too slow at 3 am in an emergency room. Per-patient encryption adds key management; append-only history costs about 30% more storage; a self-hosted video server means operating media infrastructure and no recording; and we keep full active-active only for Tier 0 to control cost.` });
    title(s, 'DECISIONS & TRADE-OFFS', 'What we chose — and what we accepted to give up');
    const H = (t) => ({ text: t, options: { bold: true, color: C.white, fill: { color: C.petrol } } });
    const data = [
      ['Microservices in security zones', 'Modular monolith', 'H1 · H3', 'Operational complexity'],
      ['Break-glass + post-hoc review', 'Supervisor pre-approval', 'H3', 'Possible misuse — detected & sanctioned'],
      ['Per-patient envelope encryption', 'Disk encryption only', 'H1', 'Key management, ~1 ms per request'],
      ['Append-only history + hash chains', 'In-place updates', 'H2 · H5', '~30 % more storage'],
      ['Self-hosted SFU + end-to-end encryption', 'Video CPaaS', 'H1 · M2', 'Media operations, no recording'],
      ['Active-active for Tier 0 only', 'Full active-active', 'H3', 'Tier 1–2 recover in 1–4 h'],
      ['PSP hosted payment fields', 'Handling card data', 'L5', 'Less control over payment UI'],
    ];
    const rows = [[H('We chose'), H('Instead of'), H('Because'), H('Cost we accept')]].concat(
      data.map((r, i) => r.map((c, j) => ({ text: c, options: { bold: j === 0, color: j === 2 ? C.coralDark : C.text, fill: { color: i % 2 ? C.slateLight : C.white } } })))
    );
    s.addTable(rows, { x: 0.6, y: 1.6, w: 12.13, colW: [3.9, 2.9, 1.43, 3.9], fontFace: F, fontSize: 13, border: { type: 'solid', color: C.slateLine, pt: 0.5 }, rowH: 0.6, valign: 'middle', margin: [0.04, 0.12, 0.04, 0.12] });
    txt(s, 'Full decision records (14 ADRs) with context, alternatives and consequences: docs/06-architecture-decisions.md', 0.6, 6.55, 12.1, 0.35, { size: 11, italic: true, color: C.muted });
  }

  // ---------------------------------------------------------------- 17. Roadmap
  {
    const s = newSlide({ note:
`Roadmap (1 min).
We deliver in the order of MedX's priorities. Phase 0 builds the platform foundations. Phase 1 delivers the secure clinical core — identity, records, integrity, emergency access and the DR region — and ends with a security gate: DPIA, penetration test and DR drill.
Phase 2 adds the care workflows and ends with a pilot with partner clinics. Phase 3 brings pharmacies, notifications tracking, billing and anonymisation, then the public launch. Each phase has measured exit criteria, not declared ones.` });
    title(s, 'ROADMAP', 'Delivered in the order of MedX priorities');
    const ph = [
      ['Phase 0', 'Foundations', '≈ 2 months', C.slate, C.slateLight, 'Exit: all built from code, 100 % of stores encrypted', ['Landing zone, Kubernetes, mesh', 'KMS/HSM, Vault, audit, Kafka', 'CI/CD with signed images']],
      ['Phase 1', 'Secure clinical core', 'HIGH · ≈ 4 months', C.coral, C.coralLight, 'Exit: authz tests green, break-glass < 300 ms, DR drill', ['Identity, OPA policies', 'Records, integrity, encryption', 'Emergency access + DR region']],
      ['Phase 2', 'Care workflows', 'MEDIUM · ≈ 4 months', C.amberDark, C.amberLight, 'Exit: load test at 2× peak, video quality KPIs met', ['Scheduling + calendars', 'Video, chat, files', 'Prescriptions + masking']],
      ['Phase 3', 'Ecosystem', 'LOW · ≈ 4 months', C.slate, C.slateLight, 'Exit: PCI SAQ A attested, ledger reconciled', ['Pharmacy interface', 'Notifications, preferences', 'Billing, refunds, anonymisation']],
      ['Phase 4', 'Scale & expand', 'continuous', C.teal, C.tealLight, 'Triggered by measured growth and new markets', ['National e-health services', 'Sharding, regional cells', 'ISO 27001, US cell']],
    ];
    const w = 2.3;
    const gap = 0.16;
    s.addShape(pres.shapes.LINE, { x: 0.6, y: 2.05, w: 12.13, h: 0.001, line: { color: C.slateLine, width: 2, endArrowType: 'triangle' } });
    ph.forEach(([p, t, sub, col, bg, exit, items], i) => {
      const x = 0.6 + i * (w + gap);
      s.addShape(pres.shapes.OVAL, { x: x + w / 2 - 0.13, y: 1.92, w: 0.26, h: 0.26, fill: { color: col }, line: { color: C.white, width: 2 } });
      box(s, x, 2.4, w, 3.35, { fill: bg, line: col, lw: 1.25 });
      txt(s, p, x + 0.18, 2.52, w - 0.3, 0.3, { size: 12, bold: true, color: col });
      txt(s, t, x + 0.18, 2.82, w - 0.3, 0.4, { size: 16, bold: true, color: C.ink });
      txt(s, sub, x + 0.18, 3.22, w - 0.3, 0.3, { size: 11, bold: true, color: col });
      bullets(s, items, x + 0.2, 3.7, w - 0.35, 1.3, { size: 12, psa: 6 });
      txt(s, exit, x + 0.18, 5.05, w - 0.3, 0.6, { size: 10.5, italic: true, color: col });
    });
    const gates = [[1, 'Gate: DPIA · pentest · DR drill'], [2, 'Pilot with partner clinics'], [3, 'Public launch']];
    gates.forEach(([i, t]) => {
      const x = 0.6 + i * (w + gap);
      box(s, x, 5.95, w, 0.62, { fill: C.petrol, line: C.petrol, r: 0.1 });
      txt(s, t, x + 0.08, 5.95, w - 0.16, 0.62, { size: 11.5, bold: true, color: C.white, align: 'center', valign: 'middle' });
    });
  }

  // ---------------------------------------------------------------- 18. Summary
  {
    const s = newSlide({ dark: true, note:
`Conclusion (30 s).
To summarise: security is the foundation — health data is encrypted twice, every access is authorised and audited, and history cannot be rewritten. Emergency access works in seconds, even during a regional outage, and remains accountable. And the platform scales by design, from launch to ten times the load, through events, autoscaling, sharding and regional cells.
All the details — component designs, data models, capacity math, security controls and decision records — are in the repository. Thank you; I'm happy to take your questions.` });
    txt(s, 'IN SUMMARY', 0.8, 0.8, 8, 0.4, { size: 14, bold: true, color: C.mint, cs: 3 });
    txt(s, 'A zero-trust, event-driven platform where health data is encrypted twice, history cannot be rewritten, and emergency access works in seconds.', 0.8, 1.25, 11.6, 1.3, { size: 26, bold: true, color: C.white });
    const take = [
      ['LuShieldCheck', 'Security is the foundation', 'TLS 1.3 / mTLS everywhere · per-patient keys in HSM · RBAC + ABAC · immutable audit', C.coral],
      ['LuSiren', 'Emergency access in seconds', 'Break-glass on an isolated Tier-0 path, active in two regions, reviewed within 72 h', C.coral],
      ['LuTrendingUp', 'Scales by design', 'Events, autoscaling, replicas → shards → cells · tested at 2× peak', C.teal],
    ];
    for (const [i, [ic, t, d, col]] of take.entries()) {
      const x = 0.8 + i * 3.95;
      box(s, x, 3.05, 3.7, 2.45, { fill: C.petrol2, line: '2B7285', r: 0.1 });
      await iconIn(s, ic, x + 0.25, 3.28, 0.7, col, C.white);
      txt(s, t, x + 0.25, 4.1, 3.3, 0.45, { size: 17, bold: true, color: C.white });
      txt(s, d, x + 0.25, 4.55, 3.25, 0.9, { size: 12.5, color: C.mint });
    }
    txt(s, 'Questions?', 0.8, 5.95, 5, 0.6, { size: 28, bold: true, color: C.white });
    txt(s, 'Full design package: docs/ · diagrams/ · presentation/', 0.8, 6.55, 8, 0.35, { size: 13, color: C.mint });
  }

  // ---------------------------------------------------------------- Appendix
  const appendix = [
    ['APPENDIX A1', 'Detailed high-level architecture', 'medx-high-level-architecture.png', 'Detailed container view with every component, zone, platform service, datastore and external system. Use it to answer detailed questions; zoom in PowerPoint (the image is high resolution).'],
    ['APPENDIX A2', 'System context (C4 level 1)', 'medx-system-context.png', 'Who uses MedX and which external systems it depends on.'],
    ['APPENDIX A3', 'Deployment & security zones', 'medx-deployment-view.png', 'Primary region with three availability zones, warm-standby DR region, node pools per security zone, and one cloud account per environment.'],
    ['APPENDIX A4', 'Emergency access — detailed flow', 'medx-emergency-access-flow.png', 'Five steps, guardrails and resilience mechanisms of the break-glass capability.'],
    ['APPENDIX A5', 'Encryption in transit & at rest', 'medx-encryption-keys.png', 'Every encrypted channel and the envelope-encryption key hierarchy.'],
  ];
  for (const [k, t, file, note] of appendix) {
    const s = newSlide({ note });
    title(s, k, t, C.slate);
    const img = path.join(DIAG, file);
    const meta = await sharp(img).metadata();
    const maxW = 12.13;
    const maxH = 5.6;
    let w = maxW;
    let h = (meta.height / meta.width) * w;
    if (h > maxH) {
      h = maxH;
      w = (meta.width / meta.height) * h;
    }
    s.addImage({ path: img, x: 0.6 + (maxW - w) / 2, y: 1.4, w, h });
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const out = path.join(OUT_DIR, 'MedX-Technical-Solution.pptx');
  await pres.writeFile({ fileName: out });
  console.log('written', out, `${slideNo} slides`);
}

// Speaker notes are also exported as Markdown for rehearsal.
function exportNotes() {
  const md = [
    '# MedX — Presentation Script & Speaker Notes',
    '',
    '> Brief presentation (≈ 15–18 minutes + questions). One section per slide; the same text is embedded as speaker',
    '> notes in `MedX-Technical-Solution.pptx`. Slides 19–23 (appendix A1–A5) are backup material for questions.',
    '',
  ];
  for (const { no, note } of notes) {
    const [first, ...rest] = note.split('\n');
    md.push(`## Slide ${no} — ${first.replace(/\.$/, '')}`, '', rest.join('\n').trim() || first, '');
  }
  fs.writeFileSync(path.join(OUT_DIR, 'speaker-notes.md'), md.join('\n'));
  console.log('written speaker-notes.md');
}

build()
  .then(exportNotes)
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
