# 0. Contexte, hypothèses et objectifs

> Fait partie du dossier de conception **MedX — Solution technique**. Commencer ici : ce document fixe le périmètre,
> les hypothèses et les chiffres sur lesquels reposent tous les autres documents.

| # | Document | Livrable |
|---|----------|----------|
| 0 | Contexte, hypothèses et objectifs (ce document) | Socle |
| 1 | [Architecture de haut niveau](01-architecture-haut-niveau.md) | Livrable 1 |
| 2 | [Conception détaillée des composants](02-conception-composants/README.md) | Livrable 2 |
| 3 | [Modèle de données et stratégie de stockage](03-modele-donnees-et-stockage.md) | Livrable 3 |
| 4 | [Scalabilité et performances](04-scalabilite-et-performances.md) | Livrable 4 |
| 5 | [Sécurité et conformité](05-securite-et-conformite.md) | Livrable 5 |
| 6 | [Décisions d'architecture et compromis](06-decisions-architecture.md) | Alignement sur les priorités |
| 7 | [Matrice de traçabilité des exigences](07-tracabilite-exigences.md) | Complétude |
| 8 | [Feuille de route et risques](08-feuille-de-route-et-risques.md) | Alignement sur les priorités |
| — | [Présentation](../presentation/) | Livrable 6 |

---

## 0.1 MedX en un paragraphe

MedX est une plateforme de santé qui repose sur trois piliers : les **téléconsultations** (prendre rendez-vous,
rencontrer un médecin en vidéo, échanger par chat et partager des documents), la **gestion des dossiers patients**
(un dossier médical sécurisé, tenu tout au long de la vie et accessible au patient comme aux professionnels qui le
soignent) et le **suivi des ordonnances** (le médecin émet une ordonnance électronique que la pharmacie reçoit,
prépare et délivre, pendant que le patient suit chaque étape). Comme MedX traite des données de santé — la catégorie
de données personnelles la plus sensible —, l'architecture est d'abord guidée par **la protection des données,
l'intégrité des dossiers et la disponibilité en urgence**, puis par les parcours de soins, et enfin par les
fonctions de support.

## 0.2 Acteurs

| Acteur | Description | Canaux principaux | Actions typiques |
|--------|-------------|-------------------|------------------|
| **Patient** | Utilisateur adulte ; peut aussi agir comme **mandataire** (parent d'un mineur, aidant avec consentement) | Application mobile (iOS/Android), application web | Prendre rendez-vous, consulter, lire son dossier, suivre ses ordonnances, payer |
| **Médecin / praticien** | Professionnel de santé vérifié (numéro d'inscription contrôlé dans le répertoire national) | Portail web (poste de travail), application mobile | Gérer ses disponibilités, mener les consultations, rédiger ses notes, prescrire |
| **Soignant d'urgence** | Praticien titulaire du droit `acces_urgence` (urgences, garde, SAMU) | Portail web, application mobile | Accès « bris de glace » aux informations critiques d'un patient |
| **Personnel de pharmacie** | Pharmacien, préparateur, administrateur de pharmacie | Portail pharmacie, ou leur logiciel de gestion d'officine (LGO) via l'API partenaire | Recevoir les ordonnances, mettre à jour leur statut, répondre aux questions des patients |
| **Équipes MedX** | Agent de support, agent de facturation, administrateur de plateforme, **délégué à la protection des données (DPO)**, auditeur | Console d'administration (accès zéro confiance + SSO + clé matérielle) | Support sans accès aux données cliniques, audits, revues des bris de glace |
| **Systèmes externes** | Agendas, prestataire de paiement, fournisseurs SMS/e-mail/push, logiciels de pharmacie, base médicaments, services nationaux de santé, fédération d'identité | API, webhooks | Intégration |

## 0.3 Périmètre

**Dans le périmètre** — les huit composants métier de l'Annexe 1 et les capacités de plateforme dont ils ont besoin :

1. Gestion des utilisateurs (identité, authentification, autorisations, préférences)
2. Planification des téléconsultations (réservation, listes d'attente, demandes urgentes, agendas externes)
3. Consultation (salles virtuelles, vidéo/audio, chat, transfert de fichiers)
4. Gestion des dossiers patients (historique médical, notes, documents, **accès d'urgence**)
5. Gestion des ordonnances
6. Interface pharmacie
7. Notification
8. Facturation et paiement

Capacités de plateforme : passerelles API et temps réel, moteur de politiques d'accès, bus d'événements, stockage
sécurisé de documents, piste d'audit, gestion des clés, observabilité, plateforme de données désidentifiées.

**Hors périmètre de la v1** (restent compatibles avec la conception) : gestion de cabinet physique, imagerie médicale
(visionneuses PACS/DICOM — seulement des documents déposés et des liens), traitement des remboursements par
l'assurance maladie (tiers payant), aide au diagnostic par IA, dispositifs médicaux connectés. Ils figurent dans la
[feuille de route](08-feuille-de-route-et-risques.md).

## 0.4 Les priorités de MedX et leur effet sur la conception

L'énoncé est explicite : *protéger les données en transit et au repos est primordial* et *les professionnels de
santé doivent accéder rapidement aux informations du patient en cas d'urgence*. Chaque exigence de priorité haute
devient donc un **principe d'architecture non négociable**, et pas seulement une fonctionnalité.

| Priorité | Exigence | Devient… |
|----------|----------|----------|
| **Haute** | H1 Confidentialité des données (chiffrement au repos et en transit) | TLS 1.3 / mTLS partout, AES-256 au repos partout, **chiffrement d'enveloppe par patient** des données cliniques (principe P1) |
| **Haute** | H2 Gestion des dossiers patients | Service Dossier patient dédié, fondé sur **FHIR**, versionné et audité (P3, P4) |
| **Haute** | H3 Accès d'urgence | Capacité de **bris de glace** sur un chemin de lecture isolé de niveau 0, avec revue a posteriori (P2) |
| **Haute** | H4 Authentification et autorisations | Fournisseur d'identité éprouvé (OIDC, MFA) + moteur de politiques **RBAC + ABAC**, zéro confiance entre services (P1) |
| **Haute** | H5 Intégrité des données et stockage sécurisé des fichiers | Historique en ajout seul, chaînage par hachage, sommes de contrôle, sauvegardes immuables, stockage de documents analysé et chiffré (P3) |
| Moyenne | M1–M5 Planification, consultations, ordonnances, masquage, agendas | Parcours de soins construits sur le socle de priorité haute |
| Basse | B1–B6 Pharmacie, préférences, suivi des notifications, anonymisation, paiement, remboursements | Conçus dès maintenant, livrés en dernier, **achetés plutôt que développés** quand c'est possible (PSP, fournisseurs de messagerie) |

## 0.5 Principes d'architecture

| ID | Principe | Ce que cela signifie concrètement |
|----|----------|-----------------------------------|
| **P1** | **Confidentialité et sécurité dès la conception et par défaut** | Tout chiffrer, moindre privilège, refus par défaut, minimisation des données (aucune donnée de santé dans les SMS, e-mails, agendas, journaux ou événements). |
| **P2** | **La sécurité du patient d'abord** | Le chemin d'accès d'urgence doit fonctionner quand tout le reste est dégradé : déploiement isolé, dépendances minimales, niveau de disponibilité le plus élevé. |
| **P3** | **L'intégrité avant le confort** | Les données cliniques ne sont jamais écrasées ni supprimées physiquement pendant leur durée de conservation : chaque modification est une nouvelle version, attribuée et infalsifiable. |
| **P4** | **Les standards plutôt que le sur-mesure** | HL7 FHIR R4 (+ International Patient Summary), OpenID Connect / OAuth 2.1, WebRTC, OpenAPI 3.1, CloudEvents. Interopérabilité, audits et recrutement facilités. |
| **P5** | **Couplage faible, responsabilités claires** | Un service = un contexte délimité = une base de données privée. Les services s'intègrent par des API versionnées et des événements métier. |
| **P6** | **Acheter le banal, construire le différenciant** | Réutiliser un fournisseur d'identité, un prestataire de paiement, des fournisseurs de messagerie, un SFU open source. Construire ce qui rend MedX unique : dossiers, accès d'urgence, parcours de soins. |
| **P7** | **Monter en charge horizontalement et automatiser** | Services sans état, mise à l'échelle automatique, infrastructure en tant que code, GitOps, aucune modification manuelle en production. |
| **P8** | **Observable et auditable par défaut** | Chaque requête est tracée, chaque accès à une donnée de santé est inscrit dans une piste d'audit immuable. |

## 0.6 Hypothèses

| ID | Hypothèse | Effet sur la conception |
|----|-----------|-------------------------|
| A1 | MedX démarre dans l'**UE (d'abord en France)** ; les États-Unis sont un marché possible ensuite. | Le RGPD et la certification française **HDS** (hébergement de données de santé) sont obligatoires ; la conception est **compatible HIPAA** (BAA, audit, chiffrement) pour une future cellule américaine. |
| A2 | Hébergement sur un **cloud public certifié HDS** (implémentation de référence : AWS région Paris, reprise à Francfort ; Azure, Google Cloud ou OVHcloud sont des options équivalentes). | Les services managés ne sont utilisés que s'ils font partie du périmètre certifié du fournisseur. Toutes les données de santé restent dans l'EEE. |
| A3 | Les rôles juridiques (responsable de traitement / sous-traitant) entre MedX et les praticiens sont définis par le DPO. | La conception supporte les deux : contrôle d'accès par praticien, registre des consentements, audit complet. |
| A4 | Les patients utilisent un smartphone ou un navigateur récent compatible WebRTC ; certains ont une mauvaise connexion. | Débit adaptatif, repli en audio seul, relais TURN, expérience pensée d'abord pour le mobile. |
| A5 | Les pharmacies utilisent des logiciels hétérogènes, parfois sans API. | Portail web pour toutes + API partenaire à base d'adaptateurs pour les logiciels connectés. |
| A6 | Les paiements passent par un **prestataire de services de paiement** (PSP) certifié PCI DSS niveau 1. | MedX ne stocke jamais de données de carte → périmètre PCI minimal (SAQ A). |
| A7 | Les médecins utilisent des agendas Google Workspace, Microsoft 365 ou CalDAV. | Connecteurs pour ces trois familles, limités aux disponibilités (libre/occupé). |
| A8 | L'intégration aux services nationaux (ordonnance numérique, identifiant national de santé, DMP) vient après la v1. | Dossiers et ordonnances sont modélisés en FHIR : ces intégrations seront des adaptateurs, pas des refontes. |
| A9 | Les objectifs de croissance ci-dessous sont des chiffres de planification, revus chaque trimestre. | La capacité est conçue avec une marge ×2 et une trajectoire claire au-delà. |

## 0.7 Objectifs de capacité

Chiffres utilisés pour le dimensionnement dans le [document de scalabilité](04-scalabilite-et-performances.md).

| Indicateur | Année 1 (lancement) | Année 3 (cible) | Capacité de conception (année 3 × 2) |
|------------|---------------------|-----------------|--------------------------------------|
| Patients inscrits | 1 M | 10 M | — |
| Professionnels de santé | 5 000 | 50 000 | — |
| Pharmacies connectées | 2 000 | 15 000 | — |
| Utilisateurs actifs par jour (jour de pointe) | 100 000 | 1 M | 2 M |
| Téléconsultations par jour | 20 000 | 200 000 | 400 000 |
| Sessions vidéo simultanées (heure de pointe) | 1 000 | 10 000 | 20 000 |
| Ordonnances par jour | 12 000 | 120 000 | 240 000 |
| Notifications par jour | 200 000 | 2 M | 4 M |
| Requêtes API par seconde (pointe) | 500 | 5 000 | 10 000 |
| Connexions WebSocket simultanées (pointe) | 20 000 | 200 000 | 400 000 |
| Documents médicaux (cumul) | 10 To | 150 To | — |
| Données cliniques structurées (entrepôt FHIR) | 0,5 To | 10 To | — |
| Événements d'audit par jour | 2 M | 20 M | 40 M |

*Comment les chiffres de l'année 3 ont été obtenus :* 50 000 professionnels × 4 téléconsultations par jour = 200 000
consultations ; 12 % d'entre elles à l'heure de pointe × 20 min de session en moyenne (salle d'attente comprise)
≈ 8 000 sessions simultanées, arrondies à 10 000 ; 60 % des consultations se terminent par une ordonnance ; environ
6 notifications par consultation, plus les échanges avec les pharmacies ≈ 2 M par jour ; environ 75 M d'appels API par
jour avec un facteur de pointe de 5 ≈ 4 300 req/s, arrondies à 5 000.

## 0.8 Niveaux de service et criticité

Les services sont regroupés en **niveaux de criticité**. Le niveau fixe l'objectif de disponibilité, les objectifs de
reprise et l'ordre dans lequel la capacité est protégée quand la plateforme est sous tension.

| Niveau | Périmètre | Disponibilité | RPO (perte de données max.) | RTO (perte d'une région) | RTO (perte d'une zone) |
|--------|-----------|---------------|-----------------------------|--------------------------|------------------------|
| **Niveau 0 — vital** | Accès d'urgence, authentification / validation des jetons, lecture des dossiers | **99,99 %** | 0 dans la région (multi-AZ synchrone), ≤ 1 min entre régions | **≤ 15 min** | automatique, < 1 min |
| **Niveau 1 — soins** | Écriture des dossiers, consultation, planification, ordonnances, chat | 99,95 % | 0 dans la région, ≤ 1 min entre régions | ≤ 1 h | automatique, < 2 min |
| **Niveau 2 — support** | Interface pharmacie, notification, facturation, analytique | 99,9 % | ≤ 5 min | ≤ 4 h | automatique, < 5 min |

| Capacité | Niveau | Objectif de latence (p95) |
|----------|--------|---------------------------|
| Accès d'urgence — résumé critique | 0 | **< 300 ms** côté API, < 1 s à l'écran |
| Connexion / émission de jeton | 0 | < 300 ms (hors interaction MFA de l'utilisateur) |
| Lecture / écriture du dossier patient | 1 | < 300 ms / < 500 ms |
| Téléconsultation vidéo | 1 | connexion < 3 s ; < 100 ms d'aller-retour vers le nœud média le plus proche ; bouche-à-oreille < 400 ms |
| Distribution d'un message de chat | 1 | < 500 ms |
| Ordonnance signée → visible dans la boîte de la pharmacie | 1 | < 5 s |
| Recherche de créneau / réservation | 1 | < 300 ms / < 800 ms (hors 3-D Secure) |
| Envoi d'une notification (critique / standard) | 2 | < 10 s / < 60 s |
| Vérification de disponibilité en stock | 2 | < 1 s en cache, < 3 s en direct |
| Autorisation de paiement | 2 | < 2 s (hors 3-D Secure) |

## 0.9 Glossaire

| Terme | Signification |
|-------|---------------|
| **Donnée de santé** | Toute information relative à la santé d'une personne identifiable (données « sensibles » au sens de l'article 9 du RGPD ; *PHI* en anglais). |
| **HDS** | Hébergeur de Données de Santé — certification française obligatoire pour héberger des données de santé. |
| **FHIR** | HL7 Fast Healthcare Interoperability Resources — le standard de modèle de données et d'API REST pour la santé. |
| **IPS** | International Patient Summary (guide d'implémentation HL7 FHIR) — résumé clinique minimal conçu pour les soins non programmés ; base du résumé d'urgence de MedX. |
| **Bris de glace** | Dérogation contrôlée qui donne un accès immédiat en urgence, avec justification et revue obligatoire (*break-glass*). |
| **RBAC / ABAC** | Contrôle d'accès fondé sur les rôles / sur les attributs. |
| **PDP / PEP** | Point de décision de politique (évalue les règles) / point d'application de la politique (applique la décision dans chaque service). |
| **DEK / KEK** | Clé de chiffrement des données / clé de chiffrement de clés (chiffrement d'enveloppe). |
| **HSM / KMS** | Module matériel de sécurité / service de gestion des clés. |
| **SFU / TURN** | Selective Forwarding Unit (routeur vidéo) / serveur relais utilisé quand aucun chemin direct n'est possible. |
| **WORM** | Write Once, Read Many — stockage non réinscriptible : impossible à modifier ou supprimer avant la fin de la rétention. |
| **RPO / RTO** | Perte de données maximale admissible / durée d'interruption maximale admissible. |
| **SLO** | Objectif de niveau de service. |
| **INS / RPPS / FINESS** | Identifiant national de santé / répertoire partagé des professionnels de santé / fichier national des établissements (dont les pharmacies). |
| **PSP** | Prestataire de services de paiement (par exemple Stripe, Adyen). |
| **Outbox (patron)** | Les événements sont écrits dans la même transaction que la modification métier, puis publiés — aucun événement perdu ni fantôme. |
| **Langage du domaine** | Suivant l'approche DDD, les noms métier (événements, tables, API) sont en français, langue du domaine ; les noms techniques standard (ressources FHIR, protocoles) restent inchangés. |
