# 4. Scalabilité et performances

> **Livrable 4.** Comment MedX absorbe la croissance de ses utilisateurs et tient ses performances — chiffres à
> l'appui. Les objectifs viennent des [§0.7 Objectifs de capacité](00-contexte-et-hypotheses.md#07-objectifs-de-capacité)
> et [§0.8 Niveaux de service et criticité](00-contexte-et-hypotheses.md#08-niveaux-de-service-et-criticité).

## 4.1 La stratégie en une page

| Levier | Ce que fait MedX |
|--------|------------------|
| **Monter en largeur, pas en hauteur** | Services sans état sur Kubernetes, mis à l'échelle automatiquement sur la métrique qui limite réellement chacun (requêtes, connexions, retard de file, participants). |
| **Séparer ce qui évolue différemment** | Plan média, dossier patient, notifications et paiements ont des mises à l'échelle et des domaines de panne indépendants. |
| **Garder le chemin critique court** | Validation des jetons et décisions de politique en local, disponibilités et synthèses d'urgence pré-calculées, au plus deux sauts synchrones. |
| **Absorber les pointes de manière asynchrone** | Kafka et les files de priorité transforment les pics en arriérés résorbés en quelques secondes, jamais en erreurs. |
| **Protéger ce qui compte le plus** | Cloisonnement et ordre de délestage : accès d'urgence → consultations en cours → écritures cliniques → réservation → le reste. |
| **Grandir par paliers, sur des déclencheurs explicites** | Répliques → partitionnement → sharding par patient → cellules régionales ; chaque palier est déclenché par des seuils mesurés. |
| **Le prouver en continu** | Tests de charge, d'endurance, de chaos et WebRTC à 2× la pointe prévue avant chaque version majeure ; SLO avec budgets d'erreur. |

## 4.2 Modèle de charge

| Profil | Description | Réponse de conception |
|--------|-------------|-----------------------|
| Cycle quotidien | Pointes le lundi de 8 h à 10 h et de 18 h à 20 h ; la nuit ≈ 5 % de la pointe | Pré-dimensionnement planifié + mise à l'échelle automatique ; traitements par lots la nuit |
| Pics saisonniers | Grippe, épidémies : demande **× 3 à × 5** en quelques jours | Plan de gestion des pics (§4.10), marge × 2 dès la conception, la région de secours peut absorber du trafic en lecture |
| Rafales de rappels | Des milliers de rappels dus aux heures rondes | Fenêtre d'envoi avec gigue, file de notification dédiée |
| Données cliniques surtout lues | Le dossier est lu ≈ 5 à 10 fois plus qu'il n'est écrit | Répliques, projections, requêtes circonscrites au patient |
| Connexions longues | WebSocket pour la messagerie et les statuts, WebRTC pour le média | Passerelles et nœuds média dédiés, dimensionnés sur les connexions et les participants |

## 4.3 Estimations de capacité (année 3)

| Grandeur | Estimation | Résultat | Capacité de conception |
|----------|------------|----------|------------------------|
| Débit d'API | ≈ 75 M d'appels/jour ÷ 86 400 s × facteur de pointe 5 | **≈ 4 300 req/s** | 10 000 req/s |
| Sessions vidéo simultanées | 200 000 consultations/jour × 12 % à l'heure de pointe × 20 min | **≈ 8 000** | 10 000 (mise à l'échelle jusqu'à 20 000) |
| Bande passante sortante SFU | 20 000 participants × ≈ 1,2 Mbit/s reçus | **≈ 24 Gbit/s** | 48 Gbit/s |
| Nœuds média (8 vCPU) | 20 000 participants ÷ ≈ 200 par nœud | **≈ 100 nœuds** | jusqu'à 200 |
| Connexions WebSocket | 1 M d'utilisateurs quotidiens × ≈ 20 % connectés en pointe | **≈ 200 000** | 400 000 |
| Lectures du dossier | ≈ 10 M/jour, facteur de pointe 5 | **≈ 600 req/s** | 2 000 req/s |
| Écritures du dossier | 200 000 consultations × ≈ 10 ressources, sur les heures ouvrées | **≈ 55/s, pointes ≈ 110/s** | 500/s |
| Événements métier | ≈ 50 M/jour | **≈ 600/s en moyenne, 3 000/s en pointe** | trivial pour un cluster Kafka de 3 brokers |
| Événements d'audit | 20 M/jour | **≈ 230/s en moyenne, 1 200/s en pointe** | écritures par lots vers le stockage WORM |
| Notifications | 2 M/jour | **≈ 25/s en moyenne, 500/s aux pointes de rappels** | 2 000/s (limites des fournisseurs) |
| Stockage de documents | ≈ 1 Mo/consultation + dépôts des patients | **≈ 75 To/an** au rythme de l'année 3, 150 To cumulés | stockage objet (pas de limite pratique) |
| Données cliniques structurées | ≈ 50 Ko/consultation, historique et index compris | **≈ 4 To/an**, 10 To en année 3 | un primaire + répliques ; trajectoire de sharding prête |

## 4.4 Objectifs de performance et budgets de latence

Les SLO sont définis par niveau de criticité au [§0.8](00-contexte-et-hypotheses.md#08-niveaux-de-service-et-criticité).
Chaque requête critique dispose d'un **budget de latence** que la conception doit respecter :

**Synthèse critique d'urgence (objectif p95 < 300 ms côté serveur)**

| Étape | Budget |
|-------|--------|
| Passerelle : signature du JWT (JWKS en cache), contrôle DPoP, limitation de débit | ≤ 5 ms |
| Saut mTLS vers le pod d'accès d'urgence | ≤ 2 ms |
| Décision OPA (sidecar, en mémoire) | ≤ 1 ms |
| Insertion de l'autorisation + outbox d'audit (validation synchrone multi-AZ) | ≤ 15 ms |
| Lecture de la synthèse pré-calculée (une ligne indexée, réplique locale) | ≤ 10 ms |
| Déchiffrement de la clé patient (cache mémoire ; KMS en cas d'absence) | ≤ 1 ms (≤ 30 ms sinon) |
| Déchiffrement, application des obligations, sérialisation | ≤ 5 ms |
| **Total typique** | **≈ 40 à 70 ms**, soit une large marge sous les 300 ms |

**Confirmation de réservation (objectif p95 < 800 ms hors 3-D Secure)** — blocage du créneau ≤ 20 ms (Redis +
insertion), autorisation de paiement 300 à 600 ms (PSP, le terme dominant), validation + outbox ≤ 20 ms.

**Message de discussion (objectif p95 < 500 ms)** — passerelle ≤ 5 ms, autorisation + chiffrement ≤ 3 ms, écriture
Cassandra (`LOCAL_QUORUM`) ≤ 10 ms, diffusion pub/sub ≤ 5 ms ; le reste est du réseau.

## 4.5 Mise à l'échelle par couche et par service

| Couche | Mécanisme |
|--------|-----------|
| Périmètre | Le CDN décharge les ressources statiques ; WAF et répartiteurs de charge managés s'adaptent automatiquement ; pods de passerelle mis à l'échelle sur le débit et le CPU. |
| Services | Horizontal Pod Autoscaler de Kubernetes sur le CPU et des métriques métier (débit, latence p95, retard Kafka via KEDA) ; l'autoscaler de cluster ajoute des nœuds ; l'anti-affinité répartit les répliques sur 3 AZ ; 3 répliques au minimum pour les niveaux 0 et 1. |
| Données | Dimensionnement vertical + répliques en lecture + mutualisation des connexions (PgBouncer) + partitionnement ; trajectoire de sharding pour le dossier patient (§4.7). |
| Événements | Topics partitionnés par clé d'agrégat (12 à 48 partitions) ; les groupes de consommateurs montent jusqu'au nombre de partitions. |
| Temps réel | Pods WebSocket dimensionnés sur les connexions ouvertes ; cluster Redis pub/sub pour la diffusion. |
| Média | Nœuds SFU dimensionnés sur les participants et la bande passante sortante ; placement selon la région ; vidange avant retrait. |

| Service | Facteur de charge | Signal de mise à l'échelle | Répliques (année 3, min–max) | Goulet principal → parade |
|---------|-------------------|----------------------------|------------------------------|---------------------------|
| Passerelle d'API | Requêtes | Débit, CPU | 6 – 40 | — |
| Passerelle temps réel | Connexions | Connexions par pod (≈ 25 000) | 4 – 20 | Mémoire par connexion → trames légères, battements de cœur |
| ① Gestion des utilisateurs + IdP | Connexions, rafraîchissements | CPU | 3 – 12 | CPU du hachage de mots de passe → limitation de débit, passkeys |
| ② Planification | Recherches, réservations | Débit | 3 – 30 | Calcul des disponibilités → cache Redis pré-calculé |
| ③ Consultation (plan de contrôle) | Entrées en salle, messagerie | Débit, messages WebSocket | 3 – 20 | — |
| Plan média (SFU + TURN) | Participants | Participants par nœud, bande passante | 10 – 200 nœuds | Bande passante → simulcast, flux adaptatif, audio seul |
| ④ Dossier patient | Lectures | Débit, latence p95 | 4 – 30 | Base de données → répliques, projections, trajectoire de sharding |
| Accès d'urgence | Demandes de bris de glace | **Capacité réservée** + débit | 3 par région (plancher fixe) – 12 | Isolé par conception (cloisonnement) |
| ⑤ Ordonnances | Écritures, contrôles | Débit | 3 – 12 | Contrôles médicamenteux → référentiel en cache |
| ⑥ Interface pharmacie | Webhooks, mises à jour de statut | Retard de file | 2 – 12 | Logiciels de pharmacie lents → webhooks asynchrones |
| ⑦ Notification | Événements | Retard de consommation par file de priorité | 2 – 40 | Limites des fournisseurs → deux fournisseurs par canal |
| ⑧ Facturation et paiement | Paiements | Débit | 3 – 8 | Latence du PSP → encaissement asynchrone |
| Piste d'audit | Événements d'audit | Retard de consommation | 2 – 10 | Écritures en stockage objet → lots d'une minute |

## 4.6 Stratégie de cache

| Cache | Contenu | Emplacement | Fraîcheur | Données de santé ? |
|-------|---------|-------------|-----------|--------------------|
| CDN | Paquets applicatifs, images | Périphérie | Versionné, immuable | Non |
| Clés et politiques | JWKS, paquets OPA | Dans le processus | 5 min / récupérés toutes les 60 s | Non |
| Disponibilités | Créneaux libres par médecin et par jour (60 jours) | Redis | Recalculé sur événement (secondes) | Aucune donnée patient |
| Annuaire | Profils publics des médecins + prochain créneau libre | OpenSearch | Piloté par les événements | Non (public) |
| Référentiel médicamenteux | Catalogue des médicaments, interactions | Dans le processus + OpenSearch | Rafraîchi chaque jour | Non |
| Synthèse d'urgence | Résumé patient international (IPS) par patient | Projection PostgreSQL + répliques | Pilotée par les événements (p99 < 5 s) | **Oui — chiffrée** |
| Clés de données | Clés patient / fichier déchiffrées | Mémoire du service uniquement | ≤ 5 min, LRU borné | Matériel cryptographique, jamais persisté |
| Stocks | Niveau de disponibilité par pharmacie et par produit | Redis | 15 min | Non |

**Règles** — aucune donnée de santé dans les caches partagés (la synthèse d'urgence chiffrée est la seule exception) ;
les réponses contenant des données personnelles portent `Cache-Control: no-store` ; les caches utilisent des TTL avec
gigue et le regroupement des requêtes pour éviter les effets de ruée ; tout cache est reconstructible à partir de son
système de référence.

## 4.7 Trajectoire de mise à l'échelle des bases de données

| Palier | Déclencheur (mesuré) | Action |
|--------|----------------------|--------|
| **1 — Lancement** | — | Un primaire multi-AZ (secours synchrone) par service ; dossier patient avec 2 répliques en lecture ; PgBouncer ; `statement_timeout` et quotas de connexions par service |
| **2 — Croissance** | Dossier > 2 To, retard de réplique > 1 s, ou CPU du primaire > 60 % en pointe | Instances plus grandes, davantage de répliques, élagage de partitions, anciennes partitions d'historique déplacées vers un stockage moins coûteux |
| **3 — Montée en largeur** | Écritures du dossier > ≈ 5 000/s ou > 20 To | **Sharding par hachage de `id_patient`** (Citus ou routage applicatif, par exemple) ; chaque shard a ses propres répliques — presque toutes les requêtes sont circonscrites à un patient, les shards sont donc indépendants |
| **4 — Nouvelle juridiction** | Nouveau pays ou nouvelle réglementation | Nouvelle **cellule régionale** (§4.12) |

L'hygiène des requêtes fait partie de la définition de « terminé » : index revus avec `EXPLAIN` en CI pour les
nouvelles requêtes, tableaux de bord `pg_stat_statements`, pagination par curseur (pas d'`OFFSET` profond), aucun accès
de type N+1.

## 4.8 La vidéo à grande échelle

- **Une salle par nœud SFU** pour les consultations en tête-à-tête (pas de relais entre nœuds) ; les salles à
  plusieurs participants (interprète) peuvent être réparties en cascade sur plusieurs nœuds.
- **Placement** : choix de la région au RTT mesuré le plus faible pour les deux participants, puis du nœud le moins
  chargé (CPU, bande passante, participants).
- **Simulcast + dynacast + flux adaptatif** : chaque destinataire ne reçoit que la résolution dont son écran et son
  réseau ont besoin ; débit moyen reçu ≈ 1,2 Mbit/s au lieu de 2,5 Mbit/s en 720p complet.
- **L'audio d'abord** : en cas de congestion, la vidéo se dégrade en premier ; sous ≈ 150 kbit/s, l'appel passe en
  audio seul.
- **TURN** : flotte dimensionnée pour ≈ 20 % de sessions relayées ; TURN sur TLS 443 pour les réseaux restrictifs.
- **Retrait par vidange** : un nœud marqué pour suppression n'accepte plus de nouvelle salle et disparaît à la fin de
  son dernier appel.
- **Tests de charge** : des robots à navigateur sans interface génèrent des milliers d'appels simultanés avec perte de
  paquets et gigue injectées ; la capacité par nœud (≈ 200 participants pour 8 vCPU) est remesurée à chaque mise à jour
  du SFU.
- **Levier de coût à évaluer** : le média en pair-à-pair direct pour les appels en tête-à-tête, quand les réseaux le
  permettent, réduirait la bande passante SFU, au prix d'une supervision et d'une maîtrise de la qualité plus faibles —
  gardé comme optimisation, pas comme base.

## 4.9 Haute disponibilité et reprise après sinistre

| Composant | Dans la région (panne d'une AZ) | Entre régions (panne d'une région) |
|-----------|---------------------------------|------------------------------------|
| Passerelles, services | ≥ 3 répliques sur 3 AZ ; contrôles de santé du répartiteur de charge | Pré-déployés en secours, montés en charge par la procédure |
| Accès d'urgence, IdP | ≥ 3 répliques sur 3 AZ | **Actifs dans les deux régions** (routage DNS avec contrôle de santé) |
| PostgreSQL | Secours synchrone dans une autre AZ, bascule automatique < 60 s (RPO 0) | Réplique asynchrone inter-régions (retard < 1 s, RPO ≤ 1 min), promue par la procédure |
| Redis | Répliques dans d'autres AZ, bascule automatique | Reconstruit (données dérivées) |
| Kafka | 3 brokers / 3 AZ, RF 3, `min.insync.replicas = 2` | MirrorMaker 2 vers le cluster de secours |
| Cassandra | RF 3 sur les AZ, `LOCAL_QUORUM` | Second datacenter en région de secours (asynchrone) |
| Stockage objet | Service régional (multi-AZ par conception) | Réplication inter-régions |
| Plan média | Nœuds dans 3 AZ, les clients se reconnectent | Montée en charge des nœuds média de secours |

**Procédure de bascule régionale** (répétée deux fois par an) :

1. Détection par sondes synthétiques et contrôles de santé → incident déclaré, communication lancée.
2. Le niveau 0 continue immédiatement : l'accès d'urgence et la connexion sont déjà servis par la région de secours.
3. Promotion des répliques de base de données de secours pour les services de niveau 1 (scriptée, dans l'ordre des
   dépendances), bascule des producteurs vers le cluster Kafka de secours (positions des consommateurs traduites).
4. Montée des groupes de nœuds Kubernetes de secours à la taille de production (réservations de capacité
   pré-approuvées) → **niveau 1 rétabli en ≤ 1 h**.
5. Rétablissement des services de niveau 2 et reconstruction des magasins dérivés (caches, recherche) → **niveau 2
   rétabli en ≤ 4 h**.
6. Retour sur la région principale après rétablissement, par réplication inverse, en dehors des heures de pointe.

## 4.10 Modèles de résilience et dégradation maîtrisée

- **Des délais partout** (aucun appel sans échéance), **nouvelles tentatives avec temporisation exponentielle et
  gigue** uniquement pour les opérations idempotentes, **disjoncteurs** dans le maillage de services,
  **cloisonnement** (pools et déploiements séparés pour le chemin d'urgence et pour chaque file de priorité), **clés
  d'idempotence** sur chaque création.
- **Ordre de délestage** sous charge extrême, appliqué par les priorités de routes de la passerelle, les classes de
  priorité Kubernetes et les files : ① accès d'urgence → ② consultations en cours → ③ écritures cliniques (notes,
  ordonnances) → ④ réservation → ⑤ notifications non critiques → ⑥ analyses et exports.

| Panne | Comportement dégradé |
|-------|----------------------|
| Prestataire de paiement indisponible | Les blocages conservent les créneaux ; nouvelles tentatives ; réservation « payer plus tard » possible pour les patients connus |
| Fournisseur d'agenda indisponible | Utilisation des dernières plages occupées connues ; le médecin est averti du retard de synchronisation |
| Fournisseur SMS / e-mail indisponible | Bascule automatique vers le second fournisseur ; les notifications dans l'application continuent |
| Base de médicaments indisponible | Prescription possible uniquement après avoir explicitement reconnu que les contrôles sont indisponibles |
| Bus d'événements indisponible | Les transactions essentielles continuent ; les événements attendent dans les outbox ; notifications et projections rattrapent ensuite |
| Base primaire du dossier indisponible | Bascule automatique (< 60 s) ; les lectures continuent sur les répliques ; l'accès d'urgence n'est pas affecté |
| Panne d'un nœud média | Les clients se reconnectent à un autre nœud en quelques secondes |
| Cluster de recherche indisponible | Recherche de repli par spécialité servie par PostgreSQL |
| Région entière indisponible | Le niveau 0 continue en secours ; niveau 1 en ≤ 1 h ; niveau 2 en ≤ 4 h |

**Plan de gestion des pics** (épidémie, demande × 3 à × 5) : pré-dimensionnement planifié ; « mode pic » qui relève
les planchers de mise à l'échelle ; médecins d'astreinte supplémentaires sur la file des consultations urgentes ;
interrupteurs de fonctionnalités qui coupent le non-essentiel (exports, recommandations) ; une **salle d'attente
virtuelle** devant la réservation si nécessaire, pour que la plateforme reste réactive pour les personnes déjà prises
en charge.

## 4.11 Pratiques d'ingénierie de la performance

| Pratique | Fréquence |
|----------|-----------|
| Budgets de performance vérifiés en CI (points d'accès clés, p95) | À chaque fusion |
| Tests de charge à 1× et **2× la pointe prévue** (k6 / Gatling), y compris des robots WebRTC avec dégradation réseau | À chaque version majeure |
| Tests d'endurance (24 h) pour détecter fuites et dégradations lentes | Mensuelle |
| Expériences de chaos (arrêt de pods, perte d'une AZ, injection de latence, panne d'une dépendance) | Mensuelle en préproduction, journées d'exercice trimestrielles en production |
| Exercice de bascule de reprise après sinistre | Deux fois par an |
| Revue de capacité par rapport aux prévisions (utilisateurs, bande passante, stockage) | Mensuelle |
| Revue des SLO avec **budgets d'erreur** — les développements fonctionnels s'arrêtent au profit de la fiabilité quand un budget est épuisé | Hebdomadaire |

## 4.12 Croissance au-delà de l'année 3 — les cellules

Quand MedX dépasse une région ou entre dans une nouvelle juridiction, la plateforme grandit par **cellules** : une
cellule est une copie complète et isolée de la plateforme (services, données, clés) qui sert une population (un pays,
ou un sous-ensemble de patients). Une fine couche de routage globale — qui ne détient **aucune donnée de santé** —
dirige chaque utilisateur vers sa cellule de rattachement. Les cellules limitent le rayon d'impact de tout incident,
simplifient la résidence des données (une cellule américaine sous HIPAA, des cellules européennes sous RGPD / HDS) et
font de la croissance un déploiement reproductible plutôt qu'une refonte.

## 4.13 Maîtrise des coûts

- Planchers de mise à l'échelle abaissés la nuit ; environnements hors production réduits à zéro en dehors des heures
  ouvrées.
- Capacité réservée pour la charge de base stable ; capacité *spot* / préemptible uniquement pour les charges sans état
  et non critiques (jamais le niveau 0, jamais le média).
- Cycle de vie du stockage : les documents de plus d'un an passent sur un niveau d'accès peu fréquent, ceux de plus de
  5 ans sur un niveau d'archive — avec conservation Object Lock préservée.
- La bande passante média est le premier coût variable : simulcast, repli en audio seul et débits ajustés sont à la
  fois des mesures de qualité et de coût ; le **coût par consultation** est suivi comme indicateur clé.
