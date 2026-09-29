# MedX — Texte de la présentation et notes de l'orateur

> Présentation courte (≈ 15 à 18 minutes + questions). Une section par diapositive ; le même texte est intégré
> comme notes de l'orateur dans `MedX-Solution-Technique.pptx`. Les diapositives 19 à 23 (annexes A1 à A5) servent
> de support pour les questions.

## Diapositive 1 — Ouverture (30 s)

Bonjour. On nous a demandé de concevoir la solution technique de MedX : une plateforme de téléconsultation, de dossier patient et de suivi des ordonnances.
Pendant les 15 prochaines minutes, je vais présenter l'architecture, le fonctionnement de chaque composant, le stockage des données, la montée en charge et la protection des données de santé.
Une idée guide tous les choix : les priorités de MedX elles-mêmes. La protection des données et l'accès d'urgence passent en premier ; tout le reste est construit dessus.

## Diapositive 2 — Les enjeux de conception (1 min)

MedX repose sur trois piliers : la téléconsultation, un dossier patient tenu à vie, et le suivi des ordonnances jusqu'à la pharmacie.
Le sujet hiérarchise les exigences. Les cinq priorités HAUTES — chiffrement, dossier patient, accès d'urgence, authentification et intégrité — ne sont pas des fonctionnalités ajoutées à la fin : ce sont les fondations et les principes non négociables de l'architecture.
Les priorités MOYENNES sont les parcours de soin construits sur ces fondations ; les priorités BASSES sont entièrement conçues dès maintenant mais livrées en dernier, surtout avec des partenaires comme un prestataire de paiement.

## Diapositive 3 — Objectifs et principes (1 min)

Nous avons dimensionné la plateforme pour l'année 3 : 10 millions de patients, 200 000 téléconsultations par jour, jusqu'à 10 000 appels vidéo simultanés — avec une marge de 2x en plus.
Deux chiffres comptent le plus car ils découlent des priorités HAUTES : l'accès d'urgence doit être disponible 99,99 % du temps et renvoyer la synthèse critique en moins de 300 millisecondes.
Les huit principes ci-dessous transforment les priorités en règles suivies par toutes les équipes — par exemple « l'intégrité d'abord » : l'historique clinique n'est jamais écrasé.

## Diapositive 4 — Vue d'ensemble de l'architecture (2 min) — la diapositive clé

Elle se lit de gauche à droite. Les utilisateurs n'atteignent MedX que par le périmètre : CDN et pare-feu applicatif, la passerelle d'API, une passerelle temps réel pour le chat et les statuts en direct, et le plan média pour la vidéo.
Derrière, les huit composants du sujet sont des microservices regroupés en zones de sécurité. La zone identité décide qui vous êtes et ce que vous pouvez faire. La zone clinique détient toutes les données de santé et applique les contrôles les plus stricts. La notification ne stocke jamais de données de santé, et la facturation est isolée dans sa propre zone de paiement.
Les services communiquent via un bus d'événements Kafka ; des services de plateforme partagés assurent l'audit, le stockage sécurisé des documents et la gestion des clés ; chaque service possède sa base de données.
L'accès d'urgence — en rouge — est déployé séparément pour que rien d'autre ne puisse le ralentir.

## Diapositive 5 — Comment les briques travaillent ensemble (1 min 30)

Voici un parcours de soin. Le patient réserve : la planification bloque le créneau 10 minutes, une contrainte de base de données rend la double réservation impossible, et la facturation pré-autorise les honoraires.
Il rencontre le médecin en vidéo dans le service de consultation ; le médecin documente dans le dossier patient, puis signe une ordonnance que la pharmacie reçoit en quelques secondes ; enfin le paiement est encaissé.
En bas, le bus d'événements : chaque étape publie un événement. Trois règles rendent l'ensemble robuste : des appels synchrones uniquement quand un utilisateur attend, des événements qui ne transportent jamais de contenu clinique, et l'outbox qui garantit qu'aucun événement n'est perdu ni inventé.

## Diapositive 6 — Priorité HAUTE H4 — authentification et autorisation (1 min 30)

Nous ne développons pas l'authentification nous-mêmes : Keycloak, un fournisseur d'identité éprouvé, gère OpenID Connect, la MFA et les passkeys, avec trois realms séparés. Les patients bénéficient d'une expérience fluide ; les professionnels utilisent toujours une MFA résistante à l'hameçonnage et doivent se ré-authentifier avant de signer une ordonnance ou de briser la glace ; le personnel de MedX ne voit jamais de données de santé.
L'autorisation se fait en deux couches : des rôles pour les règles générales, et des politiques à base d'attributs pour les règles fines — ce médecin soigne-t-il ce patient, pour quelle finalité, avec quel consentement. OPA les évalue à côté de chaque service en moins d'une milliseconde et renvoie avec sa décision les obligations de masquage.

## Diapositive 7 — Priorités HAUTES H2 et H5 — le dossier patient (1 min 30)

Le dossier est stocké en HL7 FHIR, le standard de la santé : validation, versionnage et future intégration avec les services nationaux sont acquis d'emblée.
Chaque requête traverse la même chaîne de sept étapes, à gauche : aucun point d'accès ne peut oublier un contrôle.
L'intégrité est prouvable : l'historique est en ajout seul, chaque version est chaînée par hachage, et chaque nuit les têtes de chaîne sont signées dans un module matériel de sécurité et stockées en écriture unique — même un administrateur ne peut pas réécrire l'historique sans que cela se voie.
L'accès est explicite : le patient, un mandataire, un médecin traitant avec une autorisation de soin limitée dans le temps, un médecin avec qui le patient a partagé, ou le bris de glace. Les pharmaciens et le personnel de MedX n'ont pas accès au dossier.

## Diapositive 8 — Priorité HAUTE H3 — l'accès d'urgence (2 min)

En urgence, chaque minute compte : l'accès n'est donc jamais bloqué par un circuit d'approbation ; il est étroit, limité dans le temps, et justifié a posteriori.
Le soignant identifie le patient par correspondance exacte uniquement, déclare l'urgence avec un motif, se ré-authentifie avec une passkey ou une carte e-CPS, et obtient immédiatement une autorisation en lecture seule de quatre heures. Le résumé patient international — allergies, problèmes, traitements, groupe sanguin, directives — revient en moins de 300 millisecondes.
Traçabilité : l'enregistrement d'audit est écrit dans la même transaction, le DPO est alerté en temps réel, le patient est informé sous 24 heures, et chaque cas est revu sous 72 heures.
Et cela résiste aux pannes : déploiement séparé, synthèses pré-calculées sur des répliques, actif dans deux régions.

## Diapositive 9 — Priorités HAUTES H1 et H5 — chiffrement et intégrité (1 min 30)

En transit, aucun saut en clair : TLS 1.3 en périphérie, TLS mutuel entre services, TLS vérifié vers chaque base de données, et chiffrement de bout en bout pour la vidéo. Comme les données de santé doivent rester secrètes pendant des décennies, nous activons l'échange de clés hybride post-quantique lorsqu'il est pris en charge.
Au repos, deux couches indépendantes : le chiffrement du stockage partout, plus un chiffrement applicatif avec une clé par patient, elle-même protégée par des clés qui ne quittent jamais les modules matériels de sécurité. Une sauvegarde volée est inutilisable, et détruire les clés d'un patient en fin de conservation rend toutes les copies illisibles.
L'intégrité est garantie par les contraintes et l'historique en ajout seul, et prouvée par les chaînes de hachage, les sommes de contrôle et des sauvegardes immuables que nous restaurons chaque semaine.

## Diapositive 10 — Priorités MOYENNES — les parcours de soin (1 min 30)

Planification : un blocage court et une contrainte de base de données rendent la double réservation impossible ; listes d'attente et file urgente servent les cas prioritaires, et les signes d'alerte redirigent vers le 15 ou le 112. Les agendas externes ne sont lus qu'en libre / occupé — aucune donnée patient ne sort de MedX.
Consultation : un serveur média WebRTC auto-hébergé dans l'UE, avec qualité adaptative, repli en audio seul et chiffrement de bout en bout pour les appels en tête-à-tête ; chat et partage de fichiers sont conservés de manière sécurisée.
Ordonnances : contrôles de sécurité face aux allergies du patient à la signature, signature dans un module matériel, et une révocation qui parvient à la pharmacie comme alerte critique. Le masquage garantit que les pharmaciens ne voient que ce qu'exige la délivrance.

## Diapositive 11 — Priorités BASSES — conçues maintenant, livrées en dernier (1 min)

Ces services complètent la plateforme. L'interface pharmacie offre un portail web à chaque pharmacie dès le premier jour et une API avec webhooks signés pour les logiciels intégrés.
Les notifications ont des files de priorité : une alerte de révocation n'est jamais bloquée derrière des rappels, et elles ne contiennent jamais de données de santé.
La facturation utilise les champs hébergés du prestataire de paiement : les numéros de carte ne touchent jamais MedX, ce qui nous maintient dans le périmètre PCI le plus léger.
Enfin, les environnements hors production ne voient que des données synthétiques ou anonymisées.

## Diapositive 12 — Modèle de données et stockage (1 min 30)

Chaque service possède sa base de données. PostgreSQL est notre choix par défaut car transactions et contraintes protègent l'intégrité — par exemple la contrainte d'exclusion qui interdit la double réservation, ou le grand livre en partie double toujours équilibré.
Nous n'ajoutons un stockage spécialisé que lorsque PostgreSQL convient mal : Cassandra pour les journaux en ajout intensif avec expiration, le stockage objet pour 150 téraoctets de documents avec conservation en écriture unique, Redis et OpenSearch pour des données dérivées toujours reconstructibles.
Les données cliniques sont modélisées en FHIR et conservées 20 ans ; au terme, le crypto-effacement les rend irrécupérables.

## Diapositive 13 — Scalabilité et performances (1 min 30)

En année 3, nous attendons environ 4 à 5 000 requêtes par seconde en pointe, et nous concevons pour 10 000 ; 10 000 appels simultanés représentent environ 24 gigabits par seconde à travers une centaine de serveurs média.
Les leviers : des services sans état mis à l'échelle sur leur vrai goulet, des disponibilités et synthèses pré-calculées, Kafka pour absorber les pics, et une trajectoire claire pour les bases de données — répliques, partitions, puis sharding par patient, et enfin cellules régionales.
Le budget de latence du chemin d'urgence montre la marge de la conception : environ 40 à 70 millisecondes typiquement, pour un objectif de 300 millisecondes. Tout est testé en charge à deux fois la pointe prévue avant chaque version majeure.

## Diapositive 14 — Résilience et reprise après sinistre (1 min 30)

Les services sont regroupés en trois niveaux de criticité. Le niveau 0 — accès d'urgence et connexion — vise 99,99 % et continue de fonctionner même si toute la région principale est perdue, car il est actif dans les deux régions.
Dans une région, chaque niveau est répliqué sur trois zones de disponibilité avec un secours synchrone de la base : perdre une zone ne fait perdre aucune donnée. Entre régions, un secours tiède reçoit une réplication asynchrone avec moins d'une minute de perte potentielle ; les services de soin reviennent en moins d'une heure.
Sous charge extrême, le délestage suit un ordre fixe : l'accès d'urgence et les consultations en cours sont protégés en premier ; les analyses sont sacrifiées en premier.

## Diapositive 15 — Sécurité et conformité (1 min 30)

Les données de santé placent MedX sous l'article 9 du RGPD : il faut une analyse d'impact avant le lancement, un DPO, et une notification des violations sous 72 heures. En France, l'hébergement exige la certification HDS : nous n'utilisons que des régions certifiées HDS dans l'Espace économique européen. Les règles de la télémédecine, NIS2, eIDAS pour les signatures, PCI DSS pour les paiements et l'Espace européen des données de santé sont couverts dès la conception, et une cellule américaine séparée rendrait MedX prête pour HIPAA.
La protection des données dès la conception se traduit par des règles concrètes : aucune donnée de santé dans les SMS, e-mails, agendas ou journaux ; les données de production ne quittent jamais la production ; les dossiers sont crypto-effacés en fin de conservation ; et les patients voient qui a consulté leur dossier.

## Diapositive 16 — Décisions clés et compromis (1 min 30)

Chaque décision a un coût, et nous avons choisi le coût que les priorités de MedX rendent acceptable.
Les microservices en zones de sécurité coûtent en complexité d'exploitation, mais isolent les données de santé et le chemin d'urgence. Le bris de glace sans approbation préalable accepte qu'un abus soit possible — il est détecté, revu et sanctionné — car une approbation préalable serait trop lente à 3 heures du matin aux urgences. Le chiffrement par patient ajoute la gestion des clés ; l'historique en ajout seul coûte environ 30 % de stockage en plus ; un serveur vidéo auto-hébergé implique d'exploiter une infrastructure média et de renoncer à l'enregistrement ; et nous réservons l'actif-actif complet au niveau 0 pour maîtriser les coûts.

## Diapositive 17 — Feuille de route (1 min)

Nous livrons dans l'ordre des priorités de MedX. La phase 0 construit les fondations de la plateforme. La phase 1 livre le socle clinique sécurisé — identité, dossier, intégrité, accès d'urgence et région de secours — et se termine par un jalon de sécurité : analyse d'impact, test d'intrusion et exercice de reprise.
La phase 2 ajoute les parcours de soin et se termine par un pilote avec des cliniques partenaires. La phase 3 apporte les pharmacies, le suivi des notifications, la facturation et l'anonymisation, puis le lancement public. Chaque phase a des critères de sortie mesurés, pas déclarés.

## Diapositive 18 — Conclusion (30 s)

En résumé : la sécurité est la fondation — les données de santé sont chiffrées deux fois, chaque accès est autorisé et audité, et l'historique ne peut pas être réécrit. L'accès d'urgence fonctionne en quelques secondes, même pendant une panne régionale, tout en restant traçable. Et la plateforme monte en charge par conception, du lancement à dix fois la charge, grâce aux événements, à la mise à l'échelle automatique, au sharding et aux cellules régionales.
Tous les détails — conception des composants, modèles de données, calculs de capacité, contrôles de sécurité et fiches de décision — sont dans le dépôt. Merci ; je suis prêt à répondre à vos questions.

## Diapositive 19 — Vue détaillée des conteneurs avec chaque composant, zone, service de plateforme, stockage et système externe. À utiliser pour les questions de détail ; zoomer dans PowerPoint (l'image est en haute résolution)

Vue détaillée des conteneurs avec chaque composant, zone, service de plateforme, stockage et système externe. À utiliser pour les questions de détail ; zoomer dans PowerPoint (l'image est en haute résolution).

## Diapositive 20 — Qui utilise MedX et de quels systèmes externes la plateforme dépend

Qui utilise MedX et de quels systèmes externes la plateforme dépend.

## Diapositive 21 — Région principale avec trois zones de disponibilité, région de secours tiède, pools de nœuds par zone de sécurité et un compte cloud par environnement

Région principale avec trois zones de disponibilité, région de secours tiède, pools de nœuds par zone de sécurité et un compte cloud par environnement.

## Diapositive 22 — Les cinq étapes, les garde-fous et les mécanismes de résilience du bris de glace

Les cinq étapes, les garde-fous et les mécanismes de résilience du bris de glace.

## Diapositive 23 — Chaque canal chiffré et la hiérarchie des clés du chiffrement d'enveloppe

Chaque canal chiffré et la hiérarchie des clés du chiffrement d'enveloppe.
