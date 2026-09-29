// System context (C4 level 1): who uses MedX and which external systems it depends on.
const { C, svgDoc, rect, text, arrow, person } = require('./lib');

const W = 1800;
const H = 940;

function actor({ x, y, w, h, title, sub, color = C.petrol, bg = C.white, stroke = C.slateLine }) {
  let o = rect({ x, y, w, h, r: 14, fill: bg, stroke, sw: 1.6, shadow: true });
  o += `<circle cx="${x + 36}" cy="${y + h / 2}" r="22" fill="${color}" opacity="0.12"/>`;
  o += person({ cx: x + 36, cy: y + h / 2 + 2, color, s: 1 });
  o += text({ x: x + 70, y: y + h / 2 - 6, lines: [{ t: title, weight: 700 }], size: 17, fill: C.ink, maxw: w - 84 });
  o += text({ x: x + 70, y: y + h / 2 + 16, lines: [sub], size: 13, fill: C.muted, maxw: w - 84 });
  return o;
}

function ext({ x, y, w, h, title, sub }) {
  let o = rect({ x, y, w, h, r: 14, fill: '#FBFCFD', stroke: '#94A3B8', sw: 1.5, dash: '6 4' });
  o += text({ x: x + 18, y: y + h / 2 - 6, lines: [{ t: title, weight: 700 }], size: 17, fill: C.ink, maxw: w - 36 });
  o += text({ x: x + 18, y: y + h / 2 + 16, lines: [sub], size: 13, fill: C.muted, maxw: w - 36 });
  return o;
}

function build() {
  let b = '';
  b += text({ x: 40, y: 56, lines: [{ t: 'MedX — System Context', weight: 800 }], size: 30, fill: C.ink });
  b += text({ x: 40, y: 86, lines: ['C4 level 1 · who uses MedX, what for, and which external systems it relies on'], size: 16, fill: C.muted });

  // Central system
  const cx = 660;
  const cy = 300;
  const cw = 480;
  const ch = 400;
  b += rect({ x: cx, y: cy, w: cw, h: ch, r: 26, fill: C.petrol, stroke: C.petrol, sw: 2, shadow: true });
  b += text({ x: cx + cw / 2, y: cy + 66, lines: [{ t: 'MedX Health Platform', weight: 800 }], size: 30, fill: C.white, anchor: 'middle' });
  b += text({ x: cx + cw / 2, y: cy + 96, lines: ['HDS-certified cloud · EU data residency'], size: 15, fill: '#BFE3DF', anchor: 'middle' });
  const pillars = [
    ['Telehealth consultations', 'booking · video · chat · files'],
    ['Patient records', 'FHIR record · emergency access'],
    ['Prescription tracking', 'e-prescription · pharmacy fulfilment'],
  ];
  pillars.forEach(([t, s], i) => {
    const py = cy + 130 + i * 84;
    b += rect({ x: cx + 40, y: py, w: cw - 80, h: 68, r: 12, fill: C.petrol2, stroke: '#2B7285', sw: 1.2 });
    b += text({ x: cx + cw / 2, y: py + 29, lines: [{ t, weight: 700 }], size: 17, fill: C.white, anchor: 'middle' });
    b += text({ x: cx + cw / 2, y: py + 51, lines: [s], size: 13.5, fill: '#BFE3DF', anchor: 'middle' });
  });

  // Actors (left)
  const actors = [
    { title: 'Patients & proxies', sub: 'Mobile & web apps', rel: ['Book, consult, read', 'records, pay'] },
    { title: 'Doctors', sub: 'Web portal & mobile', rel: ['Agenda, consultations,', 'notes, prescriptions'] },
    { title: 'Emergency clinicians', sub: 'Holders of emergency entitlement', rel: ['Break-glass access', 'to critical data'], color: C.coral, bg: C.coralBg, stroke: '#F4B6A3' },
    { title: 'Pharmacy staff', sub: 'Pharmacy portal or PMS', rel: ['Receive prescriptions,', 'update status'] },
    { title: 'MedX operations', sub: 'Support · DPO · auditors', rel: ['Support, audits,', 'access reviews'] },
  ];
  actors.forEach((a, i) => {
    const y = 150 + i * 150;
    b += actor({ x: 40, y, w: 330, h: 96, ...a });
    const ay = y + 48;
    const ty = i === 2 ? ay : cy + 60 + i * 70;
    const vx = 600 - Math.min(i, 4 - i) * 20;
    b += arrow({ points: [[372, ay], [vx, ay], [vx, ty], [cx - 2, ty]], color: a.color === C.coral ? C.coral : C.line, sw: 2, marker: a.color === C.coral ? 'arr-coral' : 'arr-ink' });
    b += text({ x: 382, y: ay - 26, maxw: vx - 390, lines: a.rel, size: 12.5, fill: a.color === C.coral ? '#8C2A10' : C.muted, lh: 1.25 });
  });

  // External systems (right)
  const exts = [
    { title: 'Identity federation', sub: 'Pro Santé Connect · FranceConnect', rel: ['Professional & patient', 'identity (OIDC)'] },
    { title: 'External calendars', sub: 'Google · Microsoft 365 · CalDAV', rel: ['Free/busy sync', '(OAuth 2.0)'] },
    { title: 'Drug database', sub: 'Reference drug & interaction data', rel: ['Interaction, allergy', '& dosage checks'] },
    { title: 'National health services', sub: 'e-Prescription · INS · shared record', rel: ['FHIR exchanges', '(after v1)'] },
    { title: 'Pharmacy systems', sub: 'Pharmacy software · inventory', rel: ['Prescriptions & stock', '(REST · webhooks)'] },
    { title: 'Messaging providers', sub: 'SMS · e-mail · push (APNs/FCM)', rel: ['Notifications without', 'health details'] },
    { title: 'Payment service provider', sub: 'Stripe / Adyen · PCI DSS L1', rel: ['Payments, refunds', '(tokenized)'] },
  ];
  exts.forEach((e, i) => {
    const y = 124 + i * 112;
    b += ext({ x: 1440, y, w: 320, h: 84, ...e });
    const ay = y + 42;
    const ty = cy + 40 + i * 54;
    const vx = 1200 + Math.min(i, 6 - i) * 20;
    b += arrow({ points: [[cx + cw + 2, ty], [vx, ty], [vx, ay], [1438, ay]], color: C.slate, sw: 1.8, marker: 'arr-slate', head: 'both' });
    b += text({ x: 1262, y: ay - 22, lines: e.rel, size: 12, fill: C.muted, lh: 1.2, maxw: 172 });
  });

  // Footer
  b += text({ x: 40, y: 910, lines: ['Solid boxes: people · dashed boxes: external systems outside the MedX trust boundary · every connection is encrypted (TLS 1.3 / mTLS)'], size: 13.5, fill: C.faint });
  return svgDoc({ width: W, height: H, body: b, title: 'MedX — System Context' });
}

module.exports = { name: 'medx-system-context', title: 'MedX — System Context', width: W, height: H, build };
