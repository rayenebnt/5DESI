// High-priority requirement H1 — encryption in transit and at rest (key hierarchy).
const { C, svgDoc, rect, text, arrow, lock, box } = require('./lib');

const W = 1920;
const H = 1060;

function node({ x, y, w, h, title, sub, fill = C.white, stroke = C.slateLine, tf = C.ink, sf = C.muted }) {
  let o = rect({ x, y, w, h, r: 12, fill, stroke, sw: 1.6, shadow: true });
  o += text({ x: x + w / 2, y: y + (sub ? h / 2 - 3 : h / 2 + 5), lines: [{ t: title, weight: 700 }], size: 15, fill: tf, anchor: 'middle', maxw: w - 16 });
  if (sub) o += text({ x: x + w / 2, y: y + h / 2 + 17, lines: [sub], size: 12, fill: sf, anchor: 'middle', maxw: w - 16 });
  return o;
}

function pill({ x, y, label, color = C.teal, bg = C.white, size = 12.5 }) {
  const w = label.length * size * 0.56 + 22;
  return rect({ x: x - w / 2, y: y - 13, w, h: 26, r: 13, fill: bg, stroke: color, sw: 1.4 }) + text({ x, y: y + 4.5, lines: [{ t: label, weight: 700 }], size, fill: color, anchor: 'middle' });
}

function build() {
  let b = '';
  b += text({ x: 40, y: 54, lines: [{ t: 'Encryption in Transit & at Rest', weight: 800 }], size: 30, fill: C.ink });
  b += text({ x: 40, y: 84, lines: ['High-priority requirement H1 · every hop encrypted · two independent layers at rest · keys generated and held in HSM-backed KMS'], size: 16, fill: C.muted });

  // ---------------- In transit ----------------
  b += rect({ x: 40, y: 110, w: 900, h: 920, r: 18, fill: '#FBFEFD', stroke: C.teal, sw: 1.8 });
  b += lock({ x: 62, y: 126, color: C.teal, s: 1.1 });
  b += text({ x: 90, y: 146, lines: [{ t: 'IN TRANSIT', weight: 800 }], size: 16, fill: C.teal });
  b += text({ x: 210, y: 146, lines: ['no plaintext hop, inside or outside the platform'], size: 14, fill: C.muted });

  const links = [
    { from: 'Patient / doctor app', to: 'Edge (WAF · API Gateway)', p: 'TLS 1.3', note: 'HSTS · modern AEAD ciphers only · certificate pinning in mobile apps' },
    { from: 'Edge', to: 'Microservices', p: 'mTLS', note: 'Service mesh · SPIFFE workload identities · certificates rotated every 24 h' },
    { from: 'Microservices', to: 'Databases · Kafka · Redis', p: 'TLS (verify-full)', note: 'Dynamic, short-lived database credentials issued by Vault' },
    { from: 'Patient ⇄ doctor', to: 'SFU media node', p: 'DTLS-SRTP + E2EE', note: 'SRTP is mandatory in WebRTC · end-to-end SFrame layer when both clients support it' },
    { from: 'Pharmacy systems', to: 'Partner API', p: 'mTLS + OAuth 2.0', note: 'Client-certificate-bound tokens · outbound webhooks signed (HMAC-SHA256)' },
    { from: 'Microservices', to: 'External providers', p: 'TLS 1.2+', note: 'Certificate validation · no health data in payloads (SMS, e-mail, calendars)' },
    { from: 'Primary region', to: 'DR region', p: 'TLS + KMS', note: 'Replication streams encrypted in transit and re-encrypted at rest' },
  ];
  links.forEach((l, i) => {
    const y = 176 + i * 120;
    b += node({ x: 64, y, w: 250, h: 58, title: l.from });
    b += node({ x: 666, y, w: 250, h: 58, title: l.to });
    b += arrow({ points: [[318, y + 29], [662, y + 29]], color: C.teal, sw: 2.4, head: 'both', marker: 'arr-teal' });
    b += pill({ x: 490, y: y + 29, label: l.p, color: C.teal });
    b += text({ x: 64, y: y + 84, lines: [l.note], size: 13, fill: C.muted, maxw: 852 });
  });

  // ---------------- At rest ----------------
  const X = 980;
  b += rect({ x: X, y: 110, w: 900, h: 920, r: 18, fill: '#FCFCFF', stroke: C.indigo, sw: 1.8 });
  b += lock({ x: X + 22, y: 126, color: C.indigo, s: 1.1 });
  b += text({ x: X + 50, y: 146, lines: [{ t: 'AT REST — ENVELOPE ENCRYPTION', weight: 800 }], size: 16, fill: C.indigo });

  // Level labels
  const lv = [
    { y: 176, l: 'HSM', d: 'FIPS 140-3 level 3' },
    { y: 330, l: 'KEK', d: 'in KMS, no export' },
    { y: 484, l: 'DEK', d: 'AES-256-GCM' },
    { y: 638, l: 'DATA', d: 'ciphertext only' },
  ];
  lv.forEach((v) => {
    b += rect({ x: X + 22, y: v.y, w: 118, h: 86, r: 12, fill: C.indigoBg, stroke: C.indigoLine, sw: 1.2 });
    b += text({ x: X + 81, y: v.y + 38, lines: [{ t: v.l, weight: 800 }], size: 20, fill: C.indigo, anchor: 'middle' });
    b += text({ x: X + 81, y: v.y + 60, lines: [v.d], size: 11, fill: C.muted, anchor: 'middle', maxw: 110 });
  });

  // HSM root
  b += node({ x: X + 330, y: 176, w: 420, h: 86, title: 'Root keys in HSM', sub: 'generated in hardware · never leave it · quorum-controlled', fill: C.petrol, stroke: C.petrol, tf: C.white, sf: '#BFE3DF' });
  // KEKs
  const keks = [
    ['Records KEK', 'per service · env · class'],
    ['Documents KEK', 'rotated yearly'],
    ['Consultation KEK', 'every use logged'],
  ];
  const kw = 228;
  keks.forEach(([t, s], i) => {
    const x = X + 170 + i * (kw + 16);
    b += node({ x, y: 330, w: kw, h: 86, title: t, sub: s, stroke: C.indigoLine });
    b += arrow({ points: [[X + 540, 262], [X + 540, 296], [x + kw / 2, 296], [x + kw / 2, 328]], color: C.indigo, sw: 1.8, marker: 'arr-indigo' });
  });
  // DEKs
  const deks = [
    ['DEK per patient', 'clinical data'],
    ['DEK per file', 'documents'],
    ['DEK per consultation', 'chat messages'],
  ];
  deks.forEach(([t, s], i) => {
    const x = X + 170 + i * (kw + 16);
    b += node({ x, y: 484, w: kw, h: 86, title: t, sub: s, stroke: C.indigoLine });
    b += arrow({ points: [[x + kw / 2, 416], [x + kw / 2, 482]], color: C.indigo, sw: 1.8, marker: 'arr-indigo', label: ['wraps'], labelAt: [x + kw / 2, 449], labelFill: C.indigo, labelSize: 11 });
  });
  const data = [
    ['Sensitive FHIR fields', 'notes · national ID'],
    ['Medical documents', 'object storage'],
    ['Chat history', 'hot store + archive'],
  ];
  data.forEach(([t, s], i) => {
    const x = X + 170 + i * (kw + 16);
    b += node({ x, y: 638, w: kw, h: 86, title: t, sub: s, fill: C.tealBg, stroke: C.tealLine });
    b += arrow({ points: [[x + kw / 2, 570], [x + kw / 2, 636]], color: C.indigo, sw: 1.8, marker: 'arr-indigo', label: ['encrypts'], labelAt: [x + kw / 2, 603], labelFill: C.indigo, labelSize: 11 });
  });

  // Notes
  const notes = [
    ['Second, independent layer', 'Disks, databases, object storage, Kafka, Redis and backups are also encrypted (AES-256, KMS keys).'],
    ['Crypto-shredding', "At the end of the retention period, destroying a patient's DEK makes every copy unreadable — including replicas and backups."],
    ['Blast radius & performance', 'One compromised DEK exposes one patient, not the database. Unwrapped DEKs are cached in memory ≤ 5 min to limit KMS calls.'],
  ];
  notes.forEach(([t, s], i) => {
    const y = 756 + i * 88;
    b += rect({ x: X + 22, y, w: 856, h: 76, r: 12, fill: C.white, stroke: C.slateLine, sw: 1.2 });
    b += text({ x: X + 42, y: y + 28, lines: [{ t, weight: 800 }], size: 14.5, fill: C.ink });
    b += text({ x: X + 42, y: y + 52, lines: [s], size: 12.8, fill: C.muted, maxw: 820 });
  });

  return svgDoc({ width: W, height: H, body: b, title: 'MedX — Encryption in Transit & at Rest' });
}

module.exports = { name: 'medx-encryption-keys', title: 'MedX — Encryption in Transit & at Rest', width: W, height: H, build };
