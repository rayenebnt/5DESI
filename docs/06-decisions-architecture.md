# 6. Décisions d'architecture et compromis

> Pourquoi la conception a cette forme. Chaque décision est rattachée aux priorités de MedX (Annexe 2) et indique
> **ce à quoi on renonce** — une conception sans coûts assumés n'est pas une conception.

## 6.1 Les tensions qui ont façonné l'architecture

| Tension | Comment MedX la résout | Priorité qui a tranché |
|---------|------------------------|------------------------|
| **Confidentialité ⟷ disponibilité en urgence** | L'accès en urgence n'est jamais bloqué par un circuit d'approbation ; il est étroit, limité dans le temps, entièrement audité et revu (bris de glace). | H1 + H3 |
| **Sécurité ⟷ facilité d'usage** | Strict pour les professionnels (MFA résistante à l'hameçonnage, authentification renforcée), fluide pour les patients (passkeys, MFA selon le risque, biométrie). | H4, puis M1-M2 |
| **Cohérence ⟷ disponibilité** | Cohérence forte là où une erreur nuit (écritures au dossier, réservations, ordonnances, paiements) ; cohérence à terme ailleurs ; le chemin d'urgence privilégie la disponibilité avec une fraîcheur bornée (< 5 s). | H2, H3, H5 |
| **Isolation ⟷ complexité d'exploitation** | Huit services métier (pas davantage), regroupés en zones, sur une plateforme commune au modèle de service standardisé. | H1, H3 |
| **Résilience ⟷ coût** | Actif-actif uniquement pour le niveau 0 (accès d'urgence, connexion) ; secours tiède pour le reste. | H3 |
| **Messages riches ⟷ confidentialité** | Messages externes génériques + liens profonds vers l'application authentifiée. | H1 |
| **Construire ⟷ acheter** | Construire ce qui différencie ou est sensible (dossier, accès d'urgence, parcours de soin, politiques) ; acheter les commodités (logiciel d'IdP, PSP, messagerie, logiciel SFU). | Toutes — libère de la capacité pour les priorités hautes |

## 6.2 Registre des décisions

| ADR | Décision | Lien avec les priorités | Principale alternative écartée | Ce à quoi on renonce |
|-----|----------|-------------------------|--------------------------------|----------------------|
| 01 | Microservices par contexte métier, regroupés en zones de sécurité | H1, H3, scalabilité | Monolithe modulaire | Une exploitation plus simple |
| 02 | HL7 FHIR R4 (+ IPS) comme modèle clinique, sur PostgreSQL | H2, interopérabilité | Schéma relationnel sur mesure | Un peu d'efficacité de stockage |
| 03 | PostgreSQL par défaut ; stockages spécialisés uniquement si c'est justifié | H5, simplicité | Persistance polyglotte « NoSQL d'abord » | Une très forte capacité d'écriture dès le départ |
| 04 | Historique clinique en ajout seul + chaînes de hachage + ancrages quotidiens signés | H2, H5 | Mises à jour en place + table d'audit | ≈ 30 % de stockage en plus |
| 05 | Deux couches de chiffrement avec des clés d'enveloppe par patient | H1 | Chiffrement du stockage seul | De la complexité, ≈ 1 ms par requête |
| 06 | Bris de glace avec revue a posteriori sur un chemin de niveau 0 isolé et présent dans deux régions | H3 | Circuit d'approbation préalable | Un certain risque d'abus (atténué) |
| 07 | IdP éprouvé (Keycloak) + politiques OPA (RBAC + ABAC) appliquées localement | H4 | Authentification maison ; RBAC seul | Exploiter un cluster d'IdP avec état |
| 08 | Intégration pilotée par les événements (Kafka) avec outbox transactionnelle | H5, scalabilité | Chaînes d'appels synchrones | Une cohérence à terme à maîtriser |
| 09 | SFU WebRTC auto-hébergé (LiveKit), chiffrement de bout en bout par défaut en tête-à-tête | H1, M2 | CPaaS vidéo ; pair-à-pair ; MCU | Exploiter des serveurs média ; pas d'enregistrement |
| 10 | Aucune donnée de santé hors de la frontière de confiance (messages, agendas, événements, journaux) | H1 | Notifications riches | Un peu de confort |
| 11 | Champs de paiement hébergés par le PSP → PCI DSS SAQ A | B5, H1 | Manipuler les données de carte | La maîtrise de l'interface de paiement |
| 12 | Multi-AZ partout + secours tiède ; actif-actif uniquement pour le niveau 0 | H3, H5 | Actif-actif complet | Un RTO de 1 à 4 h pour les niveaux 1-2 |
| 13 | Données synthétiques par défaut hors production ; anonymisation sous contrôle du DPO | B4, H1 | Copies masquées de la production | Un peu de réalisme dans les tests |
| 14 | Livrer par priorité : socle sécurisé → parcours de soin → écosystème | Toutes | MVP guidé par les fonctionnalités | Un lancement commercial plus tardif |

## 6.3 Fiches de décision

### ADR-01 — Microservices par contexte métier, regroupés en zones de sécurité

- **Contexte** — huit capacités métier aux sensibilités de données très différentes (données de santé, données
  proches du paiement, coordonnées), aux profils de charge très différents (bande passante vidéo, lectures du dossier,
  exactitude des paiements) et à la criticité variable (niveaux 0 à 2).
- **Décision** — un service par composant de l'Annexe 1, plus des services de plateforme ; des zones (identité,
  clinique, communication, paiement) avec des pools de nœuds et des politiques réseau dédiés.
- **Alternatives** — monolithe (un seul rayon d'impact) ; monolithe modulaire (bon point de départ, mais sans
  isolation du chemin d'urgence ni des périmètres de conformité) ; fonctions en tant que service (démarrages à froid,
  peu adaptées à WebRTC / WebSocket).
- **Conséquences** — ✅ isolation des données de santé et des pannes, mise à l'échelle et livraisons indépendantes ;
  ❌ complexité des systèmes distribués → modèle de service standardisé, maillage de services, équipe plateforme,
  limite stricte du nombre de services.

### ADR-02 — HL7 FHIR R4 (+ International Patient Summary) comme modèle de données clinique

- **Contexte** — le dossier doit être complet, valide, versionné et échangeable avec les services nationaux et les
  hôpitaux ; l'accès d'urgence a besoin d'une synthèse normalisée.
- **Décision** — ressources FHIR stockées par un serveur FHIR (HAPI FHIR sur PostgreSQL) ; profil IPS pour la
  synthèse critique ; profils nationaux pour la validation.
- **Alternatives** — schéma sur mesure (démarrage plus rapide, intégrations coûteuses ensuite) ; base
  documentaire (souple, mais transactions plus faibles et une technologie de plus).
- **Conséquences** — ✅ interopérabilité, validation, historique et recherche disponibles d'emblée ; ❌ un stockage
  générique moins efficace → projections pour l'interface et partitionnement.

### ADR-03 — PostgreSQL par défaut, stockages spécialisés uniquement si c'est justifié

- **Décision** — PostgreSQL pour tous les systèmes de référence ; Redis (éphémère), Cassandra (journaux en ajout
  intensif avec TTL), stockage objet (fichiers), OpenSearch (recherche) seulement là où PostgreSQL convient mal.
- **Pourquoi** — moins de technologies à sécuriser, certifier, sauvegarder et maîtriser ; contraintes et transactions
  protègent l'intégrité (par exemple la contrainte d'exclusion contre la double réservation).
- **Conséquences** — ✅ intégrité et simplicité ; ❌ une très forte charge en écriture passe par la trajectoire de
  sharding (§4.7).

### ADR-04 — Historique clinique en ajout seul, chaînes de hachage et ancrages signés

- **Décision** — aucune mise à jour en place ni suppression physique de données cliniques pendant la durée de
  conservation ; chaque version est chaînée par hachage ; une racine de Merkle quotidienne est signée dans le HSM,
  horodatée et stockée en WORM.
- **Pourquoi** — intégrité des données (H5) et conformité du dossier (H2) : l'historique doit être prouvable, pas
  simplement « journalisé ».
- **Conséquences** — ✅ toute altération est détectable, même par un administrateur ; ❌ ≈ 30 % de stockage en plus,
  des traitements de vérification.

### ADR-05 — Deux couches de chiffrement avec des clés d'enveloppe par patient

- **Décision** — chiffrement du stockage partout + chiffrement applicatif AES-256-GCM des données C4 avec des clés
  par patient / par fichier / par consultation, elles-mêmes chiffrées par des KEK adossées à des HSM.
- **Alternatives** — chiffrement du stockage seul (ne protège ni contre une compromission au niveau de la base ni
  contre des exports divulgués) ; une clé KMS par patient (des millions de clés KMS : coût et quotas).
- **Conséquences** — ✅ les données volées sont inutilisables, le rayon d'impact d'une clé = un patient,
  crypto-effacement en fin de conservation ; ❌ complexité de la gestion des clés, ≈ 1 ms de surcoût avec cache des
  clés, politiques de sauvegarde des clés à soigner.

### ADR-06 — Bris de glace avec revue a posteriori, sur un chemin de niveau 0 isolé

- **Contexte** — H3 exige un accès *immédiat* pour les professionnels habilités ; H1 exige une confidentialité
  stricte.
- **Décision** — bris de glace en libre-service (droit dédié + justification + MFA renforcée) → autorisation en
  lecture seule de 4 heures → synthèse IPS pré-calculée ; alerte en temps réel, information du patient, revue
  obligatoire sous 72 h ; déploiement et base de données séparés, actifs dans deux régions.
- **Alternatives** — approbation préalable par un superviseur (trop lent à 3 h du matin aux urgences) ; accès ouvert
  à tous les médecins (risque inacceptable pour la vie privée).
- **Conséquences** — ✅ accès en quelques secondes, même en cas de panne ; ❌ un abus reste possible, mais il est
  visible, attribuable et sanctionné ; une unité de déploiement de plus.

### ADR-07 — IdP éprouvé + autorisation sous forme de politiques en code

- **Décision** — Keycloak pour l'authentification (OIDC, MFA, passkeys, fédération) ; sidecars OPA qui évaluent des
  politiques RBAC + ABAC à partir de paquets signés ; jetons de courte durée validés localement.
- **Alternatives** — authentification maison (risque élevé) ; RBAC seul (incapable d'exprimer la relation de soin, le
  consentement ou l'urgence) ; serveur d'autorisation central appelé à chaque requête (latence et point de défaillance
  unique).
- **Conséquences** — ✅ robuste, standard, testable, rapide ; ❌ la révocation n'est pas instantanée (bornée par des
  jetons de 5 à 10 min + liste de refus), un IdP avec état à exploiter dans deux régions.

### ADR-08 — Intégration pilotée par les événements avec outbox transactionnelle

- **Décision** — les services publient des événements métier (identifiants et statuts uniquement) via une outbox
  relayée vers Kafka ; les consommateurs sont idempotents ; appels synchrones uniquement quand un utilisateur attend
  (≤ 2 sauts).
- **Alternatives** — chaînes synchrones (pannes en cascade, couplage fort) ; publication après validation sans outbox
  (événements perdus ou fantômes).
- **Conséquences** — ✅ découplage, résilience, alimentation naturelle de l'audit et des projections ; ❌ une
  cohérence à terme à prendre en compte dans la conception (sagas, traitements de rapprochement).

### ADR-09 — SFU WebRTC auto-hébergé avec chiffrement de bout en bout

- **Décision** — SFU LiveKit et serveurs TURN sur une infrastructure certifiée HDS ; simulcast et débit adaptatif ;
  chiffrement de bout en bout activé par défaut pour les consultations en tête-à-tête ; aucun enregistrement.
- **Alternatives** — CPaaS (intégration rapide, mais média traité hors du périmètre certifié de MedX et coûteux à
  grande échelle — conservé comme solution de repli) ; maillage pair-à-pair (aucune maîtrise de la qualité, problèmes
  de relais) ; MCU (gourmand en CPU, incompatible avec le chiffrement de bout en bout).
- **Conséquences** — ✅ souveraineté des données, confidentialité, maîtrise des coûts ; ❌ compétences d'exploitation
  média nécessaires, aucun enregistrement ni transcription côté serveur tant que le chiffrement de bout en bout est
  actif.

### ADR-10 — Aucune donnée de santé hors de la frontière de confiance

- **Décision** — SMS, e-mails, bannières push, agendas externes, contenus des événements, journaux et traces ne
  contiennent jamais de données de santé ; le détail n'est affiché qu'après authentification dans l'application.
- **Conséquences** — ✅ supprime des catégories entières de fuites et tient les fournisseurs tiers hors du périmètre
  HDS ; ❌ des messages moins informatifs (compensés par les liens profonds).

### ADR-11 — Champs de paiement hébergés par le PSP (PCI DSS SAQ A)

- **Décision** — les données de carte vont directement de l'appareil au PSP ; MedX ne stocke que des jetons ;
  3-D Secure ; grand livre en partie double propre à MedX pour les mouvements d'argent.
- **Conséquences** — ✅ périmètre PCI minimal et aucune donnée de carte à voler ; ❌ interface de paiement contrainte
  par les composants du PSP.

### ADR-12 — Multi-AZ partout, secours tiède, actif-actif uniquement pour le niveau 0

- **Décision** — chaque couche est redondée sur 3 AZ (RPO 0 dans la région) ; une seconde région européenne en
  secours tiède (RPO ≤ 1 min) ; accès d'urgence et connexion actifs dans les deux régions.
- **Alternatives** — actif-actif complet (conflits multi-maîtres sur les données cliniques, coût doublé) ; région
  unique (inacceptable pour le niveau 0).
- **Conséquences** — ✅ l'accès d'urgence survit à la panne d'une région, les coûts restent raisonnables ; ❌ les
  niveaux 1 et 2 sont rétablis respectivement en 1 h et en 4 h.

### ADR-13 — Données synthétiques par défaut hors production

- **Décision** — développement, préproduction et démonstration utilisent des patients FHIR synthétiques ; des jeux
  de données réalistes uniquement via la chaîne d'anonymisation, avec validation du DPO ; clés de production
  inutilisables hors production.
- **Conséquences** — ✅ jamais de vraie donnée de santé hors production ; ❌ certains cas limites découverts plus tard
  → jeux anonymisés ciblés et tests de charge proches de la production.

### ADR-14 — Livrer par priorité, acheter ce qui ne différencie pas

- **Décision** — le socle sécurisé d'abord (priorité haute), les parcours de soin ensuite (priorité moyenne),
  l'écosystème en dernier (priorité basse) — voir la [feuille de route](08-feuille-de-route-et-risques.md). Les
  capacités de priorité basse s'appuient sur des partenaires (PSP, fournisseurs de messagerie) et n'arrivent plus tôt
  que sous forme de tranches minimales exigées par des fonctionnalités de priorité moyenne.
- **Conséquences** — ✅ les fondations dont dépend chaque fonctionnalité ultérieure sont justes dès le premier jour ;
  ❌ le lancement commercial attend le socle sécurisé (un pilote avec des cliniques partenaires se déroule pendant la
  phase 2).
