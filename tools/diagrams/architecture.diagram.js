// Deliverable 1 — High-level architecture (container view).
const { C, svgDoc, rect, text, box, zone, arrow, cylinder, person, lock, priorityBadge } = require('./lib');

const W = 1920;
const H = 1140;

function actorCard({ x, y, w, h, title, sub, color = C.petrol, bg = C.white, stroke = C.slateLine }) {
  let o = rect({ x, y, w, h, r: 12, fill: bg, stroke, sw: 1.5, shadow: true });
  o += `<circle cx="${x + 26}" cy="${y + 28}" r="17" fill="${color}" opacity="0.12"/>`;
  o += person({ cx: x + 26, cy: y + 30, color, s: 0.8 });
  o += text({ x: x + 50, y: y + 25, lines: title.map((t) => ({ t, weight: 700 })), size: 14, fill: C.ink, maxw: w - 58, lh: 1.15 });
  o += text({ x: x + 12, y: y + 68, lines: sub, size: 11.5, fill: C.muted, maxw: w - 20, lh: 1.3 });
  return o;
}

function externalBox({ x, y, w, h, title, sub, tag }) {
  let o = rect({ x, y, w, h, r: 10, fill: C.white, stroke: '#94A3B8', sw: 1.4, dash: '6 4', shadow: false });
  o += text({ x: x + 14, y: y + 25, lines: [{ t: title, weight: 700 }], size: 15, fill: C.ink, maxw: w - 28 });
  o += text({ x: x + 14, y: y + 45, lines: [sub], size: 12, fill: C.muted, maxw: w - 28 });
  o += text({ x: x + 14, y: y + 65, lines: [{ t: tag, weight: 700 }], size: 11.5, fill: C.teal, maxw: w - 28 });
  return o;
}

function build() {
  let b = '';

  // Title
  b += text({ x: 32, y: 50, lines: [{ t: 'MedX — High-Level Architecture', weight: 800 }], size: 28, fill: C.ink });
  b += text({ x: 32, y: 78, lines: ['Container view · microservices by bounded context · event-driven · zero trust · every link encrypted'], size: 15, fill: C.muted });

  // MedX platform trust boundary
  b += rect({ x: 206, y: 102, w: 1252, h: 1022, r: 18, fill: 'none', stroke: C.petrol, sw: 1.6, dash: '8 6' });
  b += rect({ x: 222, y: 92, w: 700, h: 22, r: 11, fill: C.petrol, stroke: C.petrol, sw: 1 });
  b += text({ x: 236, y: 107.5, lines: [{ t: 'MEDX PLATFORM  ·  HDS-certified cloud  ·  primary EU region (3 AZs) + warm-standby DR region', weight: 700 }], size: 11.5, fill: C.white });

  // ---------- Users ----------
  b += text({ x: 24, y: 144, lines: [{ t: 'USERS', weight: 800 }], size: 12.5, fill: C.petrol });
  const actors = [
    { title: ['Patients &', 'proxies'], sub: ['Mobile app · web app', 'Parents, caregivers'] },
    { title: ['Doctors'], sub: ['Web portal · mobile', 'Verified licence'] },
    { title: ['Emergency', 'clinicians'], sub: ['Break-glass access', 'Step-up MFA'], color: C.coral, bg: C.coralBg, stroke: '#F4B6A3' },
    { title: ['Pharmacy', 'staff'], sub: ['Web portal, or PMS', 'via partner API'] },
    { title: ['MedX', 'operations'], sub: ['Support · DPO · audit', 'Zero-trust access'] },
  ];
  actors.forEach((a, i) => {
    const y = 156 + i * 118;
    b += actorCard({ x: 24, y, w: 160, h: 104, ...a });
    const ay = y + 52;
    b += arrow({ points: [[186, ay], [222, ay]], color: C.line, sw: 1.8, dash: i === 4 ? '3 3' : null, marker: 'arr-ink' });
    b += lock({ x: 196, y: ay - 22, color: C.teal, s: 0.75 });
  });

  // Security panel (bottom-left)
  b += rect({ x: 24, y: 760, w: 160, h: 350, r: 12, fill: C.tealBg, stroke: C.tealLine, sw: 1.4 });
  b += lock({ x: 38, y: 776, color: C.teal, s: 1 });
  b += text({ x: 62, y: 792, lines: [{ t: 'SECURE BY', weight: 800 }, { t: 'DEFAULT', weight: 800 }], size: 12.5, fill: C.teal, lh: 1.2 });
  const facts = ['TLS 1.3 at the edge', 'mTLS inside the mesh', 'AES-256 at rest', 'Per-patient data keys', 'Keys held in HSM', 'Immutable audit trail', 'Deny by default', 'MFA for professionals', 'No PHI in messages'];
  facts.forEach((f, i) => {
    const fy = 842 + i * 28;
    b += `<circle cx="44" cy="${fy - 4}" r="7" fill="${C.teal}"/><path d="M40.5,${fy - 4} l2.6,2.6 l4.6,-5" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    b += text({ x: 58, y: fy, lines: [f], size: 11.5, fill: C.text, maxw: 120 });
  });

  // ---------- Edge ----------
  b += zone({ x: 224, y: 124, w: 208, h: 606, label: 'Edge · public', fill: C.slateBg, stroke: C.slate });
  b += box({ x: 236, y: 156, w: 184, h: 88, title: 'CDN · WAF · DDoS', titleSize: 15, sub: ['Static assets (CDN)', 'OWASP & bot rules', 'DDoS mitigation'] });
  b += box({ x: 236, y: 258, w: 184, h: 156, title: 'API Gateway', titleSize: 15, sub: ['TLS 1.3 termination', 'JWT / OIDC validation', 'Rate limits · quotas', 'Schema validation', 'Webhook ingress', 'Routes to services (mTLS)'] });
  b += box({ x: 236, y: 428, w: 184, h: 116, title: 'Real-time Gateway', titleSize: 15, sub: ['WebSocket (WSS)', 'Chat · live status', 'In-app notifications', 'Pub/sub fan-out'] });
  b += box({ x: 236, y: 558, w: 184, h: 158, title: 'Media Plane', titleSize: 15, sub: ['WebRTC SFU (LiveKit)', 'TURN / STUN relays', 'DTLS-SRTP · E2EE', 'Geo-distributed nodes', 'Controlled by ③'] });
  b += arrow({ points: [[328, 244], [328, 258]], color: C.line, sw: 1.6 });
  // edge -> core
  b += arrow({ points: [[420, 282], [446, 282], [446, 196], [460, 196]], color: C.line, sw: 1.8 });
  b += arrow({ points: [[420, 360], [460, 360]], color: C.line, sw: 1.8 });
  b += arrow({ points: [[420, 468], [460, 468]], color: C.line, sw: 1.8 });
  b += arrow({ points: [[420, 520], [446, 520], [446, 686], [460, 686]], color: C.line, sw: 1.8 });

  // ---------- Identity & access ----------
  b += zone({ x: 460, y: 124, w: 980, h: 128, label: 'Identity & access', sublabel: 'authentication · authorization · consent', fill: C.indigoBg, stroke: C.indigo });
  b += box({ x: 476, y: 156, w: 452, h: 82, title: 'Policy Decision Point', stroke: C.indigoLine, priority: 'H', sub: ['OPA · RBAC + ABAC · consent & care relationships', 'Permit / deny + masking obligations · policy-as-code'] });
  b += box({ x: 944, y: 156, w: 480, h: 82, num: '1', numFill: C.indigo, title: 'User Management', stroke: C.indigoLine, priority: 'H', sub: ['Registration · profiles · roles · preferences · proxies', 'IdP (Keycloak): OIDC · OAuth 2.1 · MFA · passkeys'] });

  // ---------- Clinical zone ----------
  b += zone({ x: 460, y: 266, w: 980, h: 344, label: 'Clinical zone', sublabel: 'health data (PHI) · strictest controls', fill: C.tealBg, stroke: C.teal });
  b += box({ x: 476, y: 298, w: 302, h: 134, num: '2', numFill: C.teal, title: 'Scheduling', stroke: C.tealLine, priority: 'M', sub: ['Availability & booking', 'Waitlist · urgent triage queue', 'External calendar sync', 'Reminder scheduling'] });
  b += box({ x: 794, y: 298, w: 302, h: 134, num: '3', numFill: C.teal, title: 'Consultation', stroke: C.tealLine, priority: 'M', sub: ['Virtual rooms · waiting room', 'Join tokens · SFU control', 'Text chat · file sharing', 'Call-quality telemetry'] });
  b += box({ x: 1112, y: 298, w: 312, h: 134, num: '5', numFill: C.teal, title: 'Prescription', stroke: C.tealLine, priority: 'M', sub: ['Create · modify · revoke', 'Doctor e-signature', 'Allergy & interaction checks', 'Fulfilment status tracking'] });
  b += box({ x: 476, y: 448, w: 372, h: 148, num: '4', numFill: C.teal, title: 'Patient Records (EHR)', stroke: C.teal, sw: 2, priority: 'H', sub: ['FHIR R4 store · append-only versions', 'Hash-chained, tamper-evident history', 'History · notes · documents', 'Consent & access grants', 'Dynamic masking & redaction'] });
  b += box({ x: 864, y: 448, w: 232, h: 148, title: 'Emergency Access', titleSize: 15, fill: C.coralBg, stroke: C.coral, sw: 2, priority: 'H', titleFill: '#8C2A10', subFill: '#7A3A28', sub: ['Break-glass · Tier 0 path', 'Critical summary (IPS)', 'p95 < 300 ms · 99.99 %', 'Isolated deployment', 'Audited · reviewed ≤ 72 h'] });
  b += box({ x: 1112, y: 448, w: 312, h: 148, num: '6', numFill: C.teal, title: 'Pharmacy Interface', stroke: C.tealLine, priority: 'L', sub: ['Prescription inbox & status', 'Patient–pharmacy messaging', 'Inventory availability', 'Partner API · signed webhooks'] });

  // ---------- Engagement & payment ----------
  b += zone({ x: 460, y: 624, w: 476, h: 106, label: 'Engagement', sublabel: 'no health data in messages', fill: C.skyBg, stroke: C.sky });
  b += box({ x: 476, y: 656, w: 444, h: 60, num: '7', numFill: C.sky, title: 'Notification', stroke: C.skyLine, priority: 'L', sub: ['SMS · e-mail · push · in-app · preferences · read status'] });
  b += zone({ x: 952, y: 624, w: 488, h: 106, label: 'Payment', sublabel: 'PCI DSS scope minimized (SAQ A)', fill: C.amberBg, stroke: C.amber });
  b += box({ x: 968, y: 656, w: 456, h: 60, num: '8', numFill: C.amber, title: 'Billing & Payment', stroke: C.amberLine, priority: 'L', sub: ['Fees · invoices · refunds · ledger · tokenized payments (PSP)'] });

  // ---------- Event bus ----------
  b += rect({ x: 460, y: 744, w: 980, h: 44, r: 10, fill: C.petrol, stroke: C.petrol, sw: 1 });
  b += text({ x: 950, y: 771, lines: [{ t: 'EVENT BUS  ·  Apache Kafka — domain events via transactional outbox · schema registry · 3× replication · idempotent consumers', weight: 600 }], size: 13, fill: C.white, anchor: 'middle', maxw: 950 });

  // ---------- Platform services ----------
  b += zone({ x: 224, y: 802, w: 1216, h: 128, label: 'Platform services', sublabel: 'shared, security-critical capabilities', fill: C.slateBg, stroke: C.slate });
  const plat = [
    { title: 'Audit Trail', priority: 'H', sub: ['Append-only · hash-chained', 'WORM archive · SIEM feed'] },
    { title: 'Document Store', priority: 'H', sub: ['AV scan · SHA-256 checksums', 'Per-patient encryption'] },
    { title: 'Keys & Secrets', priority: 'H', sub: ['KMS + HSM (FIPS 140-3)', 'Vault · automatic rotation'] },
    { title: 'Observability & SIEM', sub: ['OpenTelemetry · SLO alerts', 'Misuse & anomaly detection'] },
    { title: 'De-identified Data', priority: 'L', sub: ['Anonymization pipeline', 'Synthetic data (non-prod)'] },
  ];
  plat.forEach((p, i) => {
    b += box({ x: 240 + i * 239, y: 834, w: 225, h: 82, titleSize: 15, ...p });
  });

  // ---------- Data layer ----------
  b += zone({ x: 224, y: 944, w: 1216, h: 166, label: 'Data layer', sublabel: 'database-per-service · private subnets · AES-256 at rest · TLS in transit', fill: '#F8FAFC', stroke: C.petrol });
  const stores = [
    { title: 'PostgreSQL', sub: ['1 database per service', 'Multi-AZ · PITR · replicas'] },
    { title: 'Redis', sub: ['Cache · sessions', 'Slot holds · presence'] },
    { title: 'Cassandra', sub: ['Chat hot store (30 d)', 'Notification log (TTL)'] },
    { title: 'Object Storage', sub: ['Documents · invoices', 'Versioned · Object Lock'] },
    { title: 'OpenSearch', sub: ['Doctor directory search', 'Audit index (restricted)'] },
    { title: 'Backup Vault & DR', sub: ['Immutable backups', 'Replicas in DR region'] },
  ];
  stores.forEach((s, i) => {
    b += cylinder({ x: 240 + i * 199, y: 976, w: 185, h: 118, ...s, fill: C.white, stroke: C.petrol2 });
  });

  // ---------- External systems ----------
  b += zone({ x: 1480, y: 124, w: 416, h: 666, label: 'External systems', sublabel: 'outside the trust boundary', fill: '#FBFCFD', stroke: '#94A3B8', labelFill: C.slate, dash: '6 4' });
  const ext = [
    { title: 'Identity federation', sub: 'Pro Santé Connect · FranceConnect', tag: 'Used by ① User Management' },
    { title: 'External calendars', sub: 'Google · Microsoft 365 · CalDAV (free/busy)', tag: 'Used by ② Scheduling' },
    { title: 'Drug database', sub: 'Interactions · contraindications · dosage', tag: 'Used by ⑤ Prescription' },
    { title: 'National health services', sub: 'e-Prescription · INS · shared record (FHIR)', tag: 'Used by ④ Records · ⑤ Prescription' },
    { title: 'Pharmacy systems', sub: 'Pharmacy software (PMS) · inventory APIs', tag: 'Used by ⑥ Pharmacy Interface' },
    { title: 'Messaging providers', sub: 'SMS · e-mail · push (APNs / FCM)', tag: 'Used by ⑦ Notification' },
    { title: 'Payment service provider', sub: 'Stripe / Adyen · PCI DSS L1 · 3-D Secure', tag: 'Used by ⑧ Billing & Payment' },
  ];
  ext.forEach((e, i) => {
    const y = 156 + i * 88;
    b += externalBox({ x: 1494, y, w: 388, h: 78, ...e });
    b += arrow({ points: [[1492, y + 39], [1460, y + 39]], color: C.slate, sw: 1.6, head: 'both', marker: 'arr-slate' });
  });

  // ---------- Legend ----------
  const lx = 1480;
  const ly = 804;
  b += rect({ x: lx, y: ly, w: 416, h: 306, r: 14, fill: C.white, stroke: C.slateLine, sw: 1.4 });
  b += text({ x: lx + 16, y: ly + 26, lines: [{ t: 'LEGEND', weight: 800 }], size: 12.5, fill: C.petrol });
  // priorities
  [['H', 'High'], ['M', 'Medium'], ['L', 'Low']].forEach(([p, l], i) => {
    const px = lx + 16 + i * 128;
    b += priorityBadge(px + 21, ly + 40, p);
    b += text({ x: px + 28, y: ly + 55, lines: [`${l} priority`], size: 12, fill: C.text });
  });
  const sw = [
    [C.tealBg, C.teal, 'Clinical zone (PHI)'], [C.indigoBg, C.indigo, 'Identity & access'],
    [C.skyBg, C.sky, 'Engagement'], [C.amberBg, C.amber, 'Payment (PCI scope)'],
    [C.slateBg, C.slate, 'Edge / platform'], ['#FBFCFD', '#94A3B8', 'External system'],
  ];
  sw.forEach(([f, s, l], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = lx + 16 + col * 200;
    const y = ly + 78 + row * 30;
    b += rect({ x, y, w: 26, h: 18, r: 5, fill: f, stroke: s, sw: 1.4, dash: i === 5 ? '4 3' : null });
    b += text({ x: x + 36, y: y + 14, lines: [l], size: 12, fill: C.text });
  });
  const ay = ly + 188;
  b += arrow({ points: [[lx + 16, ay], [lx + 60, ay]], color: C.line, sw: 1.8 });
  b += text({ x: lx + 70, y: ay + 4, lines: ['Synchronous call (HTTPS / mTLS)'], size: 12, fill: C.text });
  b += arrow({ points: [[lx + 16, ay + 26], [lx + 60, ay + 26]], color: C.line, sw: 1.8, dash: '3 3' });
  b += text({ x: lx + 70, y: ay + 30, lines: ['Private back-office access (ZTNA)'], size: 12, fill: C.text });
  b += rect({ x: lx + 16, y: ay + 44, w: 44, h: 14, r: 4, fill: C.petrol, stroke: C.petrol, sw: 1 });
  b += text({ x: lx + 70, y: ay + 56, lines: ['Asynchronous domain events (Kafka)'], size: 12, fill: C.text });
  b += lock({ x: lx + 30, y: ay + 66, color: C.teal, s: 0.8 });
  b += text({ x: lx + 70, y: ay + 82, lines: ['Encrypted channel · ①–⑧ = Appendix 1 components'], size: 12, fill: C.text });

  return svgDoc({ width: W, height: H, body: b, title: 'MedX — High-Level Architecture' });
}

module.exports = { name: 'medx-high-level-architecture', title: 'MedX — High-Level Architecture', width: W, height: H, build };
