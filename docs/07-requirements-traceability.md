# 7. Requirements Traceability Matrix

> Proof of completeness: every priority of Appendix 2, every feature of Appendix 1 and every deliverable is mapped
> to the design element that satisfies it.

## 7.1 Priorities (Appendix 2)

| ID | Requirement | Design response | Where |
|----|-------------|-----------------|-------|
| **H1** | Data privacy — encryption at rest and in transit | TLS 1.3 at the edge, mTLS in the mesh (STRICT), TLS to all stores, DTLS-SRTP + E2EE for media; AES-256 storage encryption everywhere + per-patient envelope encryption with HSM-backed KMS; no PHI outside the clinical zone | [§5.5](05-security-and-compliance.md#55-encryption-in-transit), [§5.6](05-security-and-compliance.md#56-encryption-at-rest-and-key-management), [§1.5](01-high-level-architecture.md#15-security-zones-and-trust-boundaries) |
| **H2** | Patient records management — secure, integrity, compliance | Dedicated FHIR-based Records service, validation, signed notes and addenda, consent registry, care grants, full audit, retention and crypto-shredding | [§2.4](02-component-design/04-patient-records.md), [§3.4](03-data-model-and-storage.md#34-logical-data-models-per-service) |
| **H3** | Emergency access for healthcare professionals | Break-glass: entitlement + justification + step-up MFA → 4-hour read-only grant → IPS critical summary in < 300 ms; isolated Tier-0 deployment active in two regions; alerts, patient notice, 72-hour review | [§2.4 Emergency access](02-component-design/04-patient-records.md#emergency-access-break-glass), [§4.9](04-scalability-and-performance.md#49-high-availability-and-disaster-recovery) |
| **H4** | Authentication & authorization | Keycloak (OIDC, MFA, passkeys, federation), realms per population, short-lived bound tokens, OPA RBAC + ABAC with local enforcement, JIT privileged access, quarterly recertification | [§2.1](02-component-design/01-user-management.md), [§5.4](05-security-and-compliance.md#54-identity-and-access-management) |
| **H5** | Data integrity — no loss/corruption, secure file storage | ACID + constraints, optimistic concurrency, append-only history, hash chains + signed anchors, outbox, checksums, Object Lock, immutable backups, scanned & encrypted Document Store, restore tests | [§3.8](03-data-model-and-storage.md#38-data-integrity-mechanisms), [§2.9 Document Store](02-component-design/09-platform-components.md#secure-document-store) |
| **M1** | Teleconsultation scheduling with notifications to doctors | Scheduling service: holds, saga, exclusion constraint, waitlist, urgent queue, real-time agenda updates + notifications | [§2.2](02-component-design/02-scheduling.md) |
| **M2** | Reliable video/audio, chat, file sharing | Consultation control plane + SFU media plane, adaptive quality, E2EE, chat with receipts, Document Store uploads | [§2.3](02-component-design/03-consultation.md) |
| **M3** | Prescription management with notifications | Signed versions, safety checks, modify/revoke rules, critical revocation alerts, fulfilment tracking | [§2.5](02-component-design/05-prescription.md) |
| **M4** | Data masking and redaction | Policy obligations applied by a shared masking library; partial masking, allow-lists, category exclusion, true PDF redaction, PHI-free logs | [§2.4 Masking](02-component-design/04-patient-records.md#data-masking--redaction-m4), [§5.7](05-security-and-compliance.md#57-data-masking-redaction-and-anonymization) |
| **M5** | Integration with external calendars | Google, Microsoft 365, CalDAV adapters; OAuth minimal scopes; push + delta sync; free/busy only; no PHI written | [§2.2 Calendars](02-component-design/02-scheduling.md#external-calendar-integration) |
| **L1** | Pharmacy interface & inventory | Portal + partner API + signed webhooks, fulfilment state machine, inventory adapters, nearby availability | [§2.6](02-component-design/06-pharmacy-interface.md) |
| **L2** | User preferences management | Preferences API in User Management, replicated to Notification by events | [§2.1](02-component-design/01-user-management.md), [§2.7](02-component-design/07-notification.md#preferences) |
| **L3** | Notification delivery and read tracking | Status machine, provider receipts, in-app read receipts, append-only log (Cassandra, 13 months), no e-mail pixels | [§2.7](02-component-design/07-notification.md#delivery-and-read-tracking-l3) |
| **L4** | Data anonymization for staging/demo | Synthetic data by default; anonymisation pipeline (identifier removal, keyed pseudonyms, generalisation, date shifting, k-anonymity), DPO approval | [§5.7](05-security-and-compliance.md#57-data-masking-redaction-and-anonymization), [§2.9](02-component-design/09-platform-components.md#de-identified-data-platform) |
| **L5** | Secure payment gateway | PSP hosted fields (SAQ A), 3-D Secure, tokens only, pre-authorisation + capture, ledger | [§2.8](02-component-design/08-billing-payment.md) |
| **L6** | Transaction refunds | Refund state machine, automatic rules, 4-eyes above threshold, credit notes, ledger entries | [§2.8 Refunds](02-component-design/08-billing-payment.md#refunds-l6) |

**Coverage**: 5/5 High, 5/5 Medium and 6/6 Low requirements are designed. Delivery order follows the priorities
([roadmap](08-roadmap-and-risks.md)).

## 7.2 Features of Appendix 1

| Component | Feature | Mechanism | Where |
|-----------|---------|-----------|-------|
| ① User Management | Registrations and profile updates | Patient self-registration with identity assurance; professional onboarding with registry check; pharmacy organisations | [§2.1](02-component-design/01-user-management.md#responsibilities) |
| | Authenticate patients, doctors, pharmacy staff | Keycloak realms, OIDC + PKCE, MFA, passkeys, e-CPS federation | [§2.1](02-component-design/01-user-management.md#authentication-flows) |
| | Authorize by role | RBAC matrix + ABAC policies (OPA) | [§2.1](02-component-design/01-user-management.md#roles-and-permissions-rbac-layer) |
| | Preferences | Preferences API + `PreferencesUpdated` events | [§2.1](02-component-design/01-user-management.md#responsibilities) |
| ② Scheduling | Book, reschedule, cancel | Holds, saga with Billing, cancellation policy | [§2.2](02-component-design/02-scheduling.md#booking-saga-and-double-booking-prevention) |
| | Notify doctors | Events → Notification + live agenda via Real-time Gateway | [§2.2](02-component-design/02-scheduling.md#responsibilities) |
| | Doctors' calendars | Google / Microsoft / CalDAV adapters | [§2.2](02-component-design/02-scheduling.md#external-calendar-integration) |
| | Waitlists and urgent priority | Waitlist matcher, triage, urgent queue, reserved capacity | [§2.2](02-component-design/02-scheduling.md#waitlist-and-urgent-cases) |
| ③ Consultation | Virtual rooms | Room lifecycle, waiting room, scoped tokens | [§2.3](02-component-design/03-consultation.md#room-lifecycle) |
| | Video and audio streaming | WebRTC SFU + TURN, simulcast, audio-only fallback | [§2.3](02-component-design/03-consultation.md#media-quality-on-real-world-networks) |
| | Text chat | WSS chat, receipts, archive into the record | [§2.3](02-component-design/03-consultation.md#chat) |
| | File transfers | Document Store pipeline | [§2.3](02-component-design/03-consultation.md#file-sharing) |
| ④ Patient Records | Store histories, notes, records | FHIR resources + documents | [§2.4](02-component-design/04-patient-records.md#clinical-data-model-fhir-r4) |
| | Doctors add/edit post-consultation | Versioning, signature, addenda | [§2.4](02-component-design/04-patient-records.md#write-path-versioning-and-integrity) |
| | Patients view (with restrictions) | Patient scope, release rules, redaction | [§2.4](02-component-design/04-patient-records.md#access-control) |
| | Integrity & compliance | Hash chains, anchors, audit, consent, retention | [§2.4](02-component-design/04-patient-records.md#write-path-versioning-and-integrity) |
| ⑤ Prescription | Create, modify, revoke | Signed versions, safety checks | [§2.5](02-component-design/05-prescription.md#modify-and-revoke) |
| | Notify pharmacies | Events → Pharmacy Interface, critical lane for revocations | [§2.5](02-component-design/05-prescription.md#responsibilities) |
| | Patients view active prescriptions | Patient API | [§2.5](02-component-design/05-prescription.md#api-selection) |
| | Track fulfilment | Fulfilment state machine | [§2.5](02-component-design/05-prescription.md#prescription-and-fulfilment-lifecycles) |
| ⑥ Pharmacy Interface | Confirm receipt, update statuses | Inbox, acknowledgement SLA, idempotent status updates | [§2.6](02-component-design/06-pharmacy-interface.md#fulfilment-flow) |
| | Patient–pharmacy interaction | Conversation threads + notifications | [§2.6](02-component-design/06-pharmacy-interface.md#responsibilities) |
| | Inventory integration | Adapters + availability cache | [§2.6](02-component-design/06-pharmacy-interface.md#integration-modes) |
| ⑦ Notification | Alerts, reminders (SMS, e-mail, in-app) | Pipeline with channel workers and priority lanes | [§2.7](02-component-design/07-notification.md#pipeline) |
| | Preferences (opt-in/out, frequency) | Local replica, quiet hours, caps, digests | [§2.7](02-component-design/07-notification.md#preferences) |
| | Delivery & read status | Status machine + log | [§2.7](02-component-design/07-notification.md#delivery-and-read-tracking-l3) |
| ⑧ Billing & Payment | Fees and payments | Pre-authorisation + capture | [§2.8](02-component-design/08-billing-payment.md#payment-lifecycle) |
| | Invoices (consultations, medication) | Gapless numbering, WORM PDFs, credit notes | [§2.8](02-component-design/08-billing-payment.md#ledger-and-reconciliation) |
| | Refunds | Refund workflow | [§2.8](02-component-design/08-billing-payment.md#refunds-l6) |
| | Secure transactions | PSP hosted fields, 3-D Secure, signed webhooks | [§2.8](02-component-design/08-billing-payment.md#pci-dss-scope-minimisation) |

## 7.3 Deliverables

| # | Deliverable | Artefacts |
|---|-------------|-----------|
| 1 | High-level architecture diagram | [High-level architecture](01-high-level-architecture.md) · [PNG](../diagrams/medx-high-level-architecture.png) / [SVG](../diagrams/medx-high-level-architecture.svg) · [system context](../diagrams/medx-system-context.png) · [deployment view](../diagrams/medx-deployment-view.png) |
| 2 | Detailed component designs | [Component designs](02-component-design/README.md) (8 services + platform components) |
| 3 | Data model and storage strategy | [Data model & storage](03-data-model-and-storage.md) |
| 4 | Scalability and performance considerations | [Scalability & performance](04-scalability-and-performance.md) |
| 5 | Security and compliance measures | [Security & compliance](05-security-and-compliance.md) · [encryption diagram](../diagrams/medx-encryption-keys.png) |
| 6 | Presentation | [Slides and speaker notes](../presentation/) |

## 7.4 Evaluation criteria

| Criterion (weight) | Where it is addressed |
|--------------------|-----------------------|
| Clarity of communication (20 %) | One-page overviews at the top of each document, consistent numbering ①–⑧, H/M/L badges, diagrams for every key flow, presentation with speaker notes |
| Architectural soundness (20 %) | [§1](01-high-level-architecture.md) style rationale, zones, communication rules, acyclic synchronous dependencies ([§2.2 of the component index](02-component-design/README.md#22-synchronous-dependencies)), [ADRs](06-architecture-decisions.md) |
| Scalability & performance (20 %) | [§4](04-scalability-and-performance.md): capacity math, latency budgets, per-service scaling, DB scaling path, video at scale, DR, degradation, cells |
| Priorities alignment (20 %) | [§0.4](00-context-and-assumptions.md#04-medx-priorities-and-how-they-drive-the-design), [§6 decisions & trade-offs](06-architecture-decisions.md), [§8 roadmap](08-roadmap-and-risks.md) |
| Data handling strategy (10 %) | [§3](03-data-model-and-storage.md) and [§5.6–5.7](05-security-and-compliance.md#56-encryption-at-rest-and-key-management) |
| Completeness (10 %) | This matrix: 16/16 priority requirements and 30/30 Appendix-1 features covered |
