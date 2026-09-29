// Livrable 1 — Architecture de haut niveau (vue des conteneurs).
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
  b += text({ x: 32, y: 50, lines: [{ t: 'MedX — Architecture de haut niveau', weight: 800 }], size: 28, fill: C.ink });
  b += text({ x: 32, y: 78, lines: ['Vue des conteneurs · microservices par contexte métier · pilotée par les événements · zéro confiance · chaque lien chiffré'], size: 15, fill: C.muted });

  // Frontière de confiance de la plateforme MedX
  b += rect({ x: 206, y: 102, w: 1252, h: 1022, r: 18, fill: 'none', stroke: C.petrol, sw: 1.6, dash: '8 6' });
  b += rect({ x: 222, y: 92, w: 850, h: 22, r: 11, fill: C.petrol, stroke: C.petrol, sw: 1 });
  b += text({ x: 236, y: 107.5, lines: [{ t: 'PLATEFORME MEDX  ·  cloud certifié HDS  ·  région principale UE (3 AZ) + région de secours tiède', weight: 700 }], size: 11.5, fill: C.white });

  // ---------- Utilisateurs ----------
  b += text({ x: 24, y: 144, lines: [{ t: 'UTILISATEURS', weight: 800 }], size: 12.5, fill: C.petrol });
  const actors = [
    { title: ['Patients et', 'mandataires'], sub: ['Appli mobile · web', 'Parents, aidants'] },
    { title: ['Médecins'], sub: ['Portail web · mobile', 'Inscription vérifiée'] },
    { title: ['Soignants', 'd\'urgence'], sub: ['Bris de glace', 'MFA renforcée'], color: C.coral, bg: C.coralBg, stroke: '#F4B6A3' },
    { title: ['Personnel de', 'pharmacie'], sub: ['Portail web ou LGO', 'via l\'API partenaire'] },
    { title: ['Équipes', 'MedX'], sub: ['Support · DPO · audit', 'Accès zéro confiance'] },
  ];
  actors.forEach((a, i) => {
    const y = 156 + i * 118;
    b += actorCard({ x: 24, y, w: 160, h: 104, ...a });
    const ay = y + 52;
    b += arrow({ points: [[186, ay], [222, ay]], color: C.line, sw: 1.8, dash: i === 4 ? '3 3' : null, marker: 'arr-ink' });
    b += lock({ x: 196, y: ay - 22, color: C.teal, s: 0.75 });
  });

  // Encadré sécurité (en bas à gauche)
  b += rect({ x: 24, y: 760, w: 160, h: 350, r: 12, fill: C.tealBg, stroke: C.tealLine, sw: 1.4 });
  b += lock({ x: 38, y: 776, color: C.teal, s: 1 });
  b += text({ x: 62, y: 792, lines: [{ t: 'SÉCURISÉ', weight: 800 }, { t: 'PAR DÉFAUT', weight: 800 }], size: 12.5, fill: C.teal, lh: 1.2 });
  const facts = ['TLS 1.3 en périphérie', 'mTLS interne', 'AES-256 au repos', 'Clés par patient', 'Clés dans des HSM', 'Audit immuable', 'Refus par défaut', 'MFA des soignants', 'Messages sans santé'];
  facts.forEach((f, i) => {
    const fy = 842 + i * 28;
    b += `<circle cx="44" cy="${fy - 4}" r="7" fill="${C.teal}"/><path d="M40.5,${fy - 4} l2.6,2.6 l4.6,-5" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    b += text({ x: 58, y: fy, lines: [f], size: 11.5, fill: C.text, maxw: 120 });
  });

  // ---------- Périmètre ----------
  b += zone({ x: 224, y: 124, w: 208, h: 606, label: 'Périmètre · public', fill: C.slateBg, stroke: C.slate });
  b += box({ x: 236, y: 156, w: 184, h: 88, title: 'CDN · WAF · DDoS', titleSize: 15, sub: ['Ressources statiques', 'Règles OWASP, robots', 'Protection DDoS'] });
  b += box({ x: 236, y: 258, w: 184, h: 156, title: 'Passerelle API', titleSize: 15, sub: ['Terminaison TLS 1.3', 'Validation JWT / OIDC', 'Débit · quotas', 'Validation de schéma', 'Entrée des webhooks', 'Routage (mTLS)'] });
  b += box({ x: 236, y: 428, w: 184, h: 116, title: 'Passerelle temps réel', titleSize: 15, sub: ['WebSocket (WSS)', 'Chat · statuts en direct', 'Notifications in-app', 'Diffusion pub/sub'] });
  b += box({ x: 236, y: 558, w: 184, h: 158, title: 'Plan média', titleSize: 15, sub: ['SFU WebRTC (LiveKit)', 'Relais TURN / STUN', 'DTLS-SRTP · E2EE', 'Nœuds géo-répartis', 'Piloté par ③'] });
  b += arrow({ points: [[328, 244], [328, 258]], color: C.line, sw: 1.6 });
  // périmètre -> cœur
  b += arrow({ points: [[420, 282], [446, 282], [446, 196], [460, 196]], color: C.line, sw: 1.8 });
  b += arrow({ points: [[420, 360], [460, 360]], color: C.line, sw: 1.8 });
  b += arrow({ points: [[420, 468], [460, 468]], color: C.line, sw: 1.8 });
  b += arrow({ points: [[420, 520], [446, 520], [446, 686], [460, 686]], color: C.line, sw: 1.8 });

  // ---------- Identité et accès ----------
  b += zone({ x: 460, y: 124, w: 980, h: 128, label: 'Identité et accès', sublabel: 'authentification · autorisation · consentement', fill: C.indigoBg, stroke: C.indigo });
  b += box({ x: 476, y: 156, w: 452, h: 82, title: 'Point de décision de politique', stroke: C.indigoLine, priority: 'H', sub: ['OPA · RBAC + ABAC · consentement, relation de soin', 'Accord / refus + obligations de masquage · en code'] });
  b += box({ x: 944, y: 156, w: 480, h: 82, num: '1', numFill: C.indigo, title: 'Gestion des utilisateurs', stroke: C.indigoLine, priority: 'H', sub: ['Inscription · profils · rôles · préférences · mandats', 'IdP (Keycloak) : OIDC · OAuth 2.1 · MFA · passkeys'] });

  // ---------- Zone clinique ----------
  b += zone({ x: 460, y: 266, w: 980, h: 344, label: 'Zone clinique', sublabel: 'données de santé · contrôles les plus stricts', fill: C.tealBg, stroke: C.teal });
  b += box({ x: 476, y: 298, w: 302, h: 134, num: '2', numFill: C.teal, title: 'Planification', stroke: C.tealLine, priority: 'M', sub: ['Disponibilités, réservation', 'Liste d\'attente · file urgente', 'Synchro agendas externes', 'Planification des rappels'] });
  b += box({ x: 794, y: 298, w: 302, h: 134, num: '3', numFill: C.teal, title: 'Consultation', stroke: C.tealLine, priority: 'M', sub: ['Salles virtuelles · attente', 'Jetons d\'accès · pilotage SFU', 'Chat · partage de fichiers', 'Télémétrie de qualité'] });
  b += box({ x: 1112, y: 298, w: 312, h: 134, num: '5', numFill: C.teal, title: 'Ordonnances', stroke: C.tealLine, priority: 'M', sub: ['Créer · modifier · révoquer', 'Signature électronique', 'Contrôles allergies, interactions', 'Suivi de la délivrance'] });
  b += box({ x: 476, y: 448, w: 372, h: 148, num: '4', numFill: C.teal, title: 'Dossier patient (DPI)', stroke: C.teal, sw: 2, priority: 'H', sub: ['Entrepôt FHIR R4 · versions en ajout seul', 'Historique chaîné, altération détectable', 'Antécédents · notes · documents', 'Consentements, autorisations d\'accès', 'Masquage et caviardage dynamiques'] });
  b += box({ x: 864, y: 448, w: 232, h: 148, title: 'Accès d\'urgence', titleSize: 15, fill: C.coralBg, stroke: C.coral, sw: 2, priority: 'H', titleFill: '#8C2A10', subFill: '#7A3A28', sub: ['Bris de glace · niveau 0', 'Synthèse critique (IPS)', 'p95 < 300 ms · 99,99 %', 'Déploiement isolé', 'Audité · revu ≤ 72 h'] });
  b += box({ x: 1112, y: 448, w: 312, h: 148, num: '6', numFill: C.teal, title: 'Interface pharmacie', stroke: C.tealLine, priority: 'B', sub: ['Réception des ordonnances, statuts', 'Échanges patient–pharmacie', 'Disponibilité des stocks', 'API partenaire · webhooks signés'] });

  // ---------- Communication et paiement ----------
  b += zone({ x: 460, y: 624, w: 476, h: 106, label: 'Communication', sublabel: 'aucune donnée de santé', fill: C.skyBg, stroke: C.sky });
  b += box({ x: 476, y: 656, w: 444, h: 60, num: '7', numFill: C.sky, title: 'Notification', stroke: C.skyLine, priority: 'B', sub: ['SMS · e-mail · push · in-app · préférences · lecture'] });
  b += zone({ x: 952, y: 624, w: 488, h: 106, label: 'Paiement', sublabel: 'périmètre PCI DSS réduit (SAQ A)', fill: C.amberBg, stroke: C.amber });
  b += box({ x: 968, y: 656, w: 456, h: 60, num: '8', numFill: C.amber, title: 'Facturation et paiement', stroke: C.amberLine, priority: 'B', sub: ['Honoraires · factures · remboursements · grand livre · PSP'] });

  // ---------- Bus d'événements ----------
  b += rect({ x: 460, y: 744, w: 980, h: 44, r: 10, fill: C.petrol, stroke: C.petrol, sw: 1 });
  b += text({ x: 950, y: 771, lines: [{ t: 'BUS D\'ÉVÉNEMENTS  ·  Apache Kafka — événements métier via outbox transactionnelle · registre de schémas · réplication × 3 · idempotence', weight: 600 }], size: 13, fill: C.white, anchor: 'middle', maxw: 950 });

  // ---------- Services de plateforme ----------
  b += zone({ x: 224, y: 802, w: 1216, h: 128, label: 'Services de plateforme', sublabel: 'capacités partagées, critiques pour la sécurité', fill: C.slateBg, stroke: C.slate });
  const plat = [
    { title: 'Piste d\'audit', priority: 'H', sub: ['Ajout seul · chaîné par hachage', 'Archive WORM · flux SIEM'] },
    { title: 'Documents', priority: 'H', sub: ['Antivirus · sommes SHA-256', 'Chiffrement par patient'] },
    { title: 'Clés et secrets', priority: 'H', sub: ['KMS + HSM (FIPS 140-3)', 'Vault · rotation automatique'] },
    { title: 'Observabilité et SIEM', sub: ['OpenTelemetry · alertes SLO', 'Détection d\'abus, d\'anomalies'] },
    { title: 'Désidentification', priority: 'B', sub: ['Chaîne d\'anonymisation', 'Données synthétiques'] },
  ];
  plat.forEach((p, i) => {
    b += box({ x: 240 + i * 239, y: 834, w: 225, h: 82, titleSize: 15, ...p });
  });

  // ---------- Couche de données ----------
  b += zone({ x: 224, y: 944, w: 1216, h: 166, label: 'Couche de données', sublabel: 'une base par service · sous-réseaux privés · AES-256 au repos · TLS en transit', fill: '#F8FAFC', stroke: C.petrol });
  const stores = [
    { title: 'PostgreSQL', sub: ['1 base par service', 'Multi-AZ · PITR · répliques'] },
    { title: 'Redis', sub: ['Cache · sessions', 'Blocages · présence'] },
    { title: 'Cassandra', sub: ['Chat récent (30 j)', 'Journal notifications'] },
    { title: 'Stockage objet', sub: ['Documents · factures', 'Versionné · Object Lock'] },
    { title: 'OpenSearch', sub: ['Annuaire des médecins', 'Index d\'audit (restreint)'] },
    { title: 'Sauvegardes et PRA', sub: ['Sauvegardes immuables', 'Répliques de secours'] },
  ];
  stores.forEach((s, i) => {
    b += cylinder({ x: 240 + i * 199, y: 976, w: 185, h: 118, ...s, fill: C.white, stroke: C.petrol2 });
  });

  // ---------- Systèmes externes ----------
  b += zone({ x: 1480, y: 124, w: 416, h: 666, label: 'Systèmes externes', sublabel: 'hors frontière de confiance', fill: '#FBFCFD', stroke: '#94A3B8', labelFill: C.slate, dash: '6 4' });
  const ext = [
    { title: 'Fédération d\'identité', sub: 'Pro Santé Connect · FranceConnect', tag: 'Utilisé par ① Gestion des utilisateurs' },
    { title: 'Agendas externes', sub: 'Google · Microsoft 365 · CalDAV (libre / occupé)', tag: 'Utilisé par ② Planification' },
    { title: 'Base de médicaments', sub: 'Interactions · contre-indications · posologie', tag: 'Utilisée par ⑤ Ordonnances' },
    { title: 'Services nationaux de santé', sub: 'e-prescription · INS · dossier partagé (FHIR)', tag: 'Utilisés par ④ Dossier · ⑤ Ordonnances' },
    { title: 'Systèmes des pharmacies', sub: 'Logiciels d\'officine (LGO) · API de stocks', tag: 'Utilisés par ⑥ Interface pharmacie' },
    { title: 'Fournisseurs de messagerie', sub: 'SMS · e-mail · push (APNs / FCM)', tag: 'Utilisés par ⑦ Notification' },
    { title: 'Prestataire de paiement (PSP)', sub: 'Stripe / Adyen · PCI DSS N1 · 3-D Secure', tag: 'Utilisé par ⑧ Facturation et paiement' },
  ];
  ext.forEach((e, i) => {
    const y = 156 + i * 88;
    b += externalBox({ x: 1494, y, w: 388, h: 78, ...e });
    b += arrow({ points: [[1492, y + 39], [1460, y + 39]], color: C.slate, sw: 1.6, head: 'both', marker: 'arr-slate' });
  });

  // ---------- Légende ----------
  const lx = 1480;
  const ly = 804;
  b += rect({ x: lx, y: ly, w: 416, h: 306, r: 14, fill: C.white, stroke: C.slateLine, sw: 1.4 });
  b += text({ x: lx + 16, y: ly + 26, lines: [{ t: 'LÉGENDE', weight: 800 }], size: 12.5, fill: C.petrol });
  // priorités
  [['H', 'haute'], ['M', 'moyenne'], ['B', 'basse']].forEach(([p, l], i) => {
    const px = lx + 16 + [0, 122, 266][i];
    b += priorityBadge(px + 21, ly + 40, p);
    b += text({ x: px + 28, y: ly + 55, lines: [`Priorité ${l}`], size: 12, fill: C.text });
  });
  const sw = [
    [C.tealBg, C.teal, 'Zone clinique (santé)'], [C.indigoBg, C.indigo, 'Identité et accès'],
    [C.skyBg, C.sky, 'Communication'], [C.amberBg, C.amber, 'Paiement (PCI)'],
    [C.slateBg, C.slate, 'Périmètre / plateforme'], ['#FBFCFD', '#94A3B8', 'Système externe'],
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
  b += text({ x: lx + 70, y: ay + 4, lines: ['Appel synchrone (HTTPS / mTLS)'], size: 12, fill: C.text });
  b += arrow({ points: [[lx + 16, ay + 26], [lx + 60, ay + 26]], color: C.line, sw: 1.8, dash: '3 3' });
  b += text({ x: lx + 70, y: ay + 30, lines: ['Accès interne privé (ZTNA)'], size: 12, fill: C.text });
  b += rect({ x: lx + 16, y: ay + 44, w: 44, h: 14, r: 4, fill: C.petrol, stroke: C.petrol, sw: 1 });
  b += text({ x: lx + 70, y: ay + 56, lines: ['Événements métier asynchrones (Kafka)'], size: 12, fill: C.text });
  b += lock({ x: lx + 30, y: ay + 66, color: C.teal, s: 0.8 });
  b += text({ x: lx + 70, y: ay + 82, lines: ['Canal chiffré · ①–⑧ = composants de l\'Annexe 1'], size: 12, fill: C.text });

  return svgDoc({ width: W, height: H, body: b, title: 'MedX — Architecture de haut niveau' });
}

module.exports = { name: 'medx-architecture-haut-niveau', title: 'MedX — Architecture de haut niveau', width: W, height: H, build };
