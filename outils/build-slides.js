// Livrable 6 — génère presentation/MedX-Solution-Technique.pptx (+ notes-orateur.md) avec pptxgenjs.
// Usage : node build-slides.js
const fs = require('fs');
const path = require('path');
const PptxGenJS = require('pptxgenjs');
const React = require('react');
const RDS = require('react-dom/server');
const sharp = require('sharp');
const lu = require('react-icons/lu');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'presentation');
const DIAG = path.join(ROOT, 'diagrammes');

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
pres.layout = 'LAYOUT_WIDE'; // 13,333 x 7,5 pouces
pres.author = "Équipe d'architecture MedX";
pres.company = 'MedX';
pres.title = 'MedX — Conception de la solution technique';
pres.subject = 'Architecture de haut niveau, conception des composants, données, scalabilité, sécurité et conformité';

// ---------- icônes ----------
const iconCache = new Map();
async function icon(name, color) {
  const key = `${name}-${color}`;
  if (!iconCache.has(key)) {
    const Cmp = lu[name];
    if (!Cmp) throw new Error(`icône ${name} introuvable`);
    const svg = RDS.renderToStaticMarkup(React.createElement(Cmp, { color: `#${color}`, size: 256 }));
    const buf = await sharp(Buffer.from(svg)).resize(256, 256).png().toBuffer();
    iconCache.set(key, `image/png;base64,${buf.toString('base64')}`);
  }
  return iconCache.get(key);
}

// ---------- utilitaires ----------
const notes = [];
let slideNo = 0;

function newSlide({ dark = false, note = '' } = {}) {
  const s = pres.addSlide();
  slideNo += 1;
  s.background = { color: dark ? C.petrol : C.white };
  if (!dark) {
    s.addText('MedX · Conception de la solution technique', { x: 0.6, y: 7.08, w: 6, h: 0.25, fontFace: F, fontSize: 9, color: C.grey, margin: 0, isTextBox: true });
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

// Priorités : H = haute, M = moyenne, B = basse.
const PRIO = { H: [C.coral, C.white], M: [C.amber, '3B2A05'], B: [C.grey, C.white] };
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
  // ---------------------------------------------------------------- 1. Titre
  {
    const s = newSlide({ dark: true, note:
`Ouverture (30 s).
Bonjour. On nous a demandé de concevoir la solution technique de MedX : une plateforme de téléconsultation, de dossier patient et de suivi des ordonnances.
Pendant les 15 prochaines minutes, je vais présenter l'architecture, le fonctionnement de chaque composant, le stockage des données, la montée en charge et la protection des données de santé.
Une idée guide tous les choix : les priorités de MedX elles-mêmes. La protection des données et l'accès d'urgence passent en premier ; tout le reste est construit dessus.` });
    txt(s, 'PLATEFORME DE SANTÉ MEDX', 0.8, 1.35, 7, 0.4, { size: 14, bold: true, color: C.mint, cs: 3 });
    txt(s, 'Conception de la solution technique', 0.8, 1.8, 7.2, 1.7, { size: 42, bold: true, color: C.white });
    txt(s, 'Téléconsultations · Dossier patient · Suivi des ordonnances', 0.8, 3.55, 7.2, 0.5, { size: 18, color: C.mint });
    txt(s, 'Architecture de haut niveau · conception des composants · données et stockage · scalabilité et performances · sécurité et conformité', 0.8, 4.15, 6.8, 0.8, { size: 14, color: 'D6E6EA' });
    txt(s, "Mini-projet 5DESI · Proposition d'architecture · 2026", 0.8, 6.45, 7, 0.35, { size: 12, color: C.mint });
    const tiles = [
      ['LuVideo', 'Consulter', C.petrol2, C.mint],
      ['LuFileText', 'Documenter', C.petrol2, C.mint],
      ['LuPill', 'Prescrire', C.petrol2, C.mint],
      ['LuShieldCheck', 'Protéger', C.coral, C.white],
    ];
    for (const [i, [ic, label, bg, fg]] of tiles.entries()) {
      const x = 8.35 + (i % 2) * 2.2;
      const y = 1.45 + Math.floor(i / 2) * 2.2;
      box(s, x, y, 1.95, 1.95, { fill: bg, line: i === 3 ? C.coral : '2B7285', r: 0.12 });
      s.addImage({ data: await icon(ic, fg), x: x + 0.62, y: y + 0.35, w: 0.72, h: 0.72 });
      txt(s, label, x, y + 1.25, 1.95, 0.4, { size: 16, bold: true, color: fg, align: 'center' });
    }
  }

  // ---------------------------------------------------------------- 2. Enjeux de conception
  {
    const s = newSlide({ note:
`Les enjeux de conception (1 min).
MedX repose sur trois piliers : la téléconsultation, un dossier patient tenu à vie, et le suivi des ordonnances jusqu'à la pharmacie.
Le sujet hiérarchise les exigences. Les cinq priorités HAUTES — chiffrement, dossier patient, accès d'urgence, authentification et intégrité — ne sont pas des fonctionnalités ajoutées à la fin : ce sont les fondations et les principes non négociables de l'architecture.
Les priorités MOYENNES sont les parcours de soin construits sur ces fondations ; les priorités BASSES sont entièrement conçues dès maintenant mais livrées en dernier, surtout avec des partenaires comme un prestataire de paiement.` });
    title(s, 'ENJEUX DE CONCEPTION', 'Ce dont MedX a besoin — et ce qui passe en premier');
    const pillars = [
      ['LuVideo', 'Téléconsultations', 'Réserver, voir un médecin en vidéo, échanger et partager des documents'],
      ['LuFileText', 'Dossier patient', 'Un dossier fiable tenu à vie — disponible en urgence'],
      ['LuPill', 'Suivi des ordonnances', 'De la signature du médecin au comptoir de la pharmacie'],
    ];
    txt(s, 'LA MISSION DE MEDX', 0.6, 1.6, 4, 0.3, { size: 11, bold: true, color: C.slate, cs: 1 });
    for (const [i, [ic, t, d]] of pillars.entries()) {
      const y = 2.0 + i * 1.3;
      await iconIn(s, ic, 0.6, y, 0.75, C.tealLight, C.teal);
      txt(s, t, 1.55, y + 0.02, 3.2, 0.35, { size: 16, bold: true, color: C.ink });
      txt(s, d, 1.55, y + 0.4, 3.1, 0.6, { size: 12, color: C.muted });
    }
    const bands = [
      ['H', 'HAUTE', 'Fondations non négociables', C.coralLight, C.coral, C.coralDark, ['Chiffrement au repos et en transit', 'Gestion du dossier patient', "Accès d'urgence", 'Authentification et autorisation', 'Intégrité et fichiers sécurisés']],
      ['M', 'MOYENNE', 'Parcours de soin', C.amberLight, C.amber, C.amberDark, ['Planification', 'Vidéo · chat · fichiers', 'Ordonnances', 'Masquage et caviardage', 'Agendas externes']],
      ['B', 'BASSE', 'Conçues maintenant, livrées en dernier', C.slateLight, C.grey, C.muted, ['Interface pharmacie', 'Préférences', 'Suivi des notifications', 'Anonymisation', 'Paiements', 'Remboursements']],
    ];
    for (const [i, [p, lvl, sub, bg, line, dark, items]] of bands.entries()) {
      const y = 1.6 + i * 1.42;
      box(s, 5.0, y, 7.73, 1.28, { fill: bg, line, lw: 1.25 });
      prio(s, 5.18, y + 0.14, p, 0.32);
      txt(s, lvl, 5.6, y + 0.13, 1.2, 0.34, { size: 14, bold: true, color: dark });
      txt(s, sub, 6.75, y + 0.15, 5, 0.34, { size: 12, color: dark, italic: true });
      const n = items.length;
      const gap = 0.1;
      const cw = (7.73 - 0.36 - gap * (n - 1)) / n;
      items.forEach((it, j) => chip(s, it, 5.18 + j * (cw + gap), y + 0.58, cw, 0.56, { size: n > 5 ? 9.5 : 10.5, fill: C.white, line }));
    }
    box(s, 0.6, 6.05, 12.13, 0.7, { fill: C.petrol, line: C.petrol, r: 0.08 });
    txt(s, "Les priorités hautes deviennent des principes d'architecture  ·  les moyennes s'appuient dessus  ·  les basses sont conçues maintenant, livrées en dernier", 0.8, 6.05, 11.73, 0.7, { size: 13.5, bold: true, color: C.white, valign: 'middle', align: 'center' });
  }

  // ---------------------------------------------------------------- 3. Objectifs et principes
  {
    const s = newSlide({ note:
`Objectifs et principes (1 min).
Nous avons dimensionné la plateforme pour l'année 3 : 10 millions de patients, 200 000 téléconsultations par jour, jusqu'à 10 000 appels vidéo simultanés — avec une marge de 2x en plus.
Deux chiffres comptent le plus car ils découlent des priorités HAUTES : l'accès d'urgence doit être disponible 99,99 % du temps et renvoyer la synthèse critique en moins de 300 millisecondes.
Les huit principes ci-dessous transforment les priorités en règles suivies par toutes les équipes — par exemple « l'intégrité d'abord » : l'historique clinique n'est jamais écrasé.` });
    title(s, 'OBJECTIFS ET PRINCIPES DE CONCEPTION', 'Dimensionnée pour une croissance × 10, guidée par huit principes');
    const stats = [
      ['10 M', 'patients inscrits (année 3)', C.teal],
      ['200 k', 'téléconsultations par jour', C.teal],
      ['10 k', 'appels vidéo simultanés en pointe', C.teal],
      ['99,99 %', "de disponibilité de l'accès d'urgence", C.coral],
      ['< 300 ms', 'pour servir une synthèse critique', C.coral],
    ];
    stats.forEach(([n, l, col], i) => {
      const x = 0.6 + i * 2.465;
      box(s, x, 1.6, 2.3, 1.45, { fill: C.white, line: C.slateLine, shadow: true });
      txt(s, n, x, 1.72, 2.3, 0.7, { size: 30, bold: true, color: col, align: 'center' });
      txt(s, l, x + 0.1, 2.45, 2.1, 0.5, { size: 12, color: C.muted, align: 'center' });
    });
    const pr = [
      ['LuShieldCheck', 'Confidentialité native', 'Tout chiffrer, minimiser, refuser par défaut'],
      ['LuHeartPulse', "Sécurité du patient d'abord", "Le chemin d'urgence tient quand tout lâche"],
      ['LuHistory', "L'intégrité d'abord", "L'historique clinique n'est jamais réécrit"],
      ['LuBadgeCheck', 'Standards plutôt que sur mesure', 'FHIR · OpenID Connect · WebRTC · OpenAPI'],
      ['LuWorkflow', 'Couplage faible', 'Événements métier, une base par service'],
      ['LuPackage', 'Réutiliser, puis construire', 'IdP, PSP, SFU réutilisés — logique de soin construite'],
      ['LuTrendingUp', 'Monter en largeur, automatiser', 'Sans état, mise à l\'échelle auto, IaC'],
      ['LuEye', 'Observable et auditable', 'Chaque requête tracée, chaque accès audité'],
    ];
    for (const [i, [ic, t, d]] of pr.entries()) {
      const x = 0.6 + (i % 4) * 3.083;
      const y = 3.35 + Math.floor(i / 4) * 1.72;
      box(s, x, y, 2.93, 1.55, { fill: C.slateLight, line: C.slateLight });
      await iconIn(s, ic, x + 0.18, y + 0.2, 0.55, C.white, C.teal);
      txt(s, `P${i + 1}`, x + 2.35, y + 0.2, 0.45, 0.3, { size: 11, bold: true, color: C.grey, align: 'right' });
      txt(s, t, x + 0.18, y + 0.85, 2.65, 0.32, { size: 13.5, bold: true, color: C.ink });
      txt(s, d, x + 0.18, y + 1.15, 2.65, 0.35, { size: 11, color: C.muted });
    }
  }

  // ---------------------------------------------------------------- 4. Vue d'ensemble
  {
    const s = newSlide({ note:
`Vue d'ensemble de l'architecture (2 min) — la diapositive clé.
Elle se lit de gauche à droite. Les utilisateurs n'atteignent MedX que par le périmètre : CDN et pare-feu applicatif, la passerelle d'API, une passerelle temps réel pour le chat et les statuts en direct, et le plan média pour la vidéo.
Derrière, les huit composants du sujet sont des microservices regroupés en zones de sécurité. La zone identité décide qui vous êtes et ce que vous pouvez faire. La zone clinique détient toutes les données de santé et applique les contrôles les plus stricts. La notification ne stocke jamais de données de santé, et la facturation est isolée dans sa propre zone de paiement.
Les services communiquent via un bus d'événements Kafka ; des services de plateforme partagés assurent l'audit, le stockage sécurisé des documents et la gestion des clés ; chaque service possède sa base de données.
L'accès d'urgence — en rouge — est déployé séparément pour que rien d'autre ne puisse le ralentir.` });
    title(s, 'ARCHITECTURE DE HAUT NIVEAU', "Vue d'ensemble de l'architecture");
    // Utilisateurs
    txt(s, 'UTILISATEURS', 0.45, 1.42, 1.5, 0.25, { size: 9.5, bold: true, color: C.petrol, cs: 1 });
    const users = [['LuUser', 'Patients et mandataires', C.teal], ['LuStethoscope', 'Médecins', C.teal], ['LuSiren', "Soignants d'urgence", C.coral], ['LuStore', 'Pharmacies', C.teal], ['LuUserCog', 'Équipes MedX', C.slate]];
    for (const [i, [ic, l, col]] of users.entries()) {
      const y = 1.72 + i * 0.72;
      box(s, 0.45, y, 1.4, 0.6, { fill: col === C.coral ? C.coralLight : C.white, line: col === C.coral ? C.coralLine : C.slateLine });
      await iconIn(s, ic, 0.52, y + 0.12, 0.36, null, col);
      txt(s, l, 0.93, y, 0.9, 0.6, { size: 9, bold: true, color: C.ink, valign: 'middle' });
      arrow(s, 1.87, y + 0.3, 2.02, y + 0.3, C.slate, 1.25);
    }
    // Périmètre
    box(s, 2.02, 1.42, 1.58, 3.72, { fill: C.slateLight, line: C.slate, lw: 1 });
    txt(s, 'PÉRIMÈTRE · PUBLIC', 2.1, 1.47, 1.45, 0.25, { size: 8.5, bold: true, color: C.slate, cs: 0.5 });
    const edge = [['CDN · WAF · DDoS', 'TLS 1.3'], ['Passerelle API', 'JWT · limites de débit'], ['Passerelle temps réel', 'WebSocket'], ['Plan média', 'SFU · TURN']];
    edge.forEach(([t, d], i) => {
      const y = 1.78 + i * 0.83;
      box(s, 2.1, y, 1.42, 0.7, { fill: C.white, line: C.slateLine });
      txt(s, t, 2.16, y + 0.07, 1.32, 0.3, { size: 9.5, bold: true, color: C.ink });
      txt(s, d, 2.16, y + 0.37, 1.32, 0.28, { size: 8.5, color: C.muted });
    });
    arrow(s, 3.6, 2.55, 3.72, 2.55, C.slate, 1.25);
    arrow(s, 3.6, 3.35, 3.72, 3.35, C.slate, 1.25);
    arrow(s, 3.6, 4.1, 3.72, 4.1, C.slate, 1.25);
    // Zone identité
    const X0 = 3.72;
    const ZW = 6.95;
    box(s, X0, 1.42, ZW, 0.9, { fill: C.indigoLight, line: C.indigo });
    txt(s, 'IDENTITÉ ET ACCÈS', X0 + 0.1, 1.46, 3, 0.25, { size: 9, bold: true, color: C.indigo, cs: 1 });
    const svc = (x, y, w, h, t, d, p, o = {}) => {
      box(s, x, y, w, h, { fill: o.fill || C.white, line: o.line || C.slateLine, lw: o.lw || 1 });
      txt(s, t, x + 0.08, y + 0.05, w - 0.4, 0.3, { size: 10, bold: true, color: o.tc || C.ink });
      if (d) txt(s, d, x + 0.08, y + 0.33, w - 0.16, h - 0.36, { size: 8.5, color: o.dc || C.muted });
      if (p) prio(s, x + w - 0.3, y + 0.07, p, 0.22);
    };
    svc(X0 + 0.1, 1.72, 3.3, 0.52, '① Gestion des utilisateurs + IdP', 'OIDC · MFA · passkeys · rôles · préférences', 'H', { line: C.indigoLine });
    svc(X0 + 3.55, 1.72, 3.3, 0.52, 'Moteur de politiques (OPA)', 'RBAC + ABAC · consentement · obligations de masquage', 'H', { line: C.indigoLine });
    // Zone clinique
    box(s, X0, 2.42, ZW, 1.86, { fill: C.tealLight, line: C.teal });
    txt(s, 'ZONE CLINIQUE · DONNÉES DE SANTÉ', X0 + 0.1, 2.46, 4, 0.25, { size: 9, bold: true, color: C.teal, cs: 1 });
    const cw = (ZW - 0.2 - 0.2) / 3;
    svc(X0 + 0.1, 2.74, cw, 0.66, '② Planification', "Réservation · liste d'attente · urgences · agendas", 'M', { line: C.tealLine });
    svc(X0 + 0.2 + cw, 2.74, cw, 0.66, '③ Consultation', 'Salles · vidéo · chat · fichiers', 'M', { line: C.tealLine });
    svc(X0 + 0.3 + 2 * cw, 2.74, cw, 0.66, '⑤ Ordonnances', 'Signature · contrôles · suivi', 'M', { line: C.tealLine });
    svc(X0 + 0.1, 3.5, cw, 0.7, '④ Dossier patient', 'FHIR · versionné · chaîné par hachage', 'H', { line: C.teal, lw: 1.5 });
    svc(X0 + 0.2 + cw, 3.5, cw, 0.7, "Accès d'urgence", 'Bris de glace · niveau 0 · 2 régions', 'H', { fill: C.coralLight, line: C.coral, lw: 1.5, tc: C.coralDark, dc: C.coralDark });
    svc(X0 + 0.3 + 2 * cw, 3.5, cw, 0.7, '⑥ Interface pharmacie', 'Réception · statuts · stocks', 'B', { line: C.tealLine });
    // Communication et paiement
    const hw = (ZW - 0.12) / 2;
    box(s, X0, 4.38, hw, 0.76, { fill: C.skyLight, line: C.sky });
    svc(X0 + 0.1, 4.46, hw - 0.2, 0.6, '⑦ Notification', 'SMS · e-mail · push · in-app — sans donnée de santé', 'B', { line: C.skyLine });
    box(s, X0 + hw + 0.12, 4.38, hw, 0.76, { fill: C.amberLight, line: C.amber });
    svc(X0 + hw + 0.22, 4.46, hw - 0.2, 0.6, '⑧ Facturation et paiement', 'Jetons PSP uniquement (PCI SAQ A) · grand livre', 'B', { line: C.amberLine });
    // Bus d'événements
    box(s, 2.02, 5.26, 8.65, 0.36, { fill: C.petrol, line: C.petrol, r: 0.05 });
    txt(s, "BUS D'ÉVÉNEMENTS · Kafka — événements métier via outbox transactionnelle · registre de schémas", 2.02, 5.26, 8.65, 0.36, { size: 10.5, bold: true, color: C.white, align: 'center', valign: 'middle' });
    // Plateforme
    const plat = ["Piste d'audit (WORM)", 'Stockage de documents', 'Clés et secrets (HSM)', 'Observabilité et SIEM', 'Données désidentifiées'];
    const pw = (8.65 - 0.1 * 4) / 5;
    plat.forEach((p, i) => chip(s, p, 2.02 + i * (pw + 0.1), 5.72, pw, 0.42, { size: 9.5, fill: C.slateLight, line: C.slateLine, bold: true, color: C.text }));
    // Données (cylindres)
    const data = ['PostgreSQL ×8', 'Redis', 'Cassandra', 'Stockage objet', 'OpenSearch', 'Sauvegardes · PRA'];
    const dw = (8.65 - 0.1 * 5) / 6;
    data.forEach((d, i) => {
      s.addShape(pres.shapes.CAN, { x: 2.02 + i * (dw + 0.1), y: 6.24, w: dw, h: 0.62, fill: { color: C.white }, line: { color: C.petrol2, width: 1 } });
      txt(s, d, 2.02 + i * (dw + 0.1), 6.36, dw, 0.46, { size: 10, bold: true, color: C.petrol, align: 'center', valign: 'middle' });
    });
    // Systèmes externes
    box(s, 10.82, 1.42, 2.08, 5.44, { fill: 'FBFCFD', line: C.grey, dash: 'dash' });
    txt(s, 'SYSTÈMES EXTERNES', 10.92, 1.47, 1.9, 0.25, { size: 9, bold: true, color: C.slate, cs: 1 });
    const ext = [["Fédération d'identité", '①'], ['Agendas externes', '②'], ['Base de médicaments', '⑤'], ['Services nationaux', '④ ⑤'], ['Logiciels de pharmacie', '⑥'], ['SMS · e-mail · push', '⑦'], ['Prestataire de paiement', '⑧']];
    ext.forEach(([t, n], i) => {
      const y = 1.8 + i * 0.72;
      box(s, 10.92, y, 1.88, 0.6, { fill: C.white, line: C.slateLine, dash: 'dash' });
      txt(s, t, 11.0, y + 0.06, 1.75, 0.28, { size: 9, bold: true, color: C.ink });
      txt(s, `utilisé par ${n}`, 11.0, y + 0.32, 1.75, 0.24, { size: 8.5, color: C.teal });
      arrow(s, 10.9, y + 0.3, 10.7, y + 0.3, C.slate, 1, true);
    });
  }

  // ---------------------------------------------------------------- 5. Parcours de soin
  {
    const s = newSlide({ note:
`Comment les briques travaillent ensemble (1 min 30).
Voici un parcours de soin. Le patient réserve : la planification bloque le créneau 10 minutes, une contrainte de base de données rend la double réservation impossible, et la facturation pré-autorise les honoraires.
Il rencontre le médecin en vidéo dans le service de consultation ; le médecin documente dans le dossier patient, puis signe une ordonnance que la pharmacie reçoit en quelques secondes ; enfin le paiement est encaissé.
En bas, le bus d'événements : chaque étape publie un événement. Trois règles rendent l'ensemble robuste : des appels synchrones uniquement quand un utilisateur attend, des événements qui ne transportent jamais de contenu clinique, et l'outbox qui garantit qu'aucun événement n'est perdu ni inventé.` });
    title(s, "LOGIQUE DE L'ARCHITECTURE", 'Un parcours de soin à travers les services');
    const st = [
      ['LuCalendarClock', 'Réserver', '② Planification · ⑧', 'Blocage du créneau 10 min + contrainte d\'exclusion en base · honoraires pré-autorisés'],
      ['LuVideo', 'Consulter', '③ Consultation', "Salle d'attente · SFU WebRTC · chiffrement de bout en bout · chat et fichiers"],
      ['LuFileText', 'Documenter', '④ Dossier patient', 'Note FHIR signée · versionnée · chaînée par hachage · auditée'],
      ['LuPill', 'Prescrire', '⑤ Ordonnances', 'Contrôles allergies et interactions · signature dans un HSM · QR code vérifiable'],
      ['LuStore', 'Délivrer et payer', '⑥ Pharmacie · ⑧ · ⑦', 'Statuts de la pharmacie · paiement encaissé · facture · patient notifié'],
    ];
    const w = 2.25;
    const gap = 0.22;
    for (const [i, [ic, t, svc, d]] of st.entries()) {
      const x = 0.6 + i * (w + gap);
      box(s, x, 1.6, w, 2.95, { fill: C.white, line: C.tealLine, shadow: true });
      await iconIn(s, ic, x + 0.18, 1.8, 0.62, C.tealLight, C.teal);
      num(s, x + w - 0.5, 1.8, i + 1, 0.32, C.petrol);
      txt(s, t, x + 0.18, 2.55, w - 0.3, 0.4, { size: 17, bold: true, color: C.ink });
      txt(s, svc, x + 0.18, 2.97, w - 0.3, 0.35, { size: 10.5, bold: true, color: C.teal });
      txt(s, d, x + 0.18, 3.35, w - 0.32, 1.15, { size: 11.5, color: C.muted });
      if (i < st.length - 1) arrow(s, x + w + 0.02, 3.07, x + w + gap - 0.02, 3.07, C.teal, 2);
    }
    box(s, 0.6, 4.75, 12.13, 0.5, { fill: C.petrol, line: C.petrol, r: 0.06 });
    txt(s, 'Événements Kafka :   RendezVousReserve  →  ConsultationTerminee  →  DossierMisAJour  →  OrdonnanceEmise  →  StatutDelivranceMisAJour · PaiementEncaisse', 0.75, 4.75, 11.9, 0.5, { size: 11.5, bold: true, color: C.white, valign: 'middle' });
    const rules = [
      ['LuTimer', 'Synchrone seulement si un utilisateur attend', 'Au plus 2 sauts, délais et disjoncteurs partout'],
      ['LuEyeOff', 'Des identifiants, jamais de données cliniques', 'Les consommateurs lisent le détail sous leur propre autorisation'],
      ['LuListChecks', 'Outbox transactionnelle', 'Ni événement perdu ni fantôme · consommateurs idempotents'],
    ];
    for (const [i, [ic, t, d]] of rules.entries()) {
      const x = 0.6 + i * 4.1;
      box(s, x, 5.5, 3.93, 1.2, { fill: C.slateLight, line: C.slateLight });
      await iconIn(s, ic, x + 0.15, 5.68, 0.45, C.white, C.petrol);
      txt(s, t, x + 0.75, 5.62, 3.1, 0.35, { size: 12, bold: true, color: C.ink });
      txt(s, d, x + 0.75, 5.97, 3.1, 0.6, { size: 11, color: C.muted });
    }
  }

  // ---------------------------------------------------------------- 6. Identité et accès (H4)
  {
    const s = newSlide({ note:
`Priorité HAUTE H4 — authentification et autorisation (1 min 30).
Nous ne développons pas l'authentification nous-mêmes : Keycloak, un fournisseur d'identité éprouvé, gère OpenID Connect, la MFA et les passkeys, avec trois realms séparés. Les patients bénéficient d'une expérience fluide ; les professionnels utilisent toujours une MFA résistante à l'hameçonnage et doivent se ré-authentifier avant de signer une ordonnance ou de briser la glace ; le personnel de MedX ne voit jamais de données de santé.
L'autorisation se fait en deux couches : des rôles pour les règles générales, et des politiques à base d'attributs pour les règles fines — ce médecin soigne-t-il ce patient, pour quelle finalité, avec quel consentement. OPA les évalue à côté de chaque service en moins d'une milliseconde et renvoie avec sa décision les obligations de masquage.` });
    title(s, 'PRIORITÉ HAUTE · H4', 'Identité forte, autorisation fine', C.coral);
    const realms = [
      ['LuUser', 'Patients', 'Passkey ou mot de passe · MFA selon le risque · biométrie sur mobile · jetons de 10 min liés par DPoP'],
      ['LuStethoscope', 'Professionnels', 'MFA résistante à l\'hameçonnage (passkey, carte e-CPS) · ré-authentification avant signature ou bris de glace · inactivité 15 min'],
      ['LuUserCog', 'Collaborateurs MedX', 'SSO d\'entreprise + clés matérielles · administration juste-à-temps, enregistrée · aucun accès aux données de santé'],
    ];
    txt(s, 'KEYCLOAK — 3 REALMS, 3 PROFILS DE RISQUE', 0.6, 1.55, 5, 0.3, { size: 11, bold: true, color: C.slate, cs: 1 });
    for (const [i, [ic, t, d]] of realms.entries()) {
      const y = 1.95 + i * 1.62;
      box(s, 0.6, y, 4.9, 1.45, { fill: C.indigoLight, line: C.indigoLight });
      await iconIn(s, ic, 0.78, y + 0.2, 0.55, C.white, C.indigo);
      txt(s, t, 1.5, y + 0.18, 3.8, 0.35, { size: 15, bold: true, color: C.ink });
      txt(s, d, 1.5, y + 0.55, 3.85, 0.85, { size: 11, color: C.muted });
    }
    txt(s, 'CHAQUE REQUÊTE SUR DES DONNÉES DE SANTÉ', 5.9, 1.55, 6.5, 0.3, { size: 11, bold: true, color: C.slate, cs: 1 });
    const nodes = [
      [5.9, 'Application', "jeton d'accès\n(lié par DPoP)"],
      [7.75, 'Passerelle API', 'signature, expiration,\naudience, débit'],
      [9.6, 'Service (PEP)', 'autorisation de soin,\nconsentement, étiquettes'],
    ];
    nodes.forEach(([x, t, d]) => {
      box(s, x, 1.95, 1.6, 1.25, { fill: C.white, line: C.slateLine, shadow: true });
      txt(s, t, x, 2.02, 1.6, 0.35, { size: 13, bold: true, color: C.ink, align: 'center' });
      txt(s, d, x + 0.05, 2.4, 1.5, 0.75, { size: 10, color: C.muted, align: 'center' });
    });
    arrow(s, 7.52, 2.57, 7.73, 2.57, C.slate, 1.75);
    arrow(s, 9.37, 2.57, 9.58, 2.57, C.slate, 1.75);
    box(s, 11.45, 1.95, 1.28, 1.25, { fill: C.petrol, line: C.petrol });
    txt(s, 'Données', 11.45, 2.05, 1.28, 0.35, { size: 13, bold: true, color: C.white, align: 'center' });
    txt(s, 'déchiffrer\n+ masquer', 11.45, 2.42, 1.28, 0.7, { size: 10.5, color: C.mint, align: 'center' });
    arrow(s, 11.22, 2.57, 11.43, 2.57, C.slate, 1.75);
    box(s, 9.6, 3.55, 1.6, 1.0, { fill: C.coralLight, line: C.coral });
    txt(s, 'Sidecar OPA', 9.6, 3.62, 1.6, 0.32, { size: 13, bold: true, color: C.coralDark, align: 'center' });
    txt(s, '< 1 ms, sans saut réseau', 9.6, 3.95, 1.6, 0.5, { size: 10, color: C.coralDark, align: 'center' });
    arrow(s, 10.4, 3.22, 10.4, 3.53, C.coral, 1.5, true);
    txt(s, 'accord / refus\n+ obligations de masquage', 7.35, 3.62, 2.15, 0.7, { size: 10.5, color: C.coralDark, align: 'right', italic: true });
    box(s, 5.9, 4.85, 6.83, 1.95, { fill: C.slateLight, line: C.slateLight });
    txt(s, 'Décision RBAC + ABAC', 6.1, 4.97, 6.4, 0.35, { size: 14, bold: true, color: C.ink });
    const parts = [['Rôle', 'médecin'], ['Relation', 'autorisation de soin'], ['Finalité', 'soins'], ['Consentement', 'étiquettes'], ['Assurance', 'niveau MFA']];
    parts.forEach(([a, b], i) => {
      const x = 6.1 + i * 1.3;
      chip(s, `${a}\n${b}`, x, 5.42, 1.15, 0.62, { size: 9.5, fill: C.white, line: C.slateLine });
      if (i < parts.length - 1) txt(s, '+', x + 1.15, 5.42, 0.15, 0.62, { size: 13, bold: true, color: C.slate, align: 'center', valign: 'middle' });
    });
    txt(s, 'Politiques sous forme de code : Git → tests unitaires → paquets signés → sidecars. Refus par défaut.', 6.1, 6.22, 6.4, 0.45, { size: 11.5, color: C.muted, italic: true });
  }

  // ---------------------------------------------------------------- 7. Dossier patient (H2, H5)
  {
    const s = newSlide({ note:
`Priorités HAUTES H2 et H5 — le dossier patient (1 min 30).
Le dossier est stocké en HL7 FHIR, le standard de la santé : validation, versionnage et future intégration avec les services nationaux sont acquis d'emblée.
Chaque requête traverse la même chaîne de sept étapes, à gauche : aucun point d'accès ne peut oublier un contrôle.
L'intégrité est prouvable : l'historique est en ajout seul, chaque version est chaînée par hachage, et chaque nuit les têtes de chaîne sont signées dans un module matériel de sécurité et stockées en écriture unique — même un administrateur ne peut pas réécrire l'historique sans que cela se voie.
L'accès est explicite : le patient, un mandataire, un médecin traitant avec une autorisation de soin limitée dans le temps, un médecin avec qui le patient a partagé, ou le bris de glace. Les pharmaciens et le personnel de MedX n'ont pas accès au dossier.` });
    title(s, 'PRIORITÉ HAUTE · H2 · H5', 'Dossier patient : complet, exact, altération détectable', C.coral);
    txt(s, 'CHAQUE REQUÊTE TRAVERSE LA MÊME CHAÎNE', 0.6, 1.55, 4.2, 0.3, { size: 11, bold: true, color: C.slate, cs: 1 });
    const chain = ['Autorisation (PEP → OPA)', 'Validation (profils FHIR)', 'Provenance (qui, pourquoi)', 'Chiffrement (clé patient)', 'Chaîne de hachage', 'Audit (même transaction)', 'Masquage (obligations)'];
    chain.forEach((c, i) => {
      const y = 1.95 + i * 0.66;
      box(s, 0.6, y, 3.7, 0.54, { fill: i === 3 || i === 4 ? C.tealLight : C.white, line: C.tealLine });
      num(s, 0.7, y + 0.1, i + 1, 0.34, C.teal);
      txt(s, c, 1.15, y, 3.1, 0.54, { size: 12.5, bold: true, color: C.ink, valign: 'middle' });
      if (i < chain.length - 1) arrow(s, 2.45, y + 0.54, 2.45, y + 0.66, C.teal, 1.25);
    });
    const cards = [
      ['LuBadgeCheck', 'FHIR R4 + International Patient Summary', 'Modèle standard avec validation, versionnage et recherche — prêt pour les services nationaux et les hôpitaux.'],
      ['LuHistory', "L'historique n'est jamais réécrit", 'Versions en ajout seul · notes signées, puis addenda · « saisie erronée » au lieu de suppression.'],
      ['LuFileLock', 'Altération détectable', 'Chaîne de hachage par patient · racine de Merkle quotidienne signée dans le HSM, horodatée, stockée en WORM.'],
      ['LuUserCheck', 'La bonne personne, le bon motif', 'Patient · mandataire · autorisation de soin (30 j) · partage · bris de glace. Pharmaciens et personnel : aucun accès.'],
    ];
    for (const [i, [ic, t, d]] of cards.entries()) {
      const x = 4.7 + (i % 2) * 4.07;
      const y = 1.55 + Math.floor(i / 2) * 2.0;
      box(s, x, y, 3.95, 1.85, { fill: C.white, line: C.slateLine, shadow: true });
      await iconIn(s, ic, x + 0.2, y + 0.2, 0.55, C.tealLight, C.teal);
      txt(s, t, x + 0.9, y + 0.2, 2.95, 0.6, { size: 13.5, bold: true, color: C.ink, valign: 'middle' });
      txt(s, d, x + 0.2, y + 0.9, 3.6, 0.9, { size: 11.5, color: C.muted });
    }
    box(s, 4.7, 5.62, 8.03, 1.2, { fill: C.amberLight, line: C.amberLine });
    txt(s, 'MASQUAGE ET CAVIARDAGE (M4)', 4.9, 5.72, 5, 0.3, { size: 11, bold: true, color: C.amberDark, cs: 1 });
    txt(s, 'Agent de support : +33 6 •• •• •• 42   ·   Pharmacien : aucun diagnostic   ·   Bris de glace : notes de psychothérapie exclues   ·   Patient : résultats publiés après revue   ·   Journaux : jamais de donnée de santé', 4.9, 6.05, 7.7, 0.7, { size: 11, color: C.text });
  }

  // ---------------------------------------------------------------- 8. Accès d'urgence (H3)
  {
    const s = newSlide({ note:
`Priorité HAUTE H3 — l'accès d'urgence (2 min).
En urgence, chaque minute compte : l'accès n'est donc jamais bloqué par un circuit d'approbation ; il est étroit, limité dans le temps, et justifié a posteriori.
Le soignant identifie le patient par correspondance exacte uniquement, déclare l'urgence avec un motif, se ré-authentifie avec une passkey ou une carte e-CPS, et obtient immédiatement une autorisation en lecture seule de quatre heures. Le résumé patient international — allergies, problèmes, traitements, groupe sanguin, directives — revient en moins de 300 millisecondes.
Traçabilité : l'enregistrement d'audit est écrit dans la même transaction, le DPO est alerté en temps réel, le patient est informé sous 24 heures, et chaque cas est revu sous 72 heures.
Et cela résiste aux pannes : déploiement séparé, synthèses pré-calculées sur des répliques, actif dans deux régions.` });
    title(s, 'PRIORITÉ HAUTE · H3', "L'accès d'urgence en quelques secondes — justifié a posteriori", C.coral);
    const steps = [
      ['Identifier', 'Correspondance exacte : INS, ou nom + date de naissance + sexe'],
      ['Déclarer', 'Code motif + justification en texte libre'],
      ['MFA renforcée', 'Passkey ou carte · droit et opposition vérifiés'],
      ['Accès limité', '4 heures · lecture seule · ce patient uniquement'],
      ['Synthèse < 1 s', 'Allergies, problèmes, traitements, groupe sanguin, directives'],
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
    txt(s, "≈ 30 s pour le soignant  ·  p95 < 300 ms par appel d'API  ·  disponibilité 99,99 %  ·  actif dans deux régions", 0.6, 3.5, 12.13, 0.46, { size: 14, bold: true, color: C.white, align: 'center', valign: 'middle' });
    box(s, 0.6, 4.18, 5.95, 2.65, { fill: C.coralLight, line: C.coralLine });
    await iconIn(s, 'LuEye', 0.8, 4.33, 0.45, C.white, C.coral);
    txt(s, 'Garde-fous — justifié a posteriori', 1.4, 4.35, 5, 0.4, { size: 15, bold: true, color: C.coralDark });
    bullets(s, ["Événement d'audit écrit dans la même transaction que l'accès", 'Alerte en temps réel au DPO (SIEM)', 'Patient informé sous 24 h : qui, quand, quoi', 'Revue obligatoire sous 72 h ; abus → suspension', "Opposition possible du patient lorsque la loi le permet"], 0.85, 4.9, 5.55, 1.9, { size: 13, color: C.coralDark, psa: 6 });
    box(s, 6.78, 4.18, 5.95, 2.65, { fill: C.tealLight, line: C.tealLine });
    await iconIn(s, 'LuShieldCheck', 6.98, 4.33, 0.45, C.white, C.teal);
    txt(s, 'Niveau 0 — résiste aux pannes', 7.58, 4.35, 5, 0.4, { size: 15, bold: true, color: C.petrol });
    bullets(s, ['Déploiement séparé à capacité réservée (cloisonnement)', 'Synthèse pré-calculée lue sur des répliques locales', "Active dans la région de secours, avec sa propre base d'accès", 'Contrôles des jetons et politiques en local (clés, OPA)', "Audit mis en tampon dans l'outbox si la chaîne est en panne"], 7.03, 4.9, 5.55, 1.9, { size: 13, color: C.text, psa: 6 });
  }

  // ---------------------------------------------------------------- 9. Chiffrement et intégrité (H1, H5)
  {
    const s = newSlide({ note:
`Priorités HAUTES H1 et H5 — chiffrement et intégrité (1 min 30).
En transit, aucun saut en clair : TLS 1.3 en périphérie, TLS mutuel entre services, TLS vérifié vers chaque base de données, et chiffrement de bout en bout pour la vidéo. Comme les données de santé doivent rester secrètes pendant des décennies, nous activons l'échange de clés hybride post-quantique lorsqu'il est pris en charge.
Au repos, deux couches indépendantes : le chiffrement du stockage partout, plus un chiffrement applicatif avec une clé par patient, elle-même protégée par des clés qui ne quittent jamais les modules matériels de sécurité. Une sauvegarde volée est inutilisable, et détruire les clés d'un patient en fin de conservation rend toutes les copies illisibles.
L'intégrité est garantie par les contraintes et l'historique en ajout seul, et prouvée par les chaînes de hachage, les sommes de contrôle et des sauvegardes immuables que nous restaurons chaque semaine.` });
    title(s, 'PRIORITÉ HAUTE · H1 · H5', 'Chiffré partout, une intégrité démontrable', C.coral);
    const colW = 3.93;
    const heads = [['LuLock', 'En transit', C.teal], ['LuKeyRound', "Au repos — chiffrement d'enveloppe", C.indigo], ['LuFileCheck', 'Intégrité', C.petrol]];
    for (const [i, [ic, t, col]] of heads.entries()) {
      const x = 0.6 + i * (colW + 0.17);
      await iconIn(s, ic, x, 1.55, 0.5, null, col);
      txt(s, t, x + 0.62, 1.58, colW - 0.6, 0.45, { size: 15, bold: true, color: col });
    }
    const transit = [['Applications ↔ périmètre', 'TLS 1.3 · HSTS · épinglage · hybride post-quantique'], ['Service ↔ service', 'mTLS dans le maillage, mode STRICT'], ['Service ↔ données', 'TLS verify-full, identifiants éphémères'], ['Vidéo et audio', 'DTLS-SRTP + bout en bout (SFrame)'], ['Partenaires', 'mTLS + OAuth 2.0 · webhooks signés']];
    transit.forEach(([a, b], i) => {
      const y = 2.2 + i * 0.9;
      box(s, 0.6, y, colW, 0.78, { fill: C.tealLight, line: C.tealLight });
      txt(s, a, 0.78, y + 0.07, colW - 0.3, 0.32, { size: 12.5, bold: true, color: C.ink });
      txt(s, b, 0.78, y + 0.4, colW - 0.3, 0.33, { size: 11, color: C.muted });
    });
    const x2 = 0.6 + colW + 0.17;
    const lv = [['Clés racines dans le HSM', 'FIPS 140-3 niveau 3 · jamais exportées', C.petrol, C.white, C.mint], ['KEK par service · env. · classe', 'dans le KMS · renouvelée chaque année · usage journalisé', C.indigoLight, C.ink, C.muted], ['Clé de données par patient / fichier / chat', 'AES-256-GCM · ≤ 5 min en mémoire', C.indigoLight, C.ink, C.muted], ['Chiffré + chiffrement du stockage', 'deux couches indépendantes', C.tealLight, C.ink, C.muted]];
    lv.forEach(([a, b, bg, tc, dc], i) => {
      const y = 2.2 + i * 1.12;
      box(s, x2, y, colW, 0.86, { fill: bg, line: bg === C.petrol ? C.petrol : C.indigoLine });
      txt(s, a, x2 + 0.18, y + 0.08, colW - 0.3, 0.35, { size: 12.5, bold: true, color: tc });
      txt(s, b, x2 + 0.18, y + 0.45, colW - 0.3, 0.35, { size: 10.5, color: dc });
      if (i < lv.length - 1) arrow(s, x2 + colW / 2, y + 0.86, x2 + colW / 2, y + 1.12, C.indigo, 1.5);
    });
    txt(s, "Crypto-effacement : détruire les clés d'un patient en fin de conservation → toute copie devient illisible", x2, 6.7 - 0.2, colW, 0.5, { size: 10.5, italic: true, color: C.indigo });
    const x3 = 0.6 + 2 * (colW + 0.17);
    const integ = ['Transactions ACID, contraintes, concurrence optimiste', 'Historique en ajout seul + chaînes de hachage par patient', 'Ancrages quotidiens signés en stockage WORM', 'SHA-256 sur chaque fichier · dépôts analysés', 'Sauvegardes immuables inter-comptes · restauration testée chaque semaine'];
    for (const [i, t] of integ.entries()) {
      const y = 2.2 + i * 0.9;
      box(s, x3, y, colW, 0.78, { fill: C.slateLight, line: C.slateLight });
      s.addImage({ data: await icon('LuCircleCheck', C.teal), x: x3 + 0.15, y: y + 0.22, w: 0.34, h: 0.34 });
      txt(s, t, x3 + 0.6, y, colW - 0.7, 0.78, { size: 11.5, color: C.text, valign: 'middle' });
    }
  }

  // ---------------------------------------------------------------- 10. Parcours de soin (moyenne)
  {
    const s = newSlide({ note:
`Priorités MOYENNES — les parcours de soin (1 min 30).
Planification : un blocage court et une contrainte de base de données rendent la double réservation impossible ; listes d'attente et file urgente servent les cas prioritaires, et les signes d'alerte redirigent vers le 15 ou le 112. Les agendas externes ne sont lus qu'en libre / occupé — aucune donnée patient ne sort de MedX.
Consultation : un serveur média WebRTC auto-hébergé dans l'UE, avec qualité adaptative, repli en audio seul et chiffrement de bout en bout pour les appels en tête-à-tête ; chat et partage de fichiers sont conservés de manière sécurisée.
Ordonnances : contrôles de sécurité face aux allergies du patient à la signature, signature dans un module matériel, et une révocation qui parvient à la pharmacie comme alerte critique. Le masquage garantit que les pharmaciens ne voient que ce qu'exige la délivrance.` });
    title(s, 'PRIORITÉ MOYENNE · M1 – M5', 'Des parcours de soin construits sur le socle sécurisé', C.amberDark);
    const cols = [
      ['LuCalendarClock', 'Planification et agendas', 'M1 · M5', "Une contrainte d'exclusion PostgreSQL sur (médecin, plage horaire) rend physiquement impossible tout chevauchement.", ['Blocage 10 min + contrainte d\'exclusion → aucune double réservation', "Liste d'attente et file urgente pour les médecins de garde ; signes d'alerte → 15 / 112", 'Médecins notifiés en direct (WebSocket + push)', 'Google · Microsoft · CalDAV : libre / occupé uniquement']],
      ['LuVideo', 'Consultation', 'M2', 'Le plan de contrôle (salles, jetons) est séparé du plan média (SFU) : le média ne touche jamais les services métier.', ["Salle d'attente, jetons de salle éphémères", "SFU WebRTC auto-hébergé dans l'UE + TURN sur 443", 'Simulcast, repli audio, reconnexion auto', 'Bout en bout en tête-à-tête · aucun enregistrement', 'Chat avec accusés · fichiers analysés et chiffrés']],
      ['LuPill', 'Ordonnances et masquage', 'M3 · M4', 'Deux machines à états — statut légal (prescripteur) et délivrance (pharmacie) : jamais « prête » si elle est révoquée.', ['Contrôles allergies et interactions à la signature', 'Signature dans un HSM · QR code vérifiable en pharmacie', 'Modifier = nouvelle version signée ; révoquer = alerte critique', 'Le pharmacien ne voit que ce qu\'exige la délivrance']],
    ];
    for (const [i, [ic, t, tag, key, items]] of cols.entries()) {
      const x = 0.6 + i * 4.1;
      box(s, x, 1.55, 3.93, 5.27, { fill: C.white, line: C.amberLine, shadow: true });
      await iconIn(s, ic, x + 0.22, 1.75, 0.66, C.amberLight, C.amberDark);
      txt(s, t, x + 1.05, 1.75, 2.8, 0.4, { size: 15, bold: true, color: C.ink });
      txt(s, tag, x + 1.05, 2.12, 2.8, 0.3, { size: 11.5, bold: true, color: C.amberDark });
      bullets(s, items, x + 0.25, 2.65, 3.5, 2.6, { size: 11.5, psa: 5 });
      box(s, x + 0.2, 5.3, 3.53, 1.35, { fill: C.amberLight, line: C.amberLight });
      txt(s, 'MÉCANISME CLÉ', x + 0.38, 5.4, 3.2, 0.28, { size: 10, bold: true, color: C.amberDark, cs: 1 });
      txt(s, key, x + 0.38, 5.68, 3.2, 0.92, { size: 11, color: C.text });
    }
  }

  // ---------------------------------------------------------------- 11. Écosystème (basse)
  {
    const s = newSlide({ note:
`Priorités BASSES — conçues maintenant, livrées en dernier (1 min).
Ces services complètent la plateforme. L'interface pharmacie offre un portail web à chaque pharmacie dès le premier jour et une API avec webhooks signés pour les logiciels intégrés.
Les notifications ont des files de priorité : une alerte de révocation n'est jamais bloquée derrière des rappels, et elles ne contiennent jamais de données de santé.
La facturation utilise les champs hébergés du prestataire de paiement : les numéros de carte ne touchent jamais MedX, ce qui nous maintient dans le périmètre PCI le plus léger.
Enfin, les environnements hors production ne voient que des données synthétiques ou anonymisées.` });
    title(s, 'PRIORITÉ BASSE · B1 – B6', "Services de l'écosystème — conçus maintenant, livrés en dernier", C.slate);
    const cards = [
      ['LuStore', 'Interface pharmacie', 'B1', "En attendant : ordonnance imprimable avec QR code vérifiable, utilisable dans n'importe quelle pharmacie", ['Portail pour chaque pharmacie + API partenaire avec webhooks signés', 'Statuts : reçue → prête → délivrée', 'Adaptateurs de stocks, disponibilité à proximité']],
      ['LuBellRing', 'Notifications', 'B2 · B3', 'Une version transactionnelle minimale (confirmations, rappels) arrive avec les fonctionnalités moyennes', ['SMS · e-mail · push · in-app, avec files de priorité', 'Préférences, heures de silence, plafonds de fréquence', 'Suivi de distribution et de lecture — messages sans santé']],
      ['LuCreditCard', 'Facturation et remboursements', 'B5 · B6', 'Acheté, pas construit : le prestataire porte les données de carte et la lutte contre la fraude', ['Champs hébergés par le PSP → PCI DSS SAQ A', 'Pré-autorisation à la réservation, encaissement après', 'Grand livre, factures, avoirs, remboursements à double validation']],
      ['LuFlaskConical', 'Anonymisation', 'B4', 'Règle dès le premier jour : les données de santé de production ne quittent jamais la production', ['Patients synthétiques pour dév, préprod, démo', "Chaîne d'anonymisation avec k-anonymat", 'Validation du DPO · clés de production inutilisables ailleurs']],
    ];
    for (const [i, [ic, t, tag, meanwhile, items]] of cards.entries()) {
      const x = 0.6 + (i % 2) * 6.1;
      const y = 1.55 + Math.floor(i / 2) * 2.68;
      box(s, x, y, 5.93, 2.5, { fill: C.slateLight, line: C.slateLine });
      await iconIn(s, ic, x + 0.22, y + 0.22, 0.62, C.white, C.slate);
      txt(s, t, x + 1.0, y + 0.22, 4.6, 0.4, { size: 16, bold: true, color: C.ink });
      txt(s, tag, x + 1.0, y + 0.58, 3.8, 0.3, { size: 11.5, bold: true, color: C.slate });
      bullets(s, items, x + 0.3, y + 1.0, 5.4, 0.95, { size: 12, psa: 3 });
      txt(s, meanwhile, x + 0.3, y + 1.98, 5.4, 0.45, { size: 10.5, italic: true, color: C.slate });
    }
  }

  // ---------------------------------------------------------------- 12. Données et stockage
  {
    const s = newSlide({ note:
`Modèle de données et stockage (1 min 30).
Chaque service possède sa base de données. PostgreSQL est notre choix par défaut car transactions et contraintes protègent l'intégrité — par exemple la contrainte d'exclusion qui interdit la double réservation, ou le grand livre en partie double toujours équilibré.
Nous n'ajoutons un stockage spécialisé que lorsque PostgreSQL convient mal : Cassandra pour les journaux en ajout intensif avec expiration, le stockage objet pour 150 téraoctets de documents avec conservation en écriture unique, Redis et OpenSearch pour des données dérivées toujours reconstructibles.
Les données cliniques sont modélisées en FHIR et conservées 20 ans ; au terme, le crypto-effacement les rend irrécupérables.` });
    title(s, 'MODÈLE DE DONNÉES ET STOCKAGE', 'PostgreSQL par défaut, stockages spécialisés seulement si justifié');
    const H = (t) => ({ text: t, options: { bold: true, color: C.white, fill: { color: C.petrol } } });
    const rows = [
      [H('Composant'), H('Système de référence'), H('Utilise aussi'), H('Pourquoi')],
      ['① Utilisateurs', 'PostgreSQL', 'Redis (sessions)', 'Identités ; e-mail chiffré + index aveugle'],
      ['② Planification', 'PostgreSQL', 'Redis · OpenSearch', "Contrainte d'exclusion : pas de double réservation"],
      ['③ Consultation', 'PostgreSQL', 'Cassandra (chat, 30 j)', 'Chat en ajout intensif avec expiration'],
      ['④ Dossier patient', 'PostgreSQL (FHIR JSONB)', 'Répliques ×3 + PRA', 'ACID, versions, chaîne de hachage · ≈ 10 To'],
      ['⑤ Ordonnances', 'PostgreSQL', 'OpenSearch (médicaments)', 'Versions signées et immuables'],
      ['⑥ Pharmacie', 'PostgreSQL + PostGIS', 'Redis (disponibilités)', 'Recherche géographique, statuts'],
      ['⑦ Notification', 'Cassandra', 'PostgreSQL · Redis', 'Journal très sollicité, TTL 13 mois'],
      ['⑧ Facturation', 'PostgreSQL', 'Stockage objet (PDF)', 'Grand livre en partie double, ajout seul'],
      ['Documents', 'Stockage objet', 'PostgreSQL (métadonnées)', '≈ 150 To · versions · Object Lock'],
      ["Piste d'audit", 'Stockage objet (WORM)', 'OpenSearch · SIEM', 'Archive à altération détectable'],
    ].map((r, i) => (i === 0 ? r : r.map((c, j) => ({ text: c, options: { bold: j === 0, color: C.text, fill: { color: i % 2 ? C.white : C.slateLight } } }))));
    s.addTable(rows, { x: 0.6, y: 1.55, w: 8.45, colW: [1.7, 2.1, 2.05, 2.6], fontFace: F, fontSize: 10.5, border: { type: 'solid', color: C.slateLine, pt: 0.5 }, rowH: 0.43, valign: 'middle', margin: [0.03, 0.08, 0.03, 0.08] });
    box(s, 9.3, 1.55, 3.43, 5.25, { fill: C.tealLight, line: C.tealLine });
    txt(s, 'PRINCIPES', 9.5, 1.7, 3, 0.3, { size: 11, bold: true, color: C.teal, cs: 1 });
    bullets(s, ['Une base par service ; références par identifiant uniquement', "Classer d'abord : C0 public → C4 données de santé sensibles", 'Données cliniques, légales et financières en ajout seul', "Caches et index reconstructibles, jamais l'unique copie", 'Dossier conservé 20 ans, puis crypto-effacé', 'Tout est chiffré, privé, sauvegardé, supervisé'], 9.5, 2.1, 3.05, 4.6, { size: 12, psa: 9 });
  }

  // ---------------------------------------------------------------- 13. Scalabilité et performances
  {
    const s = newSlide({ note:
`Scalabilité et performances (1 min 30).
En année 3, nous attendons environ 4 à 5 000 requêtes par seconde en pointe, et nous concevons pour 10 000 ; 10 000 appels simultanés représentent environ 24 gigabits par seconde à travers une centaine de serveurs média.
Les leviers : des services sans état mis à l'échelle sur leur vrai goulet, des disponibilités et synthèses pré-calculées, Kafka pour absorber les pics, et une trajectoire claire pour les bases de données — répliques, partitions, puis sharding par patient, et enfin cellules régionales.
Le budget de latence du chemin d'urgence montre la marge de la conception : environ 40 à 70 millisecondes typiquement, pour un objectif de 300 millisecondes. Tout est testé en charge à deux fois la pointe prévue avant chaque version majeure.` });
    title(s, 'SCALABILITÉ ET PERFORMANCES', 'Conçue pour une croissance × 10, testée à 2× la pointe');
    const st = [['5 k → 10 k', "req/s d'API en pointe → capacité conçue"], ['10 k', 'appels vidéo simultanés ≈ 100 nœuds SFU'], ['24 Gbit/s', 'de trafic média sortant en pointe (année 3)'], ['150 To', 'de documents en stockage objet']];
    st.forEach(([n, l], i) => {
      const x = 0.6 + i * 3.08;
      box(s, x, 1.55, 2.9, 1.2, { fill: C.white, line: C.slateLine, shadow: true });
      txt(s, n, x, 1.62, 2.9, 0.6, { size: 26, bold: true, color: C.teal, align: 'center' });
      txt(s, l, x + 0.1, 2.22, 2.7, 0.45, { size: 11, color: C.muted, align: 'center' });
    });
    const lev = [['LuTrendingUp', 'Mise à l\'échelle sur le vrai goulet', 'Débit, connexions, retard de file, participants'], ['LuZap', 'Pré-calculer les chemins critiques', "Disponibilités, synthèses d'urgence"], ['LuWorkflow', 'Absorber les pics avec Kafka', 'Files de priorité pour les notifications'], ['LuDatabase', 'Répliques → partitions → shards', 'Dossier partitionné par patient si déclenché'], ['LuRadio', 'Vidéo adaptative', 'Simulcast, audio d\'abord, vidange au retrait'], ['LuGlobe', 'Cellules régionales', 'Copies isolées par pays / population']];
    for (const [i, [ic, t, d]] of lev.entries()) {
      const x = 0.6 + (i % 3) * 4.1;
      const y = 3.0 + Math.floor(i / 3) * 0.95;
      box(s, x, y, 3.93, 0.82, { fill: C.slateLight, line: C.slateLight });
      await iconIn(s, ic, x + 0.14, y + 0.16, 0.5, C.white, C.teal);
      txt(s, t, x + 0.78, y + 0.08, 3.1, 0.33, { size: 12, bold: true, color: C.ink });
      txt(s, d, x + 0.78, y + 0.42, 3.1, 0.33, { size: 10.5, color: C.muted });
    }
    txt(s, "BUDGET DE LATENCE DU CHEMIN D'URGENCE (côté serveur)", 0.6, 5.08, 8, 0.3, { size: 11, bold: true, color: C.slate, cs: 1 });
    const segs = [['Passerelle', 5, C.slate], ['Politique', 1, C.coral], ['Accès + audit', 15, C.indigo], ['Lecture synthèse', 10, C.teal], ['Clé + déchiffrement', 6, C.petrol2]];
    const total = 300;
    const barX = 0.6;
    const barW = 12.13;
    box(s, barX, 5.45, barW, 0.55, { fill: C.slateLight, line: C.slateLine, r: 0.05 });
    let cx = barX;
    const scale = (barW * 0.8) / total; // 300 ms à 80 % de la largeur de la barre
    segs.forEach(([l, ms, col]) => {
      const w = Math.max(ms * scale, 0.04);
      s.addShape(pres.shapes.RECTANGLE, { x: cx, y: 5.45, w, h: 0.55, fill: { color: col }, line: { color: col, width: 0.5 } });
      cx += w;
    });
    s.addShape(pres.shapes.LINE, { x: barX + total * scale, y: 5.35, w: 0.001, h: 0.75, line: { color: C.coral, width: 2, dashType: 'dash' } });
    txt(s, 'objectif 300 ms (p95)', barX + total * scale + 0.08, 5.52, 2.3, 0.4, { size: 11, bold: true, color: C.coral, valign: 'middle' });
    txt(s, '≈ 40 à 70 ms en typique', cx + 0.12, 5.52, 2.8, 0.4, { size: 12, bold: true, color: C.petrol, valign: 'middle' });
    txt(s, 'Passerelle 5 ms · politique < 1 ms · accès + audit 15 ms · lecture de la synthèse 10 ms · clé + déchiffrement 6 ms — large marge pour la gigue réseau et les bascules', 0.6, 6.12, 12.1, 0.4, { size: 11, color: C.muted, italic: true });
    txt(s, 'Tests de charge, d\'endurance, de chaos et WebRTC à 2× la pointe prévue avant chaque version majeure · SLO avec budgets d\'erreur', 0.6, 6.47, 12.1, 0.35, { size: 11, color: C.muted, italic: true });
  }

  // ---------------------------------------------------------------- 14. Résilience et reprise
  {
    const s = newSlide({ note:
`Résilience et reprise après sinistre (1 min 30).
Les services sont regroupés en trois niveaux de criticité. Le niveau 0 — accès d'urgence et connexion — vise 99,99 % et continue de fonctionner même si toute la région principale est perdue, car il est actif dans les deux régions.
Dans une région, chaque niveau est répliqué sur trois zones de disponibilité avec un secours synchrone de la base : perdre une zone ne fait perdre aucune donnée. Entre régions, un secours tiède reçoit une réplication asynchrone avec moins d'une minute de perte potentielle ; les services de soin reviennent en moins d'une heure.
Sous charge extrême, le délestage suit un ordre fixe : l'accès d'urgence et les consultations en cours sont protégés en premier ; les analyses sont sacrifiées en premier.` });
    title(s, 'RÉSILIENCE ET REPRISE APRÈS SINISTRE', "Résilience par niveau — l'urgence survit à la perte d'une région");
    const H = (t) => ({ text: t, options: { bold: true, color: C.white, fill: { color: C.petrol } } });
    const rows = [
      [H('Niveau'), H('Périmètre'), H('Disponibilité'), H('RPO'), H('RTO (perte de région)')],
      [{ text: 'Niveau 0', options: { bold: true, color: C.coralDark, fill: { color: C.coralLight } } }, { text: "Accès d'urgence, connexion, lecture du dossier", options: { fill: { color: C.coralLight } } }, { text: '99,99 %', options: { bold: true, fill: { color: C.coralLight } } }, { text: '0 en région · ≤ 1 min', options: { fill: { color: C.coralLight } } }, { text: '≤ 15 min · actif dans les deux régions', options: { fill: { color: C.coralLight } } }],
      [{ text: 'Niveau 1', options: { bold: true } }, 'Écritures au dossier, consultation, planification, ordonnances', { text: '99,95 %', options: { bold: true } }, '0 en région · ≤ 1 min', '≤ 1 h'],
      [{ text: 'Niveau 2', options: { bold: true } }, 'Pharmacie, notification, facturation, analyses', { text: '99,9 %', options: { bold: true } }, '≤ 5 min', '≤ 4 h'],
    ];
    s.addTable(rows, { x: 0.6, y: 1.6, w: 6.6, colW: [0.8, 1.95, 1.1, 1.3, 1.45], fontFace: F, fontSize: 10.5, color: C.text, border: { type: 'solid', color: C.slateLine, pt: 0.5 }, rowH: [0.42, 0.8, 0.8, 0.8], valign: 'middle', margin: [0.04, 0.08, 0.04, 0.08] });
    // schéma des régions
    box(s, 7.5, 1.6, 2.5, 3.1, { fill: C.tealLight, line: C.teal, lw: 1.5 });
    txt(s, 'PRINCIPALE · PARIS', 7.6, 1.68, 2.3, 0.3, { size: 11, bold: true, color: C.teal });
    ['3 zones de disponibilité', 'Tous les services', 'Base primaire + secours sync.', 'Kafka × 3 brokers'].forEach((t, i) => chip(s, t, 7.65, 2.1 + i * 0.62, 2.2, 0.5, { size: 10, fill: C.white, line: C.tealLine }));
    box(s, 10.23, 1.6, 2.5, 3.1, { fill: C.indigoLight, line: C.indigo, lw: 1.5, dash: 'dash' });
    txt(s, 'SECOURS · FRANCFORT', 10.33, 1.68, 2.3, 0.3, { size: 11, bold: true, color: C.indigo });
    [["Accès d'urgence ACTIF", C.coralLight, C.coral], ['Fournisseur d\'identité ACTIF', C.coralLight, C.coral], ['Répliques (retard < 1 s)', C.white, C.indigoLine], ['Services à taille réduite', C.white, C.indigoLine]].forEach(([t, f, l], i) => chip(s, t, 10.38, 2.1 + i * 0.62, 2.2, 0.5, { size: 10, fill: f, line: l, bold: i < 2, color: i < 2 ? C.coralDark : C.text }));
    arrow(s, 10.0, 3.35, 10.23, 3.35, C.indigo, 2);
    txt(s, 'réplication asynchrone · chiffrée', 7.5, 4.8, 5.23, 0.3, { size: 10.5, italic: true, color: C.indigo, align: 'center' });
    txt(s, 'ORDRE DE DÉLESTAGE SOUS CHARGE EXTRÊME (protégé en premier → délesté en premier)', 0.6, 5.3, 12, 0.3, { size: 11, bold: true, color: C.slate, cs: 1 });
    const order = ["Accès d'urgence", 'Consultations en cours', 'Écritures cliniques', 'Réservation', 'Notifications', 'Analyses'];
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

  // ---------------------------------------------------------------- 15. Conformité et vie privée
  {
    const s = newSlide({ note:
`Sécurité et conformité (1 min 30).
Les données de santé placent MedX sous l'article 9 du RGPD : il faut une analyse d'impact avant le lancement, un DPO, et une notification des violations sous 72 heures. En France, l'hébergement exige la certification HDS : nous n'utilisons que des régions certifiées HDS dans l'Espace économique européen. Les règles de la télémédecine, NIS2, eIDAS pour les signatures, PCI DSS pour les paiements et l'Espace européen des données de santé sont couverts dès la conception, et une cellule américaine séparée rendrait MedX prête pour HIPAA.
La protection des données dès la conception se traduit par des règles concrètes : aucune donnée de santé dans les SMS, e-mails, agendas ou journaux ; les données de production ne quittent jamais la production ; les dossiers sont crypto-effacés en fin de conservation ; et les patients voient qui a consulté leur dossier.` });
    title(s, 'SÉCURITÉ ET CONFORMITÉ', "La conformité dès la conception, pas à l'audit");
    const regs = [
      ['RGPD', 'Données de santé (art. 9) · AIPD · DPO · notification sous 72 h'],
      ['HDS', "Hébergement certifié · données dans l'EEE"],
      ['Télémédecine', 'Patient identifié, consentement, compte rendu au dossier'],
      ['NIS2', 'Mesures de risque · signalement 24 h / 72 h'],
      ['eIDAS', 'Signature des ordonnances · horodatages qualifiés'],
      ['PCI DSS', 'SAQ A : données de carte uniquement chez le PSP'],
      ['EEDS (EHDS)', 'Accès et échange par le patient · journal des accès'],
      ['Prête pour HIPAA', 'Cellule américaine séparée, mêmes contrôles, BAA'],
    ];
    regs.forEach(([t, d], i) => {
      const x = 0.6 + (i % 2) * 3.6;
      const y = 1.55 + Math.floor(i / 2) * 1.32;
      box(s, x, y, 3.45, 1.18, { fill: C.white, line: C.slateLine, shadow: true });
      txt(s, t, x + 0.2, y + 0.12, 3.1, 0.35, { size: 15, bold: true, color: C.petrol });
      txt(s, d, x + 0.2, y + 0.5, 3.1, 0.62, { size: 11, color: C.muted });
    });
    box(s, 7.95, 1.55, 4.78, 5.15, { fill: C.tealLight, line: C.tealLine });
    await iconIn(s, 'LuShieldCheck', 8.15, 1.72, 0.5, C.white, C.teal);
    txt(s, 'Protection des données dès la conception', 8.8, 1.76, 3.8, 0.4, { size: 15, bold: true, color: C.petrol });
    bullets(s, ['Aucune donnée de santé dans les SMS, e-mails, push, agendas, événements ou journaux', 'Les données de production ne quittent jamais la production — données synthétiques ailleurs', 'Conservation 20 ans, puis crypto-effacement', 'Les patients voient qui a consulté leur dossier', 'Modèle de menaces STRIDE : 15 menaces majeures traitées', "Test d'intrusion avant le lancement puis chaque année ; ISO 27001 en années 1-2"], 8.2, 2.45, 4.35, 4.1, { size: 12.5, psa: 8 });
  }

  // ---------------------------------------------------------------- 16. Compromis
  {
    const s = newSlide({ note:
`Décisions clés et compromis (1 min 30).
Chaque décision a un coût, et nous avons choisi le coût que les priorités de MedX rendent acceptable.
Les microservices en zones de sécurité coûtent en complexité d'exploitation, mais isolent les données de santé et le chemin d'urgence. Le bris de glace sans approbation préalable accepte qu'un abus soit possible — il est détecté, revu et sanctionné — car une approbation préalable serait trop lente à 3 heures du matin aux urgences. Le chiffrement par patient ajoute la gestion des clés ; l'historique en ajout seul coûte environ 30 % de stockage en plus ; un serveur vidéo auto-hébergé implique d'exploiter une infrastructure média et de renoncer à l'enregistrement ; et nous réservons l'actif-actif complet au niveau 0 pour maîtriser les coûts.` });
    title(s, 'DÉCISIONS ET COMPROMIS', 'Ce que nous avons choisi — et ce à quoi nous avons renoncé');
    const H = (t) => ({ text: t, options: { bold: true, color: C.white, fill: { color: C.petrol } } });
    const data = [
      ['Microservices en zones de sécurité', 'Monolithe modulaire', 'H1 · H3', "Complexité d'exploitation"],
      ['Bris de glace + revue a posteriori', 'Approbation préalable', 'H3', 'Abus possible — détecté et sanctionné'],
      ["Chiffrement d'enveloppe par patient", 'Chiffrement des disques seul', 'H1', 'Gestion des clés, ≈ 1 ms par requête'],
      ['Historique en ajout seul + hachage', 'Mises à jour en place', 'H2 · H5', '≈ 30 % de stockage en plus'],
      ['SFU auto-hébergé + bout en bout', 'CPaaS vidéo', 'H1 · M2', 'Exploitation média, pas d\'enregistrement'],
      ['Actif-actif pour le niveau 0 seulement', 'Actif-actif complet', 'H3', 'Niveaux 1-2 rétablis en 1 à 4 h'],
      ['Champs de paiement hébergés (PSP)', 'Manipuler les cartes', 'B5', "Moins de maîtrise de l'interface"],
    ];
    const rows = [[H('Nous avons choisi'), H('Plutôt que'), H('Parce que'), H('Coût accepté')]].concat(
      data.map((r, i) => r.map((c, j) => ({ text: c, options: { bold: j === 0, color: j === 2 ? C.coralDark : C.text, fill: { color: i % 2 ? C.slateLight : C.white } } })))
    );
    s.addTable(rows, { x: 0.6, y: 1.6, w: 12.13, colW: [3.9, 2.9, 1.43, 3.9], fontFace: F, fontSize: 13, border: { type: 'solid', color: C.slateLine, pt: 0.5 }, rowH: 0.6, valign: 'middle', margin: [0.04, 0.12, 0.04, 0.12] });
    txt(s, 'Fiches de décision complètes (14 ADR) avec contexte, alternatives et conséquences : docs/06-decisions-architecture.md', 0.6, 6.55, 12.1, 0.35, { size: 11, italic: true, color: C.muted });
  }

  // ---------------------------------------------------------------- 17. Feuille de route
  {
    const s = newSlide({ note:
`Feuille de route (1 min).
Nous livrons dans l'ordre des priorités de MedX. La phase 0 construit les fondations de la plateforme. La phase 1 livre le socle clinique sécurisé — identité, dossier, intégrité, accès d'urgence et région de secours — et se termine par un jalon de sécurité : analyse d'impact, test d'intrusion et exercice de reprise.
La phase 2 ajoute les parcours de soin et se termine par un pilote avec des cliniques partenaires. La phase 3 apporte les pharmacies, le suivi des notifications, la facturation et l'anonymisation, puis le lancement public. Chaque phase a des critères de sortie mesurés, pas déclarés.` });
    title(s, 'FEUILLE DE ROUTE', 'Livrée dans l\'ordre des priorités de MedX');
    const ph = [
      ['Phase 0', 'Fondations', '≈ 2 mois', C.slate, C.slateLight, 'Sortie : tout construit depuis le code, 100 % des stockages chiffrés', ["Zone d'atterrissage, Kubernetes, maillage", 'KMS/HSM, Vault, audit, Kafka', 'CI/CD avec images signées']],
      ['Phase 1', 'Socle clinique sécurisé', 'HAUTE · ≈ 4 mois', C.coral, C.coralLight, 'Sortie : tests d\'autorisation verts, bris de glace < 300 ms, exercice PRA', ['Identité, politiques OPA', 'Dossier, intégrité, chiffrement', "Accès d'urgence + région de secours"]],
      ['Phase 2', 'Parcours de soin', 'MOYENNE · ≈ 4 mois', C.amberDark, C.amberLight, 'Sortie : test de charge à 2× la pointe, qualité vidéo atteinte', ['Planification + agendas', 'Vidéo, chat, fichiers', 'Ordonnances + masquage']],
      ['Phase 3', 'Écosystème', 'BASSE · ≈ 4 mois', C.slate, C.slateLight, 'Sortie : attestation PCI SAQ A, grand livre rapproché', ['Interface pharmacie', 'Notifications, préférences', 'Facturation, remboursements, anonymisation']],
      ['Phase 4', 'Croissance', 'en continu', C.teal, C.tealLight, 'Déclenchée par la croissance mesurée et les nouveaux marchés', ['Services nationaux de e-santé', 'Sharding, cellules régionales', 'ISO 27001, cellule US']],
    ];
    const w = 2.3;
    const gap = 0.16;
    s.addShape(pres.shapes.LINE, { x: 0.6, y: 2.05, w: 12.13, h: 0.001, line: { color: C.slateLine, width: 2, endArrowType: 'triangle' } });
    ph.forEach(([p, t, sub, col, bg, exit, items], i) => {
      const x = 0.6 + i * (w + gap);
      s.addShape(pres.shapes.OVAL, { x: x + w / 2 - 0.13, y: 1.92, w: 0.26, h: 0.26, fill: { color: col }, line: { color: C.white, width: 2 } });
      box(s, x, 2.4, w, 3.35, { fill: bg, line: col, lw: 1.25 });
      txt(s, p, x + 0.18, 2.52, w - 0.3, 0.3, { size: 12, bold: true, color: col });
      txt(s, t, x + 0.18, 2.82, w - 0.3, 0.4, { size: 15, bold: true, color: C.ink });
      txt(s, sub, x + 0.18, 3.22, w - 0.3, 0.3, { size: 11, bold: true, color: col });
      bullets(s, items, x + 0.2, 3.7, w - 0.35, 1.3, { size: 11.5, psa: 5 });
      txt(s, exit, x + 0.18, 5.0, w - 0.3, 0.7, { size: 10, italic: true, color: col });
    });
    const gates = [[1, 'Jalon : AIPD · test d\'intrusion · PRA'], [2, 'Pilote avec des cliniques partenaires'], [3, 'Lancement public']];
    gates.forEach(([i, t]) => {
      const x = 0.6 + i * (w + gap);
      box(s, x, 5.95, w, 0.62, { fill: C.petrol, line: C.petrol, r: 0.1 });
      txt(s, t, x + 0.08, 5.95, w - 0.16, 0.62, { size: 11, bold: true, color: C.white, align: 'center', valign: 'middle' });
    });
  }

  // ---------------------------------------------------------------- 18. Synthèse
  {
    const s = newSlide({ dark: true, note:
`Conclusion (30 s).
En résumé : la sécurité est la fondation — les données de santé sont chiffrées deux fois, chaque accès est autorisé et audité, et l'historique ne peut pas être réécrit. L'accès d'urgence fonctionne en quelques secondes, même pendant une panne régionale, tout en restant traçable. Et la plateforme monte en charge par conception, du lancement à dix fois la charge, grâce aux événements, à la mise à l'échelle automatique, au sharding et aux cellules régionales.
Tous les détails — conception des composants, modèles de données, calculs de capacité, contrôles de sécurité et fiches de décision — sont dans le dépôt. Merci ; je suis prêt à répondre à vos questions.` });
    txt(s, 'EN RÉSUMÉ', 0.8, 0.8, 8, 0.4, { size: 14, bold: true, color: C.mint, cs: 3 });
    txt(s, "Une plateforme zéro confiance, pilotée par les événements, où les données de santé sont chiffrées deux fois, l'historique ne peut pas être réécrit et l'accès d'urgence fonctionne en quelques secondes.", 0.8, 1.2, 11.6, 1.6, { size: 24, bold: true, color: C.white });
    const take = [
      ['LuShieldCheck', 'La sécurité comme fondation', 'TLS 1.3 / mTLS partout · clés par patient dans des HSM · RBAC + ABAC · audit immuable', C.coral],
      ['LuSiren', "Accès d'urgence en secondes", 'Bris de glace sur un chemin de niveau 0 isolé, actif dans deux régions, revu sous 72 h', C.coral],
      ['LuTrendingUp', 'Scalable par conception', 'Événements, mise à l\'échelle auto, répliques → shards → cellules · testée à 2× la pointe', C.teal],
    ];
    for (const [i, [ic, t, d, col]] of take.entries()) {
      const x = 0.8 + i * 3.95;
      box(s, x, 3.05, 3.7, 2.45, { fill: C.petrol2, line: '2B7285', r: 0.1 });
      await iconIn(s, ic, x + 0.25, 3.28, 0.7, col, C.white);
      txt(s, t, x + 0.25, 4.1, 3.3, 0.45, { size: 16, bold: true, color: C.white });
      txt(s, d, x + 0.25, 4.55, 3.25, 0.9, { size: 12, color: C.mint });
    }
    txt(s, 'Questions ?', 0.8, 5.95, 5, 0.6, { size: 28, bold: true, color: C.white });
    txt(s, 'Dossier de conception complet : docs/ · diagrammes/ · presentation/ · rapport/', 0.8, 6.55, 9, 0.35, { size: 13, color: C.mint });
  }

  // ---------------------------------------------------------------- Annexes
  const appendix = [
    ['ANNEXE A1', 'Architecture de haut niveau détaillée', 'medx-architecture-haut-niveau.png', "Vue détaillée des conteneurs avec chaque composant, zone, service de plateforme, stockage et système externe. À utiliser pour les questions de détail ; zoomer dans PowerPoint (l'image est en haute résolution)."],
    ['ANNEXE A2', 'Contexte du système (C4 niveau 1)', 'medx-contexte-systeme.png', 'Qui utilise MedX et de quels systèmes externes la plateforme dépend.'],
    ['ANNEXE A3', 'Déploiement et zones de sécurité', 'medx-deploiement.png', 'Région principale avec trois zones de disponibilité, région de secours tiède, pools de nœuds par zone de sécurité et un compte cloud par environnement.'],
    ['ANNEXE A4', "Accès d'urgence — flux détaillé", 'medx-acces-urgence.png', 'Les cinq étapes, les garde-fous et les mécanismes de résilience du bris de glace.'],
    ['ANNEXE A5', 'Chiffrement en transit et au repos', 'medx-chiffrement-cles.png', "Chaque canal chiffré et la hiérarchie des clés du chiffrement d'enveloppe."],
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
  const out = path.join(OUT_DIR, 'MedX-Solution-Technique.pptx');
  await pres.writeFile({ fileName: out });
  console.log('écrit', out, `${slideNo} diapositives`);
}

// Les notes de l'orateur sont aussi exportées en Markdown pour la répétition.
function exportNotes() {
  const md = [
    "# MedX — Texte de la présentation et notes de l'orateur",
    '',
    '> Présentation courte (≈ 15 à 18 minutes + questions). Une section par diapositive ; le même texte est intégré',
    "> comme notes de l'orateur dans `MedX-Solution-Technique.pptx`. Les diapositives 19 à 23 (annexes A1 à A5) servent",
    '> de support pour les questions.',
    '',
  ];
  for (const { no, note } of notes) {
    const [first, ...rest] = note.split('\n');
    md.push(`## Diapositive ${no} — ${first.replace(/\.$/, '')}`, '', rest.join('\n').trim() || first, '');
  }
  fs.writeFileSync(path.join(OUT_DIR, 'notes-orateur.md'), md.join('\n'));
  console.log('écrit notes-orateur.md');
}

build()
  .then(exportNotes)
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
