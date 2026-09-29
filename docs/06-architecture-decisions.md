# 6. Architecture Decisions & Trade-offs

> Why the design looks the way it does. Each decision is traced to MedX's priorities (Appendix 2) and states
> **what was given up** — a design without acknowledged costs is not a design.

## 6.1 The tensions that shaped the architecture

| Tension | How MedX resolves it | Priority that decided |
|---------|----------------------|-----------------------|
| **Privacy ⟷ emergency availability** | Access in an emergency is never blocked by a workflow; it is narrow, time-boxed, fully audited and reviewed (break-glass). | H1 + H3 |
| **Security ⟷ usability** | Strict for professionals (phishing-resistant MFA, step-up), smooth for patients (passkeys, risk-based MFA, biometrics). | H4, then M1–M2 |
| **Consistency ⟷ availability** | Strong consistency where errors harm (records writes, bookings, prescriptions, payments); eventual elsewhere; the emergency path favours availability with bounded staleness (< 5 s). | H2, H3, H5 |
| **Isolation ⟷ operational complexity** | Eight business services (no more), grouped in zones, on a shared golden-path platform. | H1, H3 |
| **Resilience ⟷ cost** | Active-active only for Tier 0 (emergency access, sign-in); warm standby for the rest. | H3 |
| **Rich messages ⟷ confidentiality** | Generic external messages + deep links into the authenticated app. | H1 |
| **Build ⟷ buy** | Build what is differentiating or sensitive (records, emergency access, care workflows, policies); buy commodities (IdP software, PSP, messaging, SFU software). | All — frees capacity for High priorities |

## 6.2 Decision log

| ADR | Decision | Priority link | Main alternative rejected | What we give up |
|-----|----------|---------------|---------------------------|-----------------|
| 01 | Microservices by bounded context, grouped into security zones | H1, H3, scalability | Modular monolith | Simpler operations |
| 02 | HL7 FHIR R4 (+ IPS) as the clinical model, on PostgreSQL | H2, interoperability | Custom relational schema | Some storage efficiency |
| 03 | PostgreSQL by default; specialised stores only when justified | H5, simplicity | NoSQL-first polyglot persistence | Extreme write scale by default |
| 04 | Append-only clinical history + hash chains + signed daily anchors | H2, H5 | In-place updates + audit table | ~30 % more storage |
| 05 | Two encryption layers with per-patient envelope keys | H1 | Storage encryption only | Complexity, ~1 ms per request |
| 06 | Break-glass with post-hoc review on an isolated, two-region Tier-0 path | H3 | Pre-approval workflow | Some risk of misuse (mitigated) |
| 07 | Proven IdP (Keycloak) + OPA policies (RBAC + ABAC) enforced locally | H4 | Custom auth; RBAC only | Running a stateful IdP cluster |
| 08 | Event-driven integration (Kafka) with transactional outbox | H5, scalability | Synchronous call chains | Eventual consistency to reason about |
| 09 | Self-hosted WebRTC SFU (LiveKit), E2EE by default for 1-to-1 | H1, M2 | Video CPaaS; P2P; MCU | Operating media servers; no recording |
| 10 | No PHI outside the trust boundary (messages, calendars, events, logs) | H1 | Rich notifications | Some convenience |
| 11 | PSP-hosted payment fields → PCI DSS SAQ A | L5, H1 | Handling card data | Control over payment UI |
| 12 | Multi-AZ everywhere + warm-standby DR; active-active only for Tier 0 | H3, H5 | Full active-active | RTO of 1–4 h for Tier 1–2 |
| 13 | Synthetic data by default outside production; anonymisation under DPO control | L4, H1 | Masked copies of production | Some realism in tests |
| 14 | Deliver by priority: secure core → care workflows → ecosystem | All | Feature-first MVP | Later commercial launch |

## 6.3 Decision records

### ADR-01 — Microservices by bounded context, grouped into security zones

- **Context** — eight business capabilities with very different data sensitivity (PHI, card-adjacent, contact
  data), load profiles (video bandwidth vs record reads vs payment correctness) and criticality (Tier 0 to 2).
- **Decision** — one service per Appendix-1 component, plus platform services; zones (identity, clinical,
  engagement, payment) with dedicated node pools and network policies.
- **Alternatives** — monolith (one blast radius); modular monolith (good start, but no isolation of the emergency
  path nor of compliance scopes); function-as-a-service (cold starts, poor fit for WebRTC/WebSocket).
- **Consequences** — ✅ isolation of PHI and failures, independent scaling and releases; ❌ distributed-systems
  complexity → golden-path template, service mesh, platform team, strict limit on the number of services.

### ADR-02 — HL7 FHIR R4 (+ International Patient Summary) as the clinical data model

- **Context** — records must be complete, valid, versioned and exchangeable with national services and hospitals;
  emergency access needs a standard summary.
- **Decision** — FHIR resources stored by a FHIR server (HAPI FHIR on PostgreSQL); IPS profile for the critical
  summary; national profiles for validation.
- **Alternatives** — custom schema (faster to start, costly integrations later); document database (flexible, but
  weaker transactions and one more technology).
- **Consequences** — ✅ interoperability, validation, history and search out of the box; ❌ generic storage is less
  efficient → UI projections and partitioning.

### ADR-03 — PostgreSQL by default, specialised stores only when justified

- **Decision** — PostgreSQL for all systems of record; Redis (ephemeral), Cassandra (append-heavy TTL logs),
  object storage (files), OpenSearch (search) only where PostgreSQL is a poor fit.
- **Why** — fewer technologies to secure, certify, back up and staff; constraints and transactions protect
  integrity (e.g., exclusion constraint against double booking).
- **Consequences** — ✅ integrity and simplicity; ❌ extreme write scale needs the sharding path (§4.7).

### ADR-04 — Append-only clinical history, hash chains and signed anchors

- **Decision** — no in-place update or physical deletion of clinical data during retention; each version chained
  by hash; daily Merkle root signed in the HSM, timestamped and stored in WORM.
- **Why** — H5 data integrity and H2 compliance: history must be provable, not just "logged".
- **Consequences** — ✅ tamper evidence even against administrators; ❌ ~30 % extra storage, verification jobs.

### ADR-05 — Two encryption layers with per-patient envelope keys

- **Decision** — storage encryption everywhere + application-level AES-256-GCM for C4 data with per-patient /
  per-file / per-consultation keys wrapped by HSM-backed KEKs.
- **Alternatives** — storage encryption only (does not protect against database-level compromise or leaked
  exports); one KMS key per patient (millions of KMS keys: cost and quota limits).
- **Consequences** — ✅ stolen data is useless, blast radius of one key = one patient, crypto-shredding at end of
  retention; ❌ key-management complexity, ~1 ms overhead with key caching, careful key backup policies.

### ADR-06 — Break-glass with post-hoc review, on an isolated Tier-0 path

- **Context** — H3 requires *immediate* access for authorised professionals; H1 requires strict confidentiality.
- **Decision** — self-service break-glass (entitlement + justification + step-up MFA) → 4-hour read-only grant →
  pre-computed IPS summary; real-time alert, patient notice, mandatory review within 72 h; separate deployment and
  database, active in two regions.
- **Alternatives** — supervisor pre-approval (too slow at 3 am in an emergency room); open access for all doctors
  (unacceptable privacy risk).
- **Consequences** — ✅ access in seconds, even during failures; ❌ misuse is possible but visible, attributable and
  sanctioned; one more deployable unit.

### ADR-07 — Proven IdP + policy-as-code authorization

- **Decision** — Keycloak for authentication (OIDC, MFA, passkeys, federation); OPA sidecars evaluating RBAC + ABAC
  policies from signed bundles; short-lived tokens validated locally.
- **Alternatives** — custom authentication (high risk); RBAC only (cannot express care relationships, consent or
  emergencies); central authorization server called on every request (latency and single point of failure).
- **Consequences** — ✅ strong, standard, testable, fast; ❌ revocation is not instantaneous (bounded by 5–10 min
  tokens + denylist), a stateful IdP to operate in two regions.

### ADR-08 — Event-driven integration with the transactional outbox

- **Decision** — services publish domain events (ids and statuses only) through an outbox relayed to Kafka;
  consumers are idempotent; synchronous calls only when a user is waiting (≤ 2 hops).
- **Alternatives** — synchronous chains (cascading failures, tight coupling); publish-after-commit without outbox
  (lost or phantom events).
- **Consequences** — ✅ decoupling, resilience, natural audit feed and projections; ❌ eventual consistency to
  design for (sagas, reconciliation jobs).

### ADR-09 — Self-hosted WebRTC SFU with end-to-end encryption

- **Decision** — LiveKit SFU and TURN servers on HDS-certified infrastructure; simulcast and adaptive bitrate; E2EE
  on by default for 1-to-1 consultations; no recording.
- **Alternatives** — CPaaS (fast to integrate, but media processed outside MedX's certified scope and costly at
  scale — kept as fallback); peer-to-peer mesh (no quality control, relaying issues); MCU (CPU-heavy, breaks E2EE).
- **Consequences** — ✅ data sovereignty, confidentiality, cost control; ❌ media operations skills, no server-side
  recording or transcription while E2EE is on.

### ADR-10 — No health data outside the trust boundary

- **Decision** — SMS, e-mails, push banners, external calendars, event payloads, logs and traces never contain
  health data; details are shown only after authentication in the app.
- **Consequences** — ✅ removes whole classes of leaks and keeps third-party providers out of the HDS scope; ❌ less
  informative messages (mitigated by deep links).

### ADR-11 — PSP-hosted payment fields (PCI DSS SAQ A)

- **Decision** — card data goes from the device to the PSP; MedX stores tokens only; 3-D Secure; own double-entry
  ledger for money movements.
- **Consequences** — ✅ minimal PCI scope and no card data to steal; ❌ payment UI constrained by the PSP components.

### ADR-12 — Multi-AZ everywhere, warm-standby DR, active-active only for Tier 0

- **Decision** — every tier redundant across 3 AZs (RPO 0 in-region); a second EU region as warm standby (RPO ≤ 1
  min); emergency access and sign-in active in both regions.
- **Alternatives** — full active-active (multi-master conflicts on clinical data, double cost); single region
  (unacceptable for Tier 0).
- **Consequences** — ✅ emergency access survives a regional outage, costs stay reasonable; ❌ Tier 1 and 2 recover in
  1 h and 4 h respectively.

### ADR-13 — Synthetic data by default outside production

- **Decision** — development, staging and demo use synthetic FHIR patients; realistic datasets only through the
  anonymisation pipeline, with DPO approval; production keys unusable outside production.
- **Consequences** — ✅ no real PHI in non-production, ever; ❌ some edge cases found later → targeted anonymised
  datasets and production-like load tests.

### ADR-14 — Deliver by priority, buy what is not differentiating

- **Decision** — secure core first (High), care workflows second (Medium), ecosystem last (Low) — see
  [roadmap](08-roadmap-and-risks.md). Low-priority capabilities rely on partners (PSP, messaging providers) and enter
  earlier only as thin slices required by Medium features.
- **Consequences** — ✅ the foundations every later feature depends on are right from day one; ❌ commercial launch
  waits for the secure core (a pilot with partner clinics runs during Phase 2).
