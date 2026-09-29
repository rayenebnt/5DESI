# Plateforme de santé MedX — Conception de la solution technique

**Mini-projet 5DESI.** Solution technique pour **MedX**, une plateforme de santé dédiée aux **téléconsultations**, à
la **gestion du dossier patient** et au **suivi des ordonnances** : architecture de haut niveau, conception détaillée
des composants, modèle de données et stratégie de stockage, scalabilité et performances, sécurité et conformité, et
une présentation.

> **En une phrase** — une plateforme zéro confiance, pilotée par les événements, de huit microservices regroupés en
> zones de sécurité, où les données de santé sont chiffrées deux fois (clés par patient dans un KMS adossé à des HSM,
> en plus du chiffrement du stockage), où l'historique clinique ne peut pas être réécrit en silence, et où un
> professionnel habilité obtient la synthèse critique d'un patient en moins d'une seconde en situation d'urgence —
> même si une région cloud entière tombe en panne.

![Architecture de haut niveau de MedX](diagrammes/medx-architecture-haut-niveau.png)

## Livrables

| # | Livrable (sujet) | Où |
|---|------------------|----|
| 1 | **Diagramme d'architecture de haut niveau** | [docs/01 — Architecture de haut niveau](docs/01-architecture-haut-niveau.md) · diagrammes : [architecture](diagrammes/medx-architecture-haut-niveau.png) ([SVG](diagrammes/medx-architecture-haut-niveau.svg)), [contexte du système](diagrammes/medx-contexte-systeme.png), [déploiement et zones de sécurité](diagrammes/medx-deploiement.png) |
| 2 | **Conception détaillée des composants** | [docs/02 — Conception des composants](docs/02-conception-composants/README.md) : un document par composant (8 services + composants de plateforme) |
| 3 | **Modèle de données et stratégie de stockage** | [docs/03 — Modèle de données et stockage](docs/03-modele-donnees-et-stockage.md) |
| 4 | **Scalabilité et performances** | [docs/04 — Scalabilité et performances](docs/04-scalabilite-et-performances.md) |
| 5 | **Mesures de sécurité et de conformité** | [docs/05 — Sécurité et conformité](docs/05-securite-et-conformite.md) · [diagramme du chiffrement](diagrammes/medx-chiffrement-cles.png) · [accès d'urgence](diagrammes/medx-acces-urgence.png) |
| 6 | **Présentation** | [presentation/MedX-Solution-Technique.pptx](presentation/MedX-Solution-Technique.pptx) (18 diapositives + 5 diapositives d'annexe, notes de l'orateur incluses) · [PDF](presentation/MedX-Solution-Technique.pdf) · [texte de l'oral](presentation/notes-orateur.md) |
| + | **Dossier consolidé** (tout ce qui précède en un seul fichier) | [rapport/MedX-Dossier-Conception-Technique.pdf](rapport/MedX-Dossier-Conception-Technique.pdf) · [HTML](rapport/MedX-Dossier-Conception-Technique.html) |

Documents complémentaires : [0 — Contexte, hypothèses et objectifs](docs/00-contexte-et-hypotheses.md) ·
[6 — Décisions d'architecture et compromis](docs/06-decisions-architecture.md) ·
[7 — Matrice de traçabilité des exigences](docs/07-tracabilite-exigences.md) ·
[8 — Feuille de route et risques](docs/08-feuille-de-route-et-risques.md).

## Guide de lecture (15 minutes)

1. Cette page, puis la [présentation](presentation/MedX-Solution-Technique.pdf) — toute la conception en 18
   diapositives.
2. [§1.1 Vue d'ensemble de l'architecture](docs/01-architecture-haut-niveau.md#11-vue-densemble-de-larchitecture) et
   [§1.7 Flux de bout en bout clés](docs/01-architecture-haut-niveau.md#17-flux-de-bout-en-bout-clés).
3. Le cœur de priorité haute : [Dossier patient et accès d'urgence](docs/02-conception-composants/04-dossier-patient.md)
   et [Gestion des utilisateurs](docs/02-conception-composants/01-gestion-utilisateurs.md).
4. [Décisions et compromis](docs/06-decisions-architecture.md) et la
   [matrice de traçabilité](docs/07-tracabilite-exigences.md).

## La conception en huit décisions

1. **Huit microservices, un par composant du sujet**, regroupés en **zones de sécurité** (identité, clinique,
   communication, paiement) — les données de santé restent dans la zone clinique.
2. **HL7 FHIR R4** (+ International Patient Summary) comme modèle de données clinique, sur **PostgreSQL** ; historique
   en ajout seul, **chaînes de hachage** par patient et ancrages quotidiens signés rendent toute altération du dossier
   détectable.
3. **Accès d'urgence par bris de glace** : identification par correspondance exacte, justification, MFA renforcée,
   autorisation en lecture seule de 4 heures, synthèse critique en < 300 ms, alerte en temps réel et revue obligatoire
   sous 72 h — sur un **chemin de niveau 0 isolé, actif dans deux régions**.
4. **Keycloak** (OIDC, MFA, passkeys, fédération e-CPS) pour l'authentification et politiques **OPA** (RBAC + ABAC :
   relation de soin, consentement, finalité) évaluées à côté de chaque service.
5. **Chiffrement partout** : TLS 1.3 en périphérie, mTLS dans le maillage, DTLS-SRTP + chiffrement de bout en bout pour
   la vidéo, chiffrement AES-256 du stockage **plus** chiffrement d'enveloppe par patient avec des clés dans un KMS
   adossé à des HSM (crypto-effacement en fin de conservation).
6. **Intégration pilotée par les événements** avec Kafka et l'outbox transactionnelle — appels synchrones uniquement
   quand un utilisateur attend.
7. **Aucune donnée de santé hors de la frontière de confiance** : SMS, e-mails, agendas, événements et journaux n'en
   contiennent aucune ; les environnements hors production n'utilisent que des données synthétiques ou anonymisées.
8. **Livraison dans l'ordre des priorités de MedX** : socle clinique sécurisé (haute) → parcours de soin (moyenne) →
   services de l'écosystème (basse).

## Priorités de MedX → conception

| Priorité | Exigence | Réponse de conception |
|----------|----------|-----------------------|
| **Haute** | H1 Confidentialité des données (au repos et en transit) | [§5.5-5.6](docs/05-securite-et-conformite.md#55-chiffrement-en-transit) deux couches de chiffrement, clés par patient, TLS 1.3 / mTLS |
| **Haute** | H2 Gestion du dossier patient | [§2.4](docs/02-conception-composants/04-dossier-patient.md) entrepôt FHIR, notes signées, consentement, audit complet |
| **Haute** | H3 Accès d'urgence | [§2.4 bris de glace](docs/02-conception-composants/04-dossier-patient.md#accès-durgence-bris-de-glace), niveau 0, deux régions |
| **Haute** | H4 Authentification et autorisation | [§2.1](docs/02-conception-composants/01-gestion-utilisateurs.md) Keycloak + OPA (RBAC + ABAC) |
| **Haute** | H5 Intégrité des données et fichiers sécurisés | [§3.8](docs/03-modele-donnees-et-stockage.md#38-mécanismes-dintégrité-des-données) ajout seul, chaînes de hachage, Object Lock, sauvegardes immuables |
| Moyenne | M1–M5 Planification, consultation, ordonnances, masquage, agendas | [§2.2](docs/02-conception-composants/02-planification.md), [§2.3](docs/02-conception-composants/03-consultation.md), [§2.5](docs/02-conception-composants/05-ordonnances.md), [§5.7](docs/05-securite-et-conformite.md#57-masquage-caviardage-et-anonymisation) |
| Basse | B1–B6 Pharmacie, préférences, suivi des notifications, anonymisation, paiements, remboursements | [§2.6-2.8](docs/02-conception-composants/README.md), [§5.7](docs/05-securite-et-conformite.md#57-masquage-caviardage-et-anonymisation) |

Les 16 exigences de priorité et les 30 fonctionnalités de l'Annexe 1 sont rattachées à la conception dans la
[matrice de traçabilité](docs/07-tracabilite-exigences.md).

> **Convention** — les priorités basses de l'Annexe 2 (« Low ») sont notées **B1 à B6** dans tout le dossier.

## Structure du dépôt

```text
.
├── README.md                     ← vous êtes ici
├── docs/                         ← les documents de conception (Markdown, les diagrammes s'affichent sur GitHub)
│   ├── 00-contexte-et-hypotheses.md
│   ├── 01-architecture-haut-niveau.md         (livrable 1)
│   ├── 02-conception-composants/              (livrable 2 : README + 9 documents de composants)
│   ├── 03-modele-donnees-et-stockage.md       (livrable 3)
│   ├── 04-scalabilite-et-performances.md      (livrable 4)
│   ├── 05-securite-et-conformite.md           (livrable 5)
│   ├── 06-decisions-architecture.md
│   ├── 07-tracabilite-exigences.md
│   └── 08-feuille-de-route-et-risques.md
├── diagrammes/                   ← diagrammes d'architecture (sources SVG + rendus PNG)
├── presentation/                 ← livrable 6 : PPTX, export PDF, notes de l'orateur
├── rapport/                      ← dossier de conception consolidé (PDF + HTML autonome)
└── outils/                       ← scripts qui régénèrent diagrammes, rapport et diapositives
```

## Régénérer les livrables

Tout le contenu de `diagrammes/`, `rapport/` et `presentation/` est généré à partir des sources de ce dépôt :

```bash
cd outils
npm install                 # Node 20+ ; utilise un Chromium local via playwright-core (définir CHROME_PATH si besoin)
npm run diagrams            # diagrammes/*.svg + *.png à partir de outils/diagrammes/*.diagram.js
npm run check               # valide chaque diagramme Mermaid, lien relatif et ancre des documents
npm run report              # rapport/MedX-Dossier-Conception-Technique.html + .pdf à partir de docs/*.md
npm run slides              # presentation/MedX-Solution-Technique.pptx + notes-orateur.md
```

Le PDF des diapositives est exporté depuis le PPTX avec PowerPoint ou LibreOffice
(`soffice --headless --convert-to pdf`).

La version anglaise d'origine reste disponible dans l'historique Git (commit `9ba4634`).
