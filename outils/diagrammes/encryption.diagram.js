// Exigence de priorité haute H1 — chiffrement en transit et au repos (hiérarchie des clés).
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
  b += text({ x: 40, y: 54, lines: [{ t: 'Chiffrement en transit et au repos', weight: 800 }], size: 30, fill: C.ink });
  b += text({ x: 40, y: 84, lines: ['Exigence de priorité haute H1 · chaque saut chiffré · deux couches indépendantes au repos · clés générées et conservées dans un KMS adossé à des HSM'], size: 16, fill: C.muted });

  // ---------------- En transit ----------------
  b += rect({ x: 40, y: 110, w: 900, h: 920, r: 18, fill: '#FBFEFD', stroke: C.teal, sw: 1.8 });
  b += lock({ x: 62, y: 126, color: C.teal, s: 1.1 });
  b += text({ x: 90, y: 146, lines: [{ t: 'EN TRANSIT', weight: 800 }], size: 16, fill: C.teal });
  b += text({ x: 214, y: 146, lines: ['aucun saut en clair, dans la plateforme comme à l\'extérieur'], size: 14, fill: C.muted });

  const links = [
    { from: 'Appli patient / médecin', to: 'Périmètre (WAF · passerelle)', p: 'TLS 1.3', note: 'HSTS · suites AEAD modernes uniquement · épinglage de certificats dans les applis mobiles' },
    { from: 'Périmètre', to: 'Microservices', p: 'mTLS', note: 'Maillage de services · identités SPIFFE · certificats renouvelés toutes les 24 h' },
    { from: 'Microservices', to: 'Bases · Kafka · Redis', p: 'TLS (verify-full)', note: 'Identifiants de base de données dynamiques et de courte durée émis par Vault' },
    { from: 'Patient ⇄ médecin', to: 'Nœud média SFU', p: 'DTLS-SRTP + E2EE', note: 'SRTP obligatoire en WebRTC · couche SFrame de bout en bout quand les deux clients la prennent en charge' },
    { from: 'Systèmes des pharmacies', to: 'API partenaire', p: 'mTLS + OAuth 2.0', note: 'Jetons liés au certificat client · webhooks sortants signés (HMAC-SHA256)' },
    { from: 'Microservices', to: 'Fournisseurs externes', p: 'TLS 1.2+', note: 'Validation des certificats · aucune donnée de santé transmise (SMS, e-mail, agendas)' },
    { from: 'Région principale', to: 'Région de secours', p: 'TLS + KMS', note: 'Flux de réplication chiffrés en transit et rechiffrés au repos' },
  ];
  links.forEach((l, i) => {
    const y = 176 + i * 120;
    b += node({ x: 64, y, w: 250, h: 58, title: l.from });
    b += node({ x: 666, y, w: 250, h: 58, title: l.to });
    b += arrow({ points: [[318, y + 29], [662, y + 29]], color: C.teal, sw: 2.4, head: 'both', marker: 'arr-teal' });
    b += pill({ x: 490, y: y + 29, label: l.p, color: C.teal });
    b += text({ x: 64, y: y + 84, lines: [l.note], size: 13, fill: C.muted, maxw: 852 });
  });

  // ---------------- Au repos ----------------
  const X = 980;
  b += rect({ x: X, y: 110, w: 900, h: 920, r: 18, fill: '#FCFCFF', stroke: C.indigo, sw: 1.8 });
  b += lock({ x: X + 22, y: 126, color: C.indigo, s: 1.1 });
  b += text({ x: X + 50, y: 146, lines: [{ t: 'AU REPOS — CHIFFREMENT D\'ENVELOPPE', weight: 800 }], size: 16, fill: C.indigo });

  // Niveaux
  const lv = [
    { y: 176, l: 'HSM', d: 'FIPS 140-3 niveau 3' },
    { y: 330, l: 'KEK', d: 'KMS, non exportable' },
    { y: 484, l: 'DEK', d: 'AES-256-GCM' },
    { y: 638, l: 'DONNÉES', d: 'chiffrées uniquement' },
  ];
  lv.forEach((v) => {
    b += rect({ x: X + 22, y: v.y, w: 118, h: 86, r: 12, fill: C.indigoBg, stroke: C.indigoLine, sw: 1.2 });
    b += text({ x: X + 81, y: v.y + 38, lines: [{ t: v.l, weight: 800 }], size: 20, fill: C.indigo, anchor: 'middle' });
    b += text({ x: X + 81, y: v.y + 60, lines: [v.d], size: 11, fill: C.muted, anchor: 'middle', maxw: 110 });
  });

  // Racine HSM
  b += node({ x: X + 330, y: 176, w: 420, h: 86, title: 'Clés racines dans le HSM', sub: 'générées dans le matériel · n\'en sortent jamais · contrôle par quorum', fill: C.petrol, stroke: C.petrol, tf: C.white, sf: '#BFE3DF' });
  // KEKs
  const keks = [
    ['KEK dossier', 'par service · env. · classe'],
    ['KEK documents', 'renouvelée chaque année'],
    ['KEK consultation', 'chaque usage journalisé'],
  ];
  const kw = 228;
  keks.forEach(([t, s], i) => {
    const x = X + 170 + i * (kw + 16);
    b += node({ x, y: 330, w: kw, h: 86, title: t, sub: s, stroke: C.indigoLine });
    b += arrow({ points: [[X + 540, 262], [X + 540, 296], [x + kw / 2, 296], [x + kw / 2, 328]], color: C.indigo, sw: 1.8, marker: 'arr-indigo' });
  });
  // DEKs
  const deks = [
    ['DEK par patient', 'données cliniques'],
    ['DEK par fichier', 'documents'],
    ['DEK par consultation', 'messages du chat'],
  ];
  deks.forEach(([t, s], i) => {
    const x = X + 170 + i * (kw + 16);
    b += node({ x, y: 484, w: kw, h: 86, title: t, sub: s, stroke: C.indigoLine });
    b += arrow({ points: [[x + kw / 2, 416], [x + kw / 2, 482]], color: C.indigo, sw: 1.8, marker: 'arr-indigo', label: ['chiffre'], labelAt: [x + kw / 2, 449], labelFill: C.indigo, labelSize: 11 });
  });
  const data = [
    ['Champs FHIR sensibles', 'notes · identifiant national'],
    ['Documents médicaux', 'stockage objet'],
    ['Historique du chat', 'stockage récent + archive'],
  ];
  data.forEach(([t, s], i) => {
    const x = X + 170 + i * (kw + 16);
    b += node({ x, y: 638, w: kw, h: 86, title: t, sub: s, fill: C.tealBg, stroke: C.tealLine });
    b += arrow({ points: [[x + kw / 2, 570], [x + kw / 2, 636]], color: C.indigo, sw: 1.8, marker: 'arr-indigo', label: ['chiffre'], labelAt: [x + kw / 2, 603], labelFill: C.indigo, labelSize: 11 });
  });

  // Notes
  const notes = [
    ['Seconde couche, indépendante', 'Disques, bases, stockage objet, Kafka, Redis et sauvegardes sont aussi chiffrés (AES-256, clés KMS).'],
    ['Crypto-effacement', 'En fin de conservation, détruire la DEK d\'un patient rend toute copie illisible — répliques et sauvegardes comprises.'],
    ['Rayon d\'impact et performances', 'Une DEK compromise expose un patient, pas la base. Les DEK déchiffrées restent en mémoire ≤ 5 min pour limiter les appels KMS.'],
  ];
  notes.forEach(([t, s], i) => {
    const y = 756 + i * 88;
    b += rect({ x: X + 22, y, w: 856, h: 76, r: 12, fill: C.white, stroke: C.slateLine, sw: 1.2 });
    b += text({ x: X + 42, y: y + 28, lines: [{ t, weight: 800 }], size: 14.5, fill: C.ink });
    b += text({ x: X + 42, y: y + 52, lines: [s], size: 12.8, fill: C.muted, maxw: 820 });
  });

  return svgDoc({ width: W, height: H, body: b, title: 'MedX — Chiffrement en transit et au repos' });
}

module.exports = { name: 'medx-chiffrement-cles', title: 'MedX — Chiffrement en transit et au repos', width: W, height: H, build };
