# 0. Context, Assumptions & Design Targets

> Part of the **MedX Technical Solution** design package. Start here: this document fixes the scope, the
> assumptions and the numbers that every other document relies on.

| # | Document | Deliverable |
|---|----------|-------------|
| 0 | Context, assumptions & design targets (this document) | Foundation |
| 1 | [High-level architecture](01-high-level-architecture.md) | Deliverable 1 |
| 2 | [Detailed component designs](02-component-design/README.md) | Deliverable 2 |
| 3 | [Data model & storage strategy](03-data-model-and-storage.md) | Deliverable 3 |
| 4 | [Scalability & performance](04-scalability-and-performance.md) | Deliverable 4 |
| 5 | [Security & compliance](05-security-and-compliance.md) | Deliverable 5 |
| 6 | [Architecture decisions & trade-offs](06-architecture-decisions.md) | Priorities alignment |
| 7 | [Requirements traceability matrix](07-requirements-traceability.md) | Completeness |
| 8 | [Roadmap & risks](08-roadmap-and-risks.md) | Priorities alignment |
| — | [Presentation](../presentation/) | Deliverable 6 |

---

## 0.1 MedX in one paragraph

MedX is a healthcare platform with three pillars: **telehealth consultations** (book, meet a doctor by
video, chat and share documents), **patient records management** (a secure, lifelong medical record
available to the patient and to the professionals who treat them) and **prescription tracking** (doctors
issue e-prescriptions that pharmacies receive, prepare and dispense, while the patient follows every step).
Because MedX handles health data — the most sensitive category of personal data — the architecture is
driven first by **data protection, record integrity and emergency availability**, then by the care
workflows, and last by business-support features.

## 0.2 Actors

| Actor | Description | Main channels | Typical actions |
|-------|-------------|---------------|-----------------|
| **Patient** | Adult user; can also act as **proxy** (parent of a minor, caregiver with consent) | Mobile app (iOS/Android), web app | Book, attend consultations, read records, follow prescriptions, pay |
| **Doctor / practitioner** | Verified health professional (license checked against the national registry) | Web portal (desktop), mobile app | Manage availability, run consultations, write notes, prescribe |
| **Emergency clinician** | Practitioner holding the `emergency_access` entitlement (ER, on-call, EMS) | Web portal, mobile app | Break-glass access to a patient's critical information |
| **Pharmacy staff** | Pharmacist, technician, pharmacy administrator | Pharmacy portal, or their pharmacy management system (PMS) through the partner API | Receive prescriptions, update status, answer patient inquiries |
| **MedX operations** | Support agent, billing agent, platform administrator, **privacy officer / DPO**, auditor | Back-office console (VPN + SSO + hardware MFA) | Support without clinical data, audits, break-glass reviews |
| **External systems** | Calendars, payment provider, SMS/e-mail/push providers, pharmacy systems, drug database, national health services, identity federation | APIs, webhooks | Integration |

## 0.3 Scope

**In scope** — the eight business components of Appendix 1 plus the platform capabilities they need:

1. User Management (identity, authentication, authorization, preferences)
2. Teleconsultation Scheduling (booking, waitlists, urgent requests, external calendars)
3. Consultation (virtual rooms, video/audio, chat, file transfer)
4. Patient Records Management (medical history, notes, documents, **emergency access**)
5. Prescription Management
6. Pharmacy Interface
7. Notification
8. Billing & Payment

Platform capabilities: API & real-time gateways, policy engine, event bus, secure document store, audit
trail, key management, observability, de-identified data platform.

**Out of scope for v1** (kept compatible with the design): in-clinic practice management, medical imaging
(PACS/DICOM viewers — only document uploads and links), insurance claim processing (third-party payer),
AI-assisted diagnosis, connected medical devices. They are listed in the [roadmap](08-roadmap-and-risks.md).

## 0.4 MedX priorities and how they drive the design

The brief is explicit: *protecting data in transit and at rest is paramount* and *health professionals must
access patient information promptly in emergencies*. Each High-priority requirement is therefore turned into
a **non-negotiable architecture principle**, not just a feature.

| Priority | Requirement | Turned into… |
|----------|-------------|--------------|
| **High** | H1 Data privacy (encryption at rest & in transit) | TLS 1.3 / mTLS everywhere, AES-256 at rest everywhere, **per-patient envelope encryption** of clinical data (principle P1) |
| **High** | H2 Patient records management | Dedicated **FHIR-based** Records service, versioned & audited (P3, P4) |
| **High** | H3 Emergency access | **Break-glass** capability on an isolated, Tier-0 read path with post-hoc review (P2) |
| **High** | H4 Authentication & authorization | Proven IdP (OIDC, MFA) + **RBAC + ABAC** policy engine, zero trust between services (P1) |
| **High** | H5 Data integrity & secure file storage | Append-only history, hash chaining, checksums, immutable backups, scanned & encrypted document store (P3) |
| Medium | M1–M5 Scheduling, consultations, prescriptions, masking, calendars | Core care workflows built on the High-priority foundation |
| Low | L1–L6 Pharmacy, preferences, notification tracking, anonymization, billing, refunds | Designed now, delivered last, **bought rather than built** when possible (PSP, messaging providers) |

## 0.5 Architecture principles

| ID | Principle | What it means in practice |
|----|-----------|---------------------------|
| **P1** | **Privacy & security by design and by default** | Encrypt everything, least privilege, deny by default, data minimisation (no health data in SMS, e-mails, calendars, logs or events). |
| **P2** | **Patient safety first** | The emergency access path must keep working when everything else is degraded: isolated deployment, minimal dependencies, highest availability tier. |
| **P3** | **Integrity over convenience** | Clinical data is never overwritten or physically deleted during its retention period: every change is a new, attributed, tamper-evident version. |
| **P4** | **Standards over custom** | HL7 FHIR R4 (+ International Patient Summary), OpenID Connect / OAuth 2.1, WebRTC, OpenAPI 3.1, CloudEvents. Easier interoperability, audits and hiring. |
| **P5** | **Loose coupling, strong ownership** | One service = one bounded context = one private datastore. Services integrate through versioned APIs and domain events. |
| **P6** | **Buy commodity, build differentiators** | Reuse an IdP, a payment provider, messaging providers, an open-source SFU. Build what makes MedX unique: records, emergency access, care workflows. |
| **P7** | **Scale out and automate** | Stateless services, horizontal autoscaling, infrastructure as code, GitOps, no manual changes in production. |
| **P8** | **Observable and auditable by default** | Every request traced, every access to health data audited in an immutable trail. |

## 0.6 Assumptions

| ID | Assumption | Impact on the design |
|----|------------|----------------------|
| A1 | MedX launches in the **EU (France first)**; the US is a possible later market. | GDPR + French **HDS** certification (health-data hosting) are mandatory; the design is **HIPAA-ready** (BAAs, audit, encryption) for a later US cell. |
| A2 | Hosting on a **public cloud with HDS certification** (reference implementation: AWS Paris region, DR in Frankfurt; Azure, Google Cloud or OVHcloud are equivalent options). | Managed services are used only when they are inside the provider's certified scope. All health data stays in the EEA. |
| A3 | Legal roles (controller / processor) between MedX and practitioners are defined by the DPO. | The design supports both: per-practitioner access control, consent registry, full audit. |
| A4 | Patients use a recent smartphone or browser supporting WebRTC; some have poor connectivity. | Adaptive bitrate, audio-only fallback, TURN relays, mobile-first UX. |
| A5 | Pharmacies use heterogeneous management systems, some without APIs. | Web portal for everyone + adapter-based partner API for connected systems. |
| A6 | Payments are processed by a PCI DSS Level 1 **payment service provider** (PSP). | MedX never stores card data → minimal PCI scope (SAQ A). |
| A7 | Doctors use Google Workspace, Microsoft 365 or CalDAV calendars. | Connectors for the three families, free/busy only. |
| A8 | Integration with national services (e-prescription, national health identifier, shared medical record) comes after v1. | Records and prescriptions are modelled in FHIR to make these integrations adapters, not redesigns. |
| A9 | Growth targets below are planning figures, to be re-validated each quarter. | Capacity is designed with ×2 headroom and a clear scaling path beyond. |

## 0.7 Capacity targets

Figures used for sizing in the [scalability document](04-scalability-and-performance.md).

| Metric | Year 1 (launch) | Year 3 (target) | Design capacity (Year 3 × 2) |
|--------|-----------------|-----------------|------------------------------|
| Registered patients | 1 M | 10 M | — |
| Healthcare professionals | 5 k | 50 k | — |
| Connected pharmacies | 2 k | 15 k | — |
| Daily active users (peak day) | 100 k | 1 M | 2 M |
| Teleconsultations per day | 20 k | 200 k | 400 k |
| Concurrent video sessions (peak hour) | 1 k | 10 k | 20 k |
| Prescriptions per day | 12 k | 120 k | 240 k |
| Notifications per day | 200 k | 2 M | 4 M |
| API requests per second (peak) | 500 | 5 k | 10 k |
| Concurrent WebSocket connections (peak) | 20 k | 200 k | 400 k |
| Medical documents (cumulative) | 10 TB | 150 TB | — |
| Structured clinical data (FHIR store) | 0.5 TB | 10 TB | — |
| Audit events per day | 2 M | 20 M | 40 M |

*How the Year-3 figures were derived:* 50 k professionals × 4 teleconsultations/day = 200 k consultations;
12 % of them in the peak hour × 20 min average session (waiting room included) ≈ 8 k concurrent sessions,
rounded to 10 k; 60 % of consultations end with a prescription; ~6 notifications per consultation plus pharmacy
and messaging events ≈ 2 M/day; ~75 M API calls/day with a ×5 peak factor ≈ 4.3 k req/s, rounded to 5 k.

## 0.8 Service levels and criticality tiers

Services are grouped into **criticality tiers**. The tier sets the availability objective, the recovery
objectives and the order in which capacity is protected when the platform is under stress.

| Tier | Scope | Availability | RPO | RTO (region loss) | RTO (zone loss) |
|------|-------|--------------|-----|-------------------|-----------------|
| **Tier 0 — life-critical** | Emergency access, authentication/token validation, records read path | **99.99 %** | 0 in-region (synchronous multi-AZ), ≤ 1 min cross-region | **≤ 15 min** | automatic, < 1 min |
| **Tier 1 — care delivery** | Records write, consultation, scheduling, prescription, chat | 99.95 % | 0 in-region, ≤ 1 min cross-region | ≤ 1 h | automatic, < 2 min |
| **Tier 2 — support** | Pharmacy interface, notification, billing, analytics | 99.9 % | ≤ 5 min | ≤ 4 h | automatic, < 5 min |

| Capability | Tier | Latency objective (p95) |
|------------|------|-------------------------|
| Emergency access — critical summary | 0 | **< 300 ms** API, < 1 s on screen |
| Login / token issuance | 0 | < 300 ms (excluding user MFA interaction) |
| Patient record read / write | 1 | < 300 ms / < 500 ms |
| Video consultation | 1 | join < 3 s; < 100 ms RTT to the nearest media node; mouth-to-ear < 400 ms |
| Chat message delivery | 1 | < 500 ms |
| Prescription signed → visible in pharmacy inbox | 1 | < 5 s |
| Slot search / booking | 1 | < 300 ms / < 800 ms (excluding 3-D Secure) |
| Notification dispatch (critical / standard) | 2 | < 10 s / < 60 s |
| Inventory availability check | 2 | < 1 s cached, < 3 s live |
| Payment authorisation | 2 | < 2 s (excluding 3-D Secure) |

## 0.9 Glossary

| Term | Meaning |
|------|---------|
| **PHI** | Protected Health Information — any health data linked to an identifiable person ("données de santé" under GDPR art. 9). |
| **HDS** | *Hébergeur de Données de Santé* — French certification mandatory for hosting health data. |
| **FHIR** | HL7 Fast Healthcare Interoperability Resources — the standard data model and REST API for health data. |
| **IPS** | International Patient Summary (HL7 FHIR IG) — minimal clinical summary designed for unplanned care; basis of the MedX emergency summary. |
| **Break-glass** | Controlled override that grants immediate access in an emergency, with justification and mandatory review. |
| **RBAC / ABAC** | Role-Based / Attribute-Based Access Control. |
| **PDP / PEP** | Policy Decision Point (evaluates rules) / Policy Enforcement Point (enforces the decision in each service). |
| **DEK / KEK** | Data Encryption Key / Key Encryption Key (envelope encryption). |
| **HSM / KMS** | Hardware Security Module / Key Management Service. |
| **SFU / TURN** | Selective Forwarding Unit (video router) / relay server used when a direct media path is impossible. |
| **WORM** | Write Once, Read Many — storage that cannot be altered or deleted before its retention expires. |
| **RPO / RTO** | Recovery Point Objective (max data loss) / Recovery Time Objective (max downtime). |
| **SLO** | Service Level Objective. |
| **INS / RPPS / FINESS** | French national patient health identifier / practitioner registry number / health establishment (pharmacy) registry number. |
| **PSP** | Payment Service Provider (e.g., Stripe, Adyen). |
| **Outbox pattern** | Events are written in the same database transaction as the business change, then published — no lost or phantom events. |
