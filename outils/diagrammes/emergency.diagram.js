// Exigence de priorité haute H3 — accès d'urgence (bris de glace) : flux, garde-fous et résilience.
const { C, svgDoc, rect, text, arrow, lock } = require('./lib');

const W = 1920;
const H = 900;

function stepCard({ x, y, w, h, n, title, lines, hot = false }) {
  const fill = hot ? C.coralBg : C.white;
  const stroke = hot ? C.coral : C.tealLine;
  let o = rect({ x, y, w, h, r: 16, fill, stroke, sw: hot ? 2.2 : 1.6, shadow: true });
  o += `<circle cx="${x + 34}" cy="${y + 36}" r="18" fill="${hot ? C.coral : C.teal}"/>`;
  o += text({ x: x + 34, y: y + 42.5, lines: [{ t: String(n), weight: 800 }], size: 17, fill: C.white, anchor: 'middle' });
  o += text({ x: x + 62, y: y + 43, lines: [{ t: title, weight: 800 }], size: 18, fill: hot ? '#8C2A10' : C.ink, maxw: w - 74 });
  o += text({ x: x + 22, y: y + 84, lines, size: 14, fill: hot ? '#6B2A18' : C.text, lh: 1.42, maxw: w - 40 });
  return o;
}

function build() {
  let b = '';
  b += text({ x: 40, y: 54, lines: [{ t: 'Accès d\'urgence (bris de glace)', weight: 800 }], size: 30, fill: C.ink });
  b += text({ x: 40, y: 84, lines: ['Exigence de priorité haute H3 · accès immédiat aux données critiques pour les professionnels habilités, avec une traçabilité complète a posteriori'], size: 16, fill: C.muted });

  // Étapes
  const steps = [
    { title: 'Identifier le patient', lines: ['Recherche exacte uniquement :', 'INS / identifiant MedX, ou', 'nom + date de naissance + sexe', 'Identité minimale pour', 'confirmer le patient', 'Ni navigation, ni jokers'] },
    { title: 'Déclarer l\'urgence', lines: ['Code motif (inconscient,', 'pronostic vital engagé,', 'consentement impossible…)', 'Justification en texte libre', 'Engagement de responsabilité', '« Je serai audité »'] },
    { title: 'MFA renforcée', lines: ['Passkey ou carte (e-CPS)', 'dans les 15 dernières minutes', 'Le moteur de politiques', 'vérifie le droit', 'acces_urgence et', 'l\'opposition du patient'] },
    { title: 'Autorisation limitée', lines: ['4 heures · lecture seule', 'Ce patient uniquement', 'Autorisation + audit écrits', 'dans la même transaction', 'Renouvelable avec un', 'nouveau motif'] },
    { title: 'Synthèse en < 1 s', hot: true, lines: ['Résumé patient (IPS) :', 'allergies, problèmes actifs,', 'traitements, groupe sanguin,', 'implants, directives', 'anticipées, contacts', 'Dossier complet : même accès'] },
  ];
  const cw = 328;
  const gap = 50;
  const y0 = 124;
  const ch = 232;
  steps.forEach((s, i) => {
    const x = 40 + i * (cw + gap);
    b += stepCard({ x, y: y0, w: cw, h: ch, n: i + 1, ...s });
    if (i < steps.length - 1) b += arrow({ points: [[x + cw + 6, y0 + ch / 2], [x + cw + gap - 6, y0 + ch / 2]], color: C.teal, sw: 3, marker: 'arr-teal' });
  });

  // Bandeau des délais
  b += rect({ x: 40, y: 376, w: 1840, h: 44, r: 22, fill: C.petrol, stroke: C.petrol, sw: 1 });
  b += text({ x: 960, y: 404, lines: [{ t: 'Soignant : ≈ 30 secondes de la recherche aux données (étapes humaines)   ·   Système : p95 < 300 ms par appel d\'API   ·   Disponibilité 99,99 %', weight: 700 }], size: 15, fill: C.white, anchor: 'middle' });

  // Garde-fous
  b += text({ x: 40, y: 464, lines: [{ t: 'GARDE-FOUS — RESPONSABILITÉ A POSTERIORI (l\'accès n\'est jamais bloqué, il est toujours justifié)', weight: 800 }], size: 14, fill: C.coral });
  const guards = [
    ['Audit immuable', ['AuditEvent, finalité =', 'traitement d\'urgence, conservé', 'dans la piste WORM']],
    ['Alerte en temps réel', ['Le DPO est alerté via le', 'SIEM dès le début', 'de l\'accès']],
    ['Patient informé', ['Avis in-app + e-mail sous', '24 h : qui, quand,', 'ce qui a été consulté']],
    ['Revue obligatoire', ['DPO + responsable médical', 'revoient chaque cas', 'sous 72 h']],
    ['Détection des abus', ['L\'analyse comportementale', 'repère les anomalies ;', 'sanctions et suspension']],
  ];
  guards.forEach(([t, ls], i) => {
    const x = 40 + i * (cw + gap);
    b += rect({ x, y: 482, w: cw, h: 128, r: 14, fill: C.coralBg, stroke: '#F4B6A3', sw: 1.5 });
    b += text({ x: x + 20, y: 514, lines: [{ t, weight: 800 }], size: 16.5, fill: '#8C2A10', maxw: cw - 40 });
    b += text({ x: x + 20, y: 543, lines: ls, size: 14, fill: '#6B2A18', lh: 1.4, maxw: cw - 40 });
  });

  // Résilience
  b += text({ x: 40, y: 656, lines: [{ t: 'RÉSILIENCE — POURQUOI LE CHEMIN DE NIVEAU 0 FONCTIONNE QUAND D\'AUTRES SERVICES SONT DÉGRADÉS', weight: 800 }], size: 14, fill: C.teal });
  const res = [
    ['Déploiement isolé', 'cloisonné, capacité réservée'],
    ['Synthèse pré-calculée', 'projection, sans jointure'],
    ['Répliques multi-AZ', '+ région de secours active'],
    ['Jetons validés en local', 'clés de l\'IdP en cache'],
    ['Décisions locales', 'sidecar OPA, paquets en cache'],
    ['Audit via l\'outbox', 'sans dépendre de la chaîne d\'audit'],
  ];
  const rw = (1840 - 5 * 16) / 6;
  res.forEach(([t, s], i) => {
    const x = 40 + i * (rw + 16);
    b += rect({ x, y: 674, w: rw, h: 92, r: 14, fill: C.tealBg, stroke: C.tealLine, sw: 1.5 });
    b += lock({ x: x + 18, y: 690, color: C.teal, s: 0.95 });
    b += text({ x: x + 44, y: 706, lines: [{ t, weight: 800 }], size: 15, fill: C.petrol, maxw: rw - 56 });
    b += text({ x: x + 18, y: 740, lines: [s], size: 13, fill: C.text, maxw: rw - 30 });
  });

  // Pied de page
  b += rect({ x: 40, y: 796, w: 1840, h: 70, r: 14, fill: C.slateBg, stroke: C.slateLine, sw: 1.2 });
  b += text({ x: 64, y: 826, lines: [{ t: 'Qui peut briser la glace ?', weight: 800 }], size: 15, fill: C.ink });
  b += text({ x: 64, y: 850, lines: ['Praticiens vérifiés titulaires du droit acces_urgence (médecine d\'urgence, gardes, SAMU), accordé par le responsable médical de MedX et revu chaque trimestre. Les patients peuvent s\'y opposer lorsque la loi le permet.'], size: 14, fill: C.muted, maxw: 1790 });

  return svgDoc({ width: W, height: H, body: b, title: 'MedX — Accès d\'urgence (bris de glace)' });
}

module.exports = { name: 'medx-acces-urgence', title: 'MedX — Accès d\'urgence (bris de glace)', width: W, height: H, build };
