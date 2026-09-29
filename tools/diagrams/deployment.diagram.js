// Deployment & security zones: primary region (3 AZs) + warm-standby DR region + account isolation.
const { C, svgDoc, rect, text, box, zone, arrow, lock } = require('./lib');

const W = 1920;
const H = 1180;

function chip({ x, y, w, h = 30, label, fill, stroke, color = C.ink, size = 12.5, weight = 600 }) {
  return rect({ x, y, w, h, r: 7, fill, stroke, sw: 1.3 }) + text({ x: x + w / 2, y: y + h / 2 + size * 0.36, lines: [{ t: label, weight }], size, fill: color, anchor: 'middle', maxw: w - 10 });
}

function build() {
  let b = '';
  b += text({ x: 32, y: 50, lines: [{ t: 'MedX — Deployment & Security Zones', weight: 800 }], size: 28, fill: C.ink });
  b += text({ x: 32, y: 78, lines: ['Reference implementation on an HDS-certified public cloud · multi-AZ primary region · warm-standby DR region · isolated accounts'], size: 15, fill: C.muted });

  // Global edge
  b += rect({ x: 32, y: 100, w: 1856, h: 64, r: 14, fill: C.slateBg, stroke: C.slate, sw: 1.4 });
  b += text({ x: 50, y: 138, lines: [{ t: 'GLOBAL EDGE', weight: 800 }], size: 12.5, fill: C.slate });
  const g = [
    ['DNS · latency routing · health-checked failover', 360],
    ['CDN (static assets only)', 230],
    ['WAF · bot management', 220],
    ['DDoS protection (L3–L7)', 230],
    ['Certificates (TLS 1.3, HSTS)', 250],
  ];
  let gx = 170;
  g.forEach(([l, w]) => {
    b += chip({ x: gx, y: 117, w, label: l, fill: C.white, stroke: C.slateLine });
    gx += w + 14;
  });

  // ---------------- Primary region ----------------
  const R = { x: 32, y: 184, w: 1320, h: 800 };
  b += rect({ x: R.x, y: R.y, w: R.w, h: R.h, r: 18, fill: '#FCFEFE', stroke: C.teal, sw: 2 });
  b += text({ x: R.x + 18, y: R.y + 28, lines: [{ t: 'PRIMARY REGION · EU-WEST (PARIS) · HDS-CERTIFIED', weight: 800 }], size: 13.5, fill: C.teal });
  b += text({ x: R.x + 450, y: R.y + 28, lines: ['Production account · VPC with public / application / data subnets in 3 availability zones'], size: 13, fill: C.muted });

  // AZ columns
  const labW = 150;
  const colX0 = R.x + 18 + labW + 10; // 210
  const colW = (R.x + R.w - 18 - colX0 - 2 * 12) / 3; // ~375
  const azX = [0, 1, 2].map((i) => colX0 + i * (colW + 12));
  ['Availability zone A', 'Availability zone B', 'Availability zone C'].forEach((l, i) => {
    b += rect({ x: azX[i], y: R.y + 44, w: colW, h: R.h - 60, r: 12, fill: 'none', stroke: '#9CC9C4', sw: 1.3, dash: '5 5' });
    b += text({ x: azX[i] + colW / 2, y: R.y + 66, lines: [{ t: l.toUpperCase(), weight: 800 }], size: 12, fill: C.teal, anchor: 'middle' });
  });
  const spanW = azX[2] + colW - azX[0];

  // Row: public subnets
  const rows = [
    { y: R.y + 84, h: 118, label: ['Public', 'subnets'] },
    { y: R.y + 216, h: 280, label: ['Application', 'subnets', '(Kubernetes)'] },
    { y: R.y + 510, h: 170, label: ['Data', 'subnets'] },
    { y: R.y + 694, h: 92, label: ['Regional', 'managed', 'services'] },
  ];
  rows.forEach((r) => {
    b += rect({ x: R.x + 18, y: r.y, w: labW, h: r.h, r: 10, fill: C.tealBg, stroke: C.tealLine, sw: 1.2 });
    b += text({ x: R.x + 32, y: r.y + 26, lines: r.label.map((t) => ({ t, weight: 700 })), size: 13.5, fill: C.petrol, lh: 1.25 });
  });

  // Public subnets content
  let y = rows[0].y + 10;
  b += box({ x: azX[0] + 8, y, w: spanW - 16, h: 44, title: 'Load balancers — L7 (HTTPS / WSS) and L4 (media) · NAT gateways · TLS 1.3 only', titleSize: 13.5, pad: 12, shadow: false, stroke: C.slateLine });
  y += 54;
  azX.forEach((x, i) => {
    b += chip({ x: x + 8, y, w: colW - 16, h: 42, label: `Media nodes: SFU + TURN (${['A', 'B', 'C'][i]}) · public UDP`, fill: '#FFF', stroke: C.tealLine, size: 12.5 });
  });

  // Application subnets: Kubernetes node pools spanning AZs
  y = rows[1].y + 10;
  const pools = [
    { t: 'Gateway pool', s: 'API Gateway · Real-time Gateway · mesh ingress', fill: C.slateBg, stroke: C.slateLine },
    { t: 'Identity pool', s: 'Keycloak IdP · User Management · policy bundles (OPA)', fill: C.indigoBg, stroke: C.indigoLine },
    { t: 'Clinical pool (PHI) — dedicated nodes', s: 'Records · Emergency Access · Consultation · Scheduling · Prescription · Pharmacy · Document Store', fill: C.tealBg, stroke: C.tealLine },
    { t: 'Support pool', s: 'Notification · Audit · data jobs     |     Payment namespace: Billing & Payment (strict network policy)', fill: C.amberBg, stroke: C.amberLine },
  ];
  pools.forEach((p, i) => {
    b += rect({ x: azX[0] + 8, y: y + i * 66, w: spanW - 16, h: 56, r: 10, fill: p.fill, stroke: p.stroke, sw: 1.4 });
    b += text({ x: azX[0] + 24, y: y + i * 66 + 23, lines: [{ t: p.t, weight: 700 }], size: 14, fill: C.ink, maxw: spanW - 60 });
    b += text({ x: azX[0] + 24, y: y + i * 66 + 43, lines: [p.s], size: 12.5, fill: C.muted, maxw: spanW - 60 });
    // pod dots per AZ
    azX.forEach((x) => {
      for (let k = 0; k < 3; k++) b += `<circle cx="${x + colW - 60 + k * 16}" cy="${y + i * 66 + 18}" r="5" fill="${p.stroke === C.slateLine ? C.slate : p.stroke === C.indigoLine ? C.indigo : p.stroke === C.tealLine ? C.teal : C.amber}"/>`;
    });
  });

  // Data subnets per AZ
  y = rows[2].y + 10;
  const data = [
    ['PostgreSQL primary', 'PostgreSQL sync standby', 'PostgreSQL read replica'],
    ['Redis primary', 'Redis replica', 'Redis replica'],
    ['Kafka broker 1', 'Kafka broker 2', 'Kafka broker 3'],
    ['Cassandra · OpenSearch', 'Cassandra · OpenSearch', 'Cassandra · OpenSearch'],
  ];
  data.forEach((row, ri) => {
    row.forEach((l, ci) => {
      const hl = ri === 0 && ci === 0;
      b += chip({ x: azX[ci] + 8, y: y + ri * 38, w: colW - 16, h: 32, label: l, fill: hl ? C.petrol : C.white, stroke: hl ? C.petrol : '#9FB3C8', color: hl ? C.white : C.ink, size: 12.5 });
    });
  });

  // Regional managed services
  y = rows[3].y + 12;
  const reg = [
    ['Object storage', 'SSE-KMS · versioning · Object Lock'],
    ['KMS + HSM', 'FIPS 140-3 L3 · key rotation'],
    ['Secrets (Vault)', 'dynamic DB credentials'],
    ['Backup vault', 'immutable · cross-account copy'],
  ];
  const rw = (spanW - 16 - 3 * 12) / 4;
  reg.forEach(([t, s], i) => {
    b += box({ x: azX[0] + 8 + i * (rw + 12), y, w: rw, h: 68, title: t, titleSize: 14, sub: [s], subSize: 12, pad: 12, shadow: false, stroke: C.slateLine });
  });

  // ---------------- DR region ----------------
  const D = { x: 1376, y: 184, w: 512, h: 800 };
  b += rect({ x: D.x, y: D.y, w: D.w, h: D.h, r: 18, fill: '#FDFDFE', stroke: C.indigo, sw: 2, dash: '8 5' });
  b += text({ x: D.x + 18, y: D.y + 28, lines: [{ t: 'DR REGION · EU-CENTRAL (FRANKFURT)', weight: 800 }], size: 13.5, fill: C.indigo });
  b += text({ x: D.x + 18, y: D.y + 48, lines: ['Warm standby · same blueprint (IaC) · EEA only'], size: 13, fill: C.muted });
  const dr = [
    { t: 'Emergency Access API — ACTIVE', s: ['Serves critical summaries from local replicas', 'Tier 0: survives the loss of the primary region'], fill: C.coralBg, stroke: C.coral, tf: '#8C2A10' },
    { t: 'Identity provider — hot standby', s: ['IdP database replicated · signing keys shared', 'Clinicians can still sign in during a failover'] },
    { t: 'Kubernetes — scaled down', s: ['All services deployed at minimum size', 'Autoscales on failover (RTO 15 min – 4 h)'] },
    { t: 'KMS multi-region keys · Vault DR', s: ['Same keys usable in both regions', 'HSM-backed, keys never exported'] },
    { t: 'PostgreSQL cross-region replicas', s: ['Asynchronous, lag < 1 s (RPO ≤ 1 min)', 'Promoted by the failover runbook'] },
    { t: 'Kafka mirror', s: ['Topics replicated (MirrorMaker 2)', 'Consumer offsets translated'] },
    { t: 'Object storage & backup copies', s: ['Cross-region replication · Object Lock kept', 'Backup vault copy in a separate account'] },
  ];
  dr.forEach((d, i) => {
    b += box({ x: D.x + 18, y: D.y + 66 + i * 102, w: D.w - 36, h: 90, title: d.t, titleSize: 14.5, sub: d.s, subSize: 12.5, pad: 12, fill: d.fill || C.white, stroke: d.stroke || C.indigoLine, titleFill: d.tf || C.ink, shadow: false });
  });

  // Replication arrows primary -> DR (horizontal, aligned with the replicated tiers)
  [4, 5, 6].forEach((i) => {
    const yy = D.y + 66 + i * 102 + 45;
    b += arrow({ points: [[R.x + R.w + 2, yy], [D.x + 16, yy]], color: C.indigo, sw: 2, dash: '6 4', marker: 'arr-indigo' });
  });

  // Edge -> regions
  b += arrow({ points: [[692, 164], [692, R.y]], color: C.line, sw: 2 });
  b += arrow({ points: [[1632, 164], [1632, D.y]], color: C.indigo, sw: 2, dash: '7 5', marker: 'arr-indigo' });
  b += text({ x: 704, y: 180, lines: [{ t: 'active', weight: 700 }], size: 11.5, fill: C.line });
  b += text({ x: 1644, y: 180, lines: [{ t: 'failover', weight: 700 }], size: 11.5, fill: C.indigo });

  // ---------------- Accounts / environments ----------------
  const A = { x: 32, y: 1002, w: 1856, h: 160 };
  b += rect({ x: A.x, y: A.y, w: A.w, h: A.h, r: 16, fill: C.slateBg, stroke: C.slate, sw: 1.4 });
  b += text({ x: A.x + 18, y: A.y + 28, lines: [{ t: 'ACCOUNTS & ENVIRONMENTS', weight: 800 }], size: 13.5, fill: C.slate });
  b += text({ x: A.x + 250, y: A.y + 28, lines: ['one cloud account per environment and purpose · separate keys · no network path from non-production to production data'], size: 13, fill: C.muted });
  const acc = [
    { t: 'Production', s: ['Real PHI · HDS scope', 'Admin access: JIT + approval'], fill: C.tealBg, stroke: C.teal },
    { t: 'DR', s: ['Warm standby', 'Same controls as prod'], fill: C.indigoBg, stroke: C.indigo },
    { t: 'Security & log archive', s: ['Audit WORM · SIEM', 'Read-only for auditors'], fill: C.white, stroke: C.slate },
    { t: 'Shared services', s: ['CI/CD · image registry', 'Signed images · IaC state'], fill: C.white, stroke: C.slate },
    { t: 'Staging · demo · dev', s: ['Synthetic / anonymized', 'data only — never real PHI'], fill: C.skyBg, stroke: C.sky },
  ];
  const aw = (A.w - 36 - 4 * 14) / 5;
  acc.forEach((a, i) => {
    b += box({ x: A.x + 18 + i * (aw + 14), y: A.y + 44, w: aw, h: 100, title: a.t, titleSize: 15, sub: a.s, subSize: 12.5, pad: 14, fill: a.fill, stroke: a.stroke, shadow: false });
  });
  b += lock({ x: A.x + A.w - 40, y: A.y + 12, color: C.teal, s: 1 });

  return svgDoc({ width: W, height: H, body: b, title: 'MedX — Deployment & Security Zones' });
}

module.exports = { name: 'medx-deployment-view', title: 'MedX — Deployment & Security Zones', width: W, height: H, build };
