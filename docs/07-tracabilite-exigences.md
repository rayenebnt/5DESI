# 7. Matrice de traçabilité des exigences

> Preuve d'exhaustivité : chaque priorité de l'Annexe 2, chaque fonctionnalité de l'Annexe 1 et chaque livrable est
> rattaché à l'élément de conception qui y répond.

## 7.1 Priorités (Annexe 2)

| ID | Exigence | Réponse de conception | Où |
|----|----------|-----------------------|----|
| **H1** | Confidentialité des données — chiffrement au repos et en transit | TLS 1.3 en périphérie, mTLS dans le maillage (STRICT), TLS vers tous les stockages, DTLS-SRTP + chiffrement de bout en bout pour le média ; chiffrement AES-256 du stockage partout + chiffrement d'enveloppe par patient avec KMS adossé à des HSM ; aucune donnée de santé hors de la zone clinique | [§5.5](05-securite-et-conformite.md#55-chiffrement-en-transit), [§5.6](05-securite-et-conformite.md#56-chiffrement-au-repos-et-gestion-des-clés), [§1.5](01-architecture-haut-niveau.md#15-zones-de-sécurité-et-frontières-de-confiance) |
| **H2** | Gestion du dossier patient — sécurité, intégrité, conformité | Service Dossier patient dédié fondé sur FHIR, validation, notes et addenda signés, registre des consentements, autorisations de soin, audit complet, conservation et crypto-effacement | [§2.4](02-conception-composants/04-dossier-patient.md), [§3.4](03-modele-donnees-et-stockage.md#34-modèles-logiques-par-service) |
| **H3** | Accès d'urgence pour les professionnels de santé | Bris de glace : droit dédié + justification + MFA renforcée → autorisation en lecture seule de 4 heures → synthèse critique IPS en < 300 ms ; déploiement de niveau 0 isolé, actif dans deux régions ; alertes, information du patient, revue sous 72 heures | [§2.4 Accès d'urgence](02-conception-composants/04-dossier-patient.md#accès-durgence-bris-de-glace), [§4.9](04-scalabilite-et-performances.md#49-haute-disponibilité-et-reprise-après-sinistre) |
| **H4** | Authentification et autorisation | Keycloak (OIDC, MFA, passkeys, fédération), un realm par population, jetons liés de courte durée, OPA RBAC + ABAC appliqué localement, accès à privilèges juste-à-temps, recertification trimestrielle | [§2.1](02-conception-composants/01-gestion-utilisateurs.md), [§5.4](05-securite-et-conformite.md#54-gestion-des-identités-et-des-accès) |
| **H5** | Intégrité des données — ni perte ni corruption, stockage sécurisé des fichiers | ACID + contraintes, concurrence optimiste, historique en ajout seul, chaînes de hachage + ancrages signés, outbox, sommes de contrôle, Object Lock, sauvegardes immuables, stockage de documents analysé et chiffré, tests de restauration | [§3.8](03-modele-donnees-et-stockage.md#38-mécanismes-dintégrité-des-données), [§2.9 Stockage de documents](02-conception-composants/09-composants-plateforme.md#stockage-sécurisé-de-documents) |
| **M1** | Planification des téléconsultations avec notifications aux médecins | Service de planification : blocages de créneaux, saga, contrainte d'exclusion, liste d'attente, file urgente, mises à jour de l'agenda en temps réel + notifications | [§2.2](02-conception-composants/02-planification.md) |
| **M2** | Vidéo / audio, messagerie et partage de fichiers fiables | Plan de contrôle de la consultation + plan média SFU, qualité adaptative, chiffrement de bout en bout, messagerie avec accusés, dépôts via le stockage de documents | [§2.3](02-conception-composants/03-consultation.md) |
| **M3** | Gestion des ordonnances avec notifications | Versions signées, contrôles de sécurité, règles de modification et de révocation, alertes critiques de révocation, suivi de la délivrance | [§2.5](02-conception-composants/05-ordonnances.md) |
| **M4** | Masquage et caviardage des données | Obligations de politique appliquées par une bibliothèque de masquage partagée ; masquage partiel, listes blanches, exclusion par catégorie, vrai caviardage des PDF, journaux sans données de santé | [§2.4 Masquage](02-conception-composants/04-dossier-patient.md#masquage-et-caviardage-m4), [§5.7](05-securite-et-conformite.md#57-masquage-caviardage-et-anonymisation) |
| **M5** | Intégration aux agendas externes | Adaptateurs Google, Microsoft 365, CalDAV ; portées OAuth minimales ; synchronisation par notification + delta ; plages libres / occupées uniquement ; aucune donnée de santé écrite | [§2.2 Agendas](02-conception-composants/02-planification.md#intégration-des-agendas-externes) |
| **B1** | Interface pharmacie et stocks | Portail + API partenaire + webhooks signés, machine à états de la délivrance, adaptateurs d'inventaire, disponibilité à proximité | [§2.6](02-conception-composants/06-interface-pharmacie.md) |
| **B2** | Gestion des préférences utilisateur | API de préférences dans la gestion des utilisateurs, répliquée vers la notification par événements | [§2.1](02-conception-composants/01-gestion-utilisateurs.md), [§2.7](02-conception-composants/07-notification.md#préférences) |
| **B3** | Suivi de la distribution et de la lecture des notifications | Machine à états, accusés des fournisseurs, accusés de lecture dans l'application, journal en ajout seul (Cassandra, 13 mois), aucun pixel de suivi dans les e-mails | [§2.7](02-conception-composants/07-notification.md#suivi-de-distribution-et-de-lecture-b3) |
| **B4** | Anonymisation des données pour la préproduction et les démonstrations | Données synthétiques par défaut ; chaîne d'anonymisation (suppression des identifiants, pseudonymes à clé, généralisation, décalage des dates, k-anonymat), validation du DPO | [§5.7](05-securite-et-conformite.md#57-masquage-caviardage-et-anonymisation), [§2.9](02-conception-composants/09-composants-plateforme.md#plateforme-de-données-désidentifiées) |
| **B5** | Passerelle de paiement sécurisée | Champs hébergés par le PSP (SAQ A), 3-D Secure, jetons uniquement, pré-autorisation + encaissement, grand livre | [§2.8](02-conception-composants/08-facturation-paiement.md) |
| **B6** | Remboursement des transactions | Machine à états des remboursements, règles automatiques, double validation au-delà d'un seuil, avoirs, écritures comptables | [§2.8 Remboursements](02-conception-composants/08-facturation-paiement.md#remboursements-b6) |

**Couverture** : 5/5 exigences hautes, 5/5 moyennes et 6/6 basses sont conçues. L'ordre de livraison suit les
priorités ([feuille de route](08-feuille-de-route-et-risques.md)).

## 7.2 Fonctionnalités de l'Annexe 1

| Composant | Fonctionnalité | Mécanisme | Où |
|-----------|----------------|-----------|----|
| ① Gestion des utilisateurs | Inscriptions et mises à jour du profil | Inscription autonome du patient avec assurance de l'identité ; intégration des professionnels avec vérification dans les registres ; organisations de pharmacie | [§2.1](02-conception-composants/01-gestion-utilisateurs.md#responsabilités) |
| | Authentifier patients, médecins et personnel de pharmacie | Realms Keycloak, OIDC + PKCE, MFA, passkeys, fédération e-CPS | [§2.1](02-conception-composants/01-gestion-utilisateurs.md#parcours-dauthentification) |
| | Autoriser selon le rôle | Matrice RBAC + politiques ABAC (OPA) | [§2.1](02-conception-composants/01-gestion-utilisateurs.md#rôles-et-permissions-couche-rbac) |
| | Préférences | API de préférences + événements `PreferencesMisesAJour` | [§2.1](02-conception-composants/01-gestion-utilisateurs.md#responsabilités) |
| ② Planification | Réserver, déplacer, annuler | Blocages de créneaux, saga avec la facturation, règles d'annulation | [§2.2](02-conception-composants/02-planification.md#saga-de-réservation-et-prévention-des-doubles-réservations) |
| | Notifier les médecins | Événements → Notification + agenda en direct via la passerelle temps réel | [§2.2](02-conception-composants/02-planification.md#responsabilités) |
| | Agendas des médecins | Adaptateurs Google / Microsoft / CalDAV | [§2.2](02-conception-composants/02-planification.md#intégration-des-agendas-externes) |
| | Listes d'attente et priorité aux urgences | Appariement de la liste d'attente, triage, file urgente, capacité réservée | [§2.2](02-conception-composants/02-planification.md#liste-dattente-et-cas-urgents) |
| ③ Consultation | Salles virtuelles | Cycle de vie des salles, salle d'attente, jetons à portée restreinte | [§2.3](02-conception-composants/03-consultation.md#cycle-de-vie-de-la-salle) |
| | Flux vidéo et audio | SFU WebRTC + TURN, simulcast, repli en audio seul | [§2.3](02-conception-composants/03-consultation.md#qualité-média-sur-des-réseaux-réels) |
| | Messagerie texte | Messagerie WSS, accusés, archivage au dossier | [§2.3](02-conception-composants/03-consultation.md#chat) |
| | Transferts de fichiers | Chaîne du stockage de documents | [§2.3](02-conception-composants/03-consultation.md#partage-de-fichiers) |
| ④ Dossier patient | Stocker antécédents, notes et dossiers | Ressources FHIR + documents | [§2.4](02-conception-composants/04-dossier-patient.md#modèle-de-données-cliniques-fhir-r4) |
| | Ajout et modification par les médecins après consultation | Versionnage, signature, addenda | [§2.4](02-conception-composants/04-dossier-patient.md#écriture-versionnage-et-intégrité) |
| | Consultation par les patients (avec restrictions) | Portée patient, règles de mise à disposition, caviardage | [§2.4](02-conception-composants/04-dossier-patient.md#contrôle-daccès) |
| | Intégrité et conformité | Chaînes de hachage, ancrages, audit, consentement, conservation | [§2.4](02-conception-composants/04-dossier-patient.md#écriture-versionnage-et-intégrité) |
| ⑤ Ordonnances | Créer, modifier, révoquer | Versions signées, contrôles de sécurité | [§2.5](02-conception-composants/05-ordonnances.md#modifier-et-révoquer) |
| | Notifier les pharmacies | Événements → interface pharmacie, file critique pour les révocations | [§2.5](02-conception-composants/05-ordonnances.md#responsabilités) |
| | Consultation des ordonnances actives par les patients | API patient | [§2.5](02-conception-composants/05-ordonnances.md#api-sélection) |
| | Suivre la délivrance | Machine à états de la délivrance | [§2.5](02-conception-composants/05-ordonnances.md#cycles-de-vie-de-lordonnance-et-de-la-délivrance) |
| ⑥ Interface pharmacie | Accuser réception, mettre à jour les statuts | Boîte de réception, délai d'accusé, mises à jour de statut idempotentes | [§2.6](02-conception-composants/06-interface-pharmacie.md#flux-de-délivrance) |
| | Échanges patient–pharmacie | Fils de discussion + notifications | [§2.6](02-conception-composants/06-interface-pharmacie.md#responsabilités) |
| | Intégration des stocks | Adaptateurs + cache des disponibilités | [§2.6](02-conception-composants/06-interface-pharmacie.md#modes-dintégration) |
| ⑦ Notification | Alertes et rappels (SMS, e-mail, application) | Chaîne de traitement avec travailleurs par canal et files de priorité | [§2.7](02-conception-composants/07-notification.md#chaîne-de-traitement) |
| | Préférences (consentement, désinscription, fréquence) | Réplique locale, heures de silence, plafonds, résumés | [§2.7](02-conception-composants/07-notification.md#préférences) |
| | Statut de distribution et de lecture | Machine à états + journal | [§2.7](02-conception-composants/07-notification.md#suivi-de-distribution-et-de-lecture-b3) |
| ⑧ Facturation et paiement | Honoraires et paiements | Pré-autorisation + encaissement | [§2.8](02-conception-composants/08-facturation-paiement.md#cycle-de-vie-dun-paiement) |
| | Factures (consultations, médicaments) | Numérotation continue, PDF en WORM, avoirs | [§2.8](02-conception-composants/08-facturation-paiement.md#grand-livre-et-rapprochement) |
| | Remboursements | Processus de remboursement | [§2.8](02-conception-composants/08-facturation-paiement.md#remboursements-b6) |
| | Transactions sécurisées | Champs hébergés par le PSP, 3-D Secure, webhooks signés | [§2.8](02-conception-composants/08-facturation-paiement.md#réduction-du-périmètre-pci-dss) |

## 7.3 Livrables

| # | Livrable | Artefacts |
|---|----------|-----------|
| 1 | Diagramme d'architecture de haut niveau | [Architecture de haut niveau](01-architecture-haut-niveau.md) · [PNG](../diagrammes/medx-architecture-haut-niveau.png) / [SVG](../diagrammes/medx-architecture-haut-niveau.svg) · [contexte du système](../diagrammes/medx-contexte-systeme.png) · [vue de déploiement](../diagrammes/medx-deploiement.png) |
| 2 | Conception détaillée des composants | [Conception des composants](02-conception-composants/README.md) (8 services + composants de plateforme) |
| 3 | Modèle de données et stratégie de stockage | [Modèle de données et stockage](03-modele-donnees-et-stockage.md) |
| 4 | Scalabilité et performances | [Scalabilité et performances](04-scalabilite-et-performances.md) |
| 5 | Mesures de sécurité et de conformité | [Sécurité et conformité](05-securite-et-conformite.md) · [diagramme du chiffrement](../diagrammes/medx-chiffrement-cles.png) |
| 6 | Présentation | [Diapositives et notes de l'orateur](../presentation/) |

## 7.4 Critères d'évaluation

| Critère (pondération) | Où il est traité |
|-----------------------|------------------|
| Clarté de la communication (20 %) | Synthèse d'une page en tête de chaque document, numérotation cohérente ①–⑧, badges H/M/B, diagramme pour chaque flux clé, présentation avec notes de l'orateur |
| Solidité de l'architecture (20 %) | [§1](01-architecture-haut-niveau.md) justification du style, zones, règles de communication, dépendances synchrones acycliques ([index des composants](02-conception-composants/README.md#dépendances-synchrones)), [ADR](06-decisions-architecture.md) |
| Scalabilité et performances (20 %) | [§4](04-scalabilite-et-performances.md) : calculs de capacité, budgets de latence, mise à l'échelle par service, trajectoire des bases de données, vidéo à grande échelle, reprise après sinistre, dégradation, cellules |
| Alignement sur les priorités (20 %) | [§0.4](00-contexte-et-hypotheses.md#04-les-priorités-de-medx-et-leur-effet-sur-la-conception), [§6 décisions et compromis](06-decisions-architecture.md), [§8 feuille de route](08-feuille-de-route-et-risques.md) |
| Stratégie de gestion des données (10 %) | [§3](03-modele-donnees-et-stockage.md) et [§5.6-5.7](05-securite-et-conformite.md#56-chiffrement-au-repos-et-gestion-des-clés) |
| Exhaustivité (10 %) | Cette matrice : 16/16 exigences de priorité et 30/30 fonctionnalités de l'Annexe 1 couvertes |
