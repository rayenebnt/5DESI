// Déploiement et zones de sécurité : région principale (3 AZ) + région de secours tiède + isolation des comptes.
const { C, svgDoc, rect, text, box, zone, arrow, lock } = require('./lib');

const W = 1920;
const H = 1180;

function chip({ x, y, w, h = 30, label, fill, stroke, color = C.ink, size = 12.5, weight = 600 }) {
  return rect({ x, y, w, h, r: 7, fill, stroke, sw: 1.3 }) + text({ x: x + w / 2, y: y + h / 2 + size * 0.36, lines: [{ t: label, weight }], size, fill: color, anchor: 'middle', maxw: w - 10 });
}

function build() {
  let b = '';
  b += text({ x: 32, y: 50, lines: [{ t: 'MedX — Déploiement et zones de sécurité', weight: 800 }], size: 28, fill: C.ink });
  b += text({ x: 32, y: 78, lines: ['Implémentation de référence sur un cloud public certifié HDS · région principale multi-AZ · région de secours tiède · comptes isolés'], size: 15, fill: C.muted });

  // Périmètre global
  b += rect({ x: 32, y: 100, w: 1856, h: 64, r: 14, fill: C.slateBg, stroke: C.slate, sw: 1.4 });
  b += text({ x: 50, y: 138, lines: [{ t: 'PÉRIMÈTRE', weight: 800 }], size: 12.5, fill: C.slate });
  const g = [
    ['DNS · routage par latence · bascule sur contrôle de santé', 390],
    ['CDN (ressources statiques)', 220],
    ['WAF · gestion des robots', 210],
    ['Protection DDoS (L3–L7)', 220],
    ['Certificats (TLS 1.3, HSTS)', 240],
  ];
  let gx = 170;
  g.forEach(([l, w]) => {
    b += chip({ x: gx, y: 117, w, label: l, fill: C.white, stroke: C.slateLine });
    gx += w + 14;
  });

  // ---------------- Région principale ----------------
  const R = { x: 32, y: 184, w: 1320, h: 800 };
  b += rect({ x: R.x, y: R.y, w: R.w, h: R.h, r: 18, fill: '#FCFEFE', stroke: C.teal, sw: 2 });
  b += text({ x: R.x + 18, y: R.y + 28, lines: [{ t: 'RÉGION PRINCIPALE · EU-WEST (PARIS) · CERTIFIÉE HDS', weight: 800 }], size: 13.5, fill: C.teal });
  b += text({ x: R.x + 450, y: R.y + 28, lines: ['Compte de production · VPC avec sous-réseaux publics / applicatifs / données dans 3 zones de disponibilité'], size: 13, fill: C.muted });

  // Colonnes des AZ
  const labW = 150;
  const colX0 = R.x + 18 + labW + 10; // 210
  const colW = (R.x + R.w - 18 - colX0 - 2 * 12) / 3; // ~375
  const azX = [0, 1, 2].map((i) => colX0 + i * (colW + 12));
  ['Zone de disponibilité A', 'Zone de disponibilité B', 'Zone de disponibilité C'].forEach((l, i) => {
    b += rect({ x: azX[i], y: R.y + 44, w: colW, h: R.h - 60, r: 12, fill: 'none', stroke: '#9CC9C4', sw: 1.3, dash: '5 5' });
    b += text({ x: azX[i] + colW / 2, y: R.y + 66, lines: [{ t: l.toUpperCase(), weight: 800 }], size: 12, fill: C.teal, anchor: 'middle' });
  });
  const spanW = azX[2] + colW - azX[0];

  // Rangées : sous-réseaux
  const rows = [
    { y: R.y + 84, h: 118, label: ['Sous-réseaux', 'publics'] },
    { y: R.y + 216, h: 280, label: ['Sous-réseaux', 'applicatifs', '(Kubernetes)'] },
    { y: R.y + 510, h: 170, label: ['Sous-réseaux', 'de données'] },
    { y: R.y + 694, h: 92, label: ['Services', 'managés', 'régionaux'] },
  ];
  rows.forEach((r) => {
    b += rect({ x: R.x + 18, y: r.y, w: labW, h: r.h, r: 10, fill: C.tealBg, stroke: C.tealLine, sw: 1.2 });
    b += text({ x: R.x + 32, y: r.y + 26, lines: r.label.map((t) => ({ t, weight: 700 })), size: 13.5, fill: C.petrol, lh: 1.25 });
  });

  // Contenu des sous-réseaux publics
  let y = rows[0].y + 10;
  b += box({ x: azX[0] + 8, y, w: spanW - 16, h: 44, title: 'Répartiteurs de charge — L7 (HTTPS / WSS) et L4 (média) · passerelles NAT · TLS 1.3 uniquement', titleSize: 13.5, pad: 12, shadow: false, stroke: C.slateLine });
  y += 54;
  azX.forEach((x, i) => {
    b += chip({ x: x + 8, y, w: colW - 16, h: 42, label: `Nœuds média : SFU + TURN (${['A', 'B', 'C'][i]}) · UDP public`, fill: '#FFF', stroke: C.tealLine, size: 12.5 });
  });

  // Sous-réseaux applicatifs : pools de nœuds Kubernetes répartis sur les AZ
  y = rows[1].y + 10;
  const pools = [
    { t: 'Pool passerelles', s: 'Passerelle API · passerelle temps réel · entrée du maillage', fill: C.slateBg, stroke: C.slateLine },
    { t: 'Pool identité', s: 'IdP Keycloak · gestion des utilisateurs · paquets de politiques (OPA)', fill: C.indigoBg, stroke: C.indigoLine },
    { t: 'Pool clinique (santé) — dédié', s: 'Dossier · accès d\'urgence · consultation · planification · ordonnances · pharmacie · documents', fill: C.tealBg, stroke: C.tealLine },
    { t: 'Pool support', s: 'Notification · audit · traitements de données     |     Espace de noms paiement : facturation (politique réseau stricte)', fill: C.amberBg, stroke: C.amberLine },
  ];
  pools.forEach((p, i) => {
    b += rect({ x: azX[0] + 8, y: y + i * 66, w: spanW - 16, h: 56, r: 10, fill: p.fill, stroke: p.stroke, sw: 1.4 });
    b += text({ x: azX[0] + 24, y: y + i * 66 + 23, lines: [{ t: p.t, weight: 700 }], size: 14, fill: C.ink, maxw: spanW - 60 });
    b += text({ x: azX[0] + 24, y: y + i * 66 + 43, lines: [p.s], size: 12.5, fill: C.muted, maxw: spanW - 60 });
    // pods par AZ
    azX.forEach((x) => {
      for (let k = 0; k < 3; k++) b += `<circle cx="${x + colW - 60 + k * 16}" cy="${y + i * 66 + 18}" r="5" fill="${p.stroke === C.slateLine ? C.slate : p.stroke === C.indigoLine ? C.indigo : p.stroke === C.tealLine ? C.teal : C.amber}"/>`;
    });
  });

  // Sous-réseaux de données par AZ
  y = rows[2].y + 10;
  const data = [
    ['PostgreSQL primaire', 'PostgreSQL secours synchrone', 'PostgreSQL réplique en lecture'],
    ['Redis primaire', 'Redis réplique', 'Redis réplique'],
    ['Kafka broker 1', 'Kafka broker 2', 'Kafka broker 3'],
    ['Cassandra · OpenSearch', 'Cassandra · OpenSearch', 'Cassandra · OpenSearch'],
  ];
  data.forEach((row, ri) => {
    row.forEach((l, ci) => {
      const hl = ri === 0 && ci === 0;
      b += chip({ x: azX[ci] + 8, y: y + ri * 38, w: colW - 16, h: 32, label: l, fill: hl ? C.petrol : C.white, stroke: hl ? C.petrol : '#9FB3C8', color: hl ? C.white : C.ink, size: 12.5 });
    });
  });

  // Services managés régionaux
  y = rows[3].y + 12;
  const reg = [
    ['Stockage objet', 'SSE-KMS · versions · Object Lock'],
    ['KMS + HSM', 'FIPS 140-3 N3 · rotation des clés'],
    ['Secrets (Vault)', 'identifiants BD dynamiques'],
    ['Coffre de sauvegarde', 'immuable · copie inter-comptes'],
  ];
  const rw = (spanW - 16 - 3 * 12) / 4;
  reg.forEach(([t, s], i) => {
    b += box({ x: azX[0] + 8 + i * (rw + 12), y, w: rw, h: 68, title: t, titleSize: 14, sub: [s], subSize: 12, pad: 12, shadow: false, stroke: C.slateLine });
  });

  // ---------------- Région de secours ----------------
  const D = { x: 1376, y: 184, w: 512, h: 800 };
  b += rect({ x: D.x, y: D.y, w: D.w, h: D.h, r: 18, fill: '#FDFDFE', stroke: C.indigo, sw: 2, dash: '8 5' });
  b += text({ x: D.x + 18, y: D.y + 28, lines: [{ t: 'RÉGION DE SECOURS · EU-CENTRAL (FRANCFORT)', weight: 800 }], size: 13.5, fill: C.indigo });
  b += text({ x: D.x + 18, y: D.y + 48, lines: ['Secours tiède · même modèle (IaC) · EEE uniquement'], size: 13, fill: C.muted });
  const dr = [
    { t: 'API d\'accès d\'urgence — ACTIVE', s: ['Sert les synthèses critiques depuis des répliques locales', 'Niveau 0 : survit à la perte de la région principale'], fill: C.coralBg, stroke: C.coral, tf: '#8C2A10' },
    { t: 'Fournisseur d\'identité — secours chaud', s: ['Base de l\'IdP répliquée · clés de signature partagées', 'Les soignants se connectent pendant une bascule'] },
    { t: 'Kubernetes — taille réduite', s: ['Tous les services déployés à taille minimale', 'Montée en charge à la bascule (RTO 15 min – 4 h)'] },
    { t: 'Clés KMS multi-régions · Vault de secours', s: ['Mêmes clés utilisables dans les deux régions', 'Adossées à des HSM, jamais exportées'] },
    { t: 'Répliques PostgreSQL inter-régions', s: ['Asynchrones, retard < 1 s (RPO ≤ 1 min)', 'Promues par la procédure de bascule'] },
    { t: 'Miroir Kafka', s: ['Topics répliqués (MirrorMaker 2)', 'Positions des consommateurs traduites'] },
    { t: 'Stockage objet et copies de sauvegarde', s: ['Réplication inter-régions · Object Lock conservé', 'Copie du coffre dans un compte séparé'] },
  ];
  dr.forEach((d, i) => {
    b += box({ x: D.x + 18, y: D.y + 66 + i * 102, w: D.w - 36, h: 90, title: d.t, titleSize: 14.5, sub: d.s, subSize: 12.5, pad: 12, fill: d.fill || C.white, stroke: d.stroke || C.indigoLine, titleFill: d.tf || C.ink, shadow: false });
  });

  // Flèches de réplication principale -> secours (alignées sur les couches répliquées)
  [4, 5, 6].forEach((i) => {
    const yy = D.y + 66 + i * 102 + 45;
    b += arrow({ points: [[R.x + R.w + 2, yy], [D.x + 16, yy]], color: C.indigo, sw: 2, dash: '6 4', marker: 'arr-indigo' });
  });

  // Périmètre -> régions
  b += arrow({ points: [[692, 164], [692, R.y]], color: C.line, sw: 2 });
  b += arrow({ points: [[1632, 164], [1632, D.y]], color: C.indigo, sw: 2, dash: '7 5', marker: 'arr-indigo' });
  b += text({ x: 704, y: 180, lines: [{ t: 'actif', weight: 700 }], size: 11.5, fill: C.line });
  b += text({ x: 1644, y: 180, lines: [{ t: 'bascule', weight: 700 }], size: 11.5, fill: C.indigo });

  // ---------------- Comptes / environnements ----------------
  const A = { x: 32, y: 1002, w: 1856, h: 160 };
  b += rect({ x: A.x, y: A.y, w: A.w, h: A.h, r: 16, fill: C.slateBg, stroke: C.slate, sw: 1.4 });
  b += text({ x: A.x + 18, y: A.y + 28, lines: [{ t: 'COMPTES ET ENVIRONNEMENTS', weight: 800 }], size: 13.5, fill: C.slate });
  b += text({ x: A.x + 270, y: A.y + 28, lines: ['un compte cloud par environnement et par usage · clés séparées · aucun chemin réseau du hors-production vers les données de production'], size: 13, fill: C.muted });
  const acc = [
    { t: 'Production', s: ['Vraies données · périmètre HDS', 'Admin : juste-à-temps + validation'], fill: C.tealBg, stroke: C.teal },
    { t: 'Secours', s: ['Secours tiède', 'Mêmes contrôles que la prod'], fill: C.indigoBg, stroke: C.indigo },
    { t: 'Sécurité et archives', s: ['Audit WORM · SIEM', 'Lecture seule pour les auditeurs'], fill: C.white, stroke: C.slate },
    { t: 'Services partagés', s: ['CI/CD · registre d\'images', 'Images signées · état IaC'], fill: C.white, stroke: C.slate },
    { t: 'Préprod · démo · dév', s: ['Données synthétiques / anonymisées', 'uniquement — jamais réelles'], fill: C.skyBg, stroke: C.sky },
  ];
  const aw = (A.w - 36 - 4 * 14) / 5;
  acc.forEach((a, i) => {
    b += box({ x: A.x + 18 + i * (aw + 14), y: A.y + 44, w: aw, h: 100, title: a.t, titleSize: 15, sub: a.s, subSize: 12.5, pad: 14, fill: a.fill, stroke: a.stroke, shadow: false });
  });
  b += lock({ x: A.x + A.w - 40, y: A.y + 12, color: C.teal, s: 1 });

  return svgDoc({ width: W, height: H, body: b, title: 'MedX — Déploiement et zones de sécurité' });
}

module.exports = { name: 'medx-deploiement', title: 'MedX — Déploiement et zones de sécurité', width: W, height: H, build };
