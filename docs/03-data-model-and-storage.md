# 3. Data Model & Storage Strategy

> **Deliverable 3.** Synthetic analysis of the data model and of the storage chosen for each component.
> Component behaviour is described in [2. Detailed component designs](02-component-design/README.md).

## 3.1 Principles

1. **Database per service.** Each service owns its schema, credentials and migrations; no other service reads its
   tables. Cross-service references are **identifiers only** (UUIDv7), resolved through APIs or events.
2. **PostgreSQL by default.** Transactions, constraints, JSONB, mature replication and point-in-time recovery, a
   managed Multi-AZ offering inside the HDS scope, and skills that are easy to hire. A specialised store is added
   only when it solves a problem PostgreSQL does not solve well (§3.3).
3. **Classify before storing.** Every field has a data class (§3.2) that decides its encryption, masking, logging and
   retention rules.
4. **Append-only for anything clinical, legal or financial.** Records, prescriptions, fulfilment statuses, ledger and
   audit are never updated in place — changes are new versions or new entries.
5. **Derived data is disposable.** Caches, search indexes and projections can be rebuilt from the systems of record;
   they are never the only copy of anything.
6. **Every store is encrypted, private, backed up, monitored and has a retention rule** — no exception.

## 3.2 Data classification

| Class | Definition | Examples | Mandatory controls |
|-------|------------|----------|--------------------|
| **C4 — Sensitive health data** | Clinical content, sensitive categories, national health identifier | Notes, diagnoses, results, documents, chat content, mental/sexual health, genetics, INS | Clinical zone only · per-patient application encryption **+** storage encryption · ABAC with purpose of use · never cached (except encrypted emergency summary) · never in logs, events, search indexes or non-prod |
| **C3 — Health-related personal data** | Data revealing that a person receives care | Appointments, doctor–patient links, prescriptions, fulfilment statuses | Clinical zone · storage encryption, sensitive fields encrypted · minimised for pharmacies · audited access |
| **C2 — Personal data** | Identity and contact data without health information | Name, e-mail, phone, address, preferences, invoices | Field encryption for contact data · masking for support · GDPR rights applied |
| **C1 — Internal** | Operational, non-personal | Configuration, metrics, pseudonymous telemetry | Access control, standard encryption |
| **C0 — Public** | Meant to be published | Doctor public profiles, drug reference data, static content | Integrity controls |

## 3.3 Storage technology choices

| Technology | Role at MedX | Chosen because | Deliberately **not** used for |
|------------|--------------|----------------|-------------------------------|
| **PostgreSQL** (managed, Multi-AZ, synchronous standby, read replicas, cross-region replica) | System of record of all eight services, the FHIR store, emergency grants, document metadata | ACID, rich constraints (e.g., exclusion constraint against double booking), JSONB for FHIR resources, row-level security, PITR, mature HA | Very high-volume append-only logs with TTL (chat hot store, notification log) |
| **Redis / Valkey** (cluster, replicas in 3 AZs, TLS, encryption at rest) | Slot holds, availability cache, sessions and token denylist, rate limits, idempotency keys, presence, pub/sub | Sub-millisecond latency, atomic `SET NX`, TTLs, pub/sub | Any source of truth (everything in Redis can be rebuilt) |
| **Cassandra** (RF 3 across 3 AZs, TLS, encryption at rest) | Consultation chat hot store (30 days), notification log (13 months) | Linear write scalability, time-ordered partitions, native TTL, multi-datacenter replication | Relational integrity, ad hoc queries, long-term clinical storage |
| **Object storage** (S3-compatible: versioning, Object Lock, SSE-KMS, cross-region replication) | Medical documents, chat transcripts, prescription PDFs, invoices, audit archive, backups | 11-nines durability, WORM retention, lifecycle tiers, low cost at 150 TB | Small structured records |
| **OpenSearch** (private, encrypted, fine-grained access control) | Doctor directory, drug catalogue search, restricted audit investigation index | Full-text, facets, geo queries, fast aggregation | Storing clinical content (it is **not** a PHI store) |
| **Kafka** (3 brokers, RF 3) | Event log, 7 days (30 days for audit) | Durable, ordered per key, replayable | Long-term storage |
| **Columnar analytics store** (Parquet files + query engine) | De-identified analytics | Cheap scans over large volumes | Identifiable data |

**Alternatives considered** — a document database for FHIR JSON (PostgreSQL JSONB gives the same flexibility with
cross-resource transactions and one less technology to secure); a ledger database for audit (hash-chained batches
on WORM object storage give tamper evidence without a niche product); DynamoDB-style key-value stores (vendor
lock-in and harder portability across HDS providers).

## 3.4 Logical data models per service

### Storage strategy per component — synthesis

| Component | System of record | Secondary stores | Key design points | Volume (Year 3) |
|-----------|------------------|------------------|-------------------|-----------------|
| ① User Management | PostgreSQL `usermgmt` + Keycloak's PostgreSQL | Redis (sessions, denylist) | Contact data encrypted, e-mail blind index, preferences as versioned JSONB | ~50 GB |
| ② Scheduling | PostgreSQL `scheduling` | Redis (holds, availability, queues), OpenSearch (directory) | Exclusion constraint, append-only history, reason encrypted | ~250 GB/year |
| ③ Consultation | PostgreSQL `consultation` | Cassandra (chat, 30-day TTL), Redis (routing, presence), Document Store | Chat encrypted per consultation, transcript archived to the record | ~50 GB/year + ~120 GB hot chat |
| ④ Patient Records | PostgreSQL `records` (FHIR resources + history) | Read replicas (3 AZs + DR), Document Store | Append-only history, hash chain, per-patient keys, projections | **~10 TB** structured |
| ④ Emergency Access | PostgreSQL `emergency` (own, per region) | Records read replicas | Grant + audit in one transaction, active in two regions | < 10 GB |
| ⑤ Prescription | PostgreSQL `prescription` | Drug reference replica, OpenSearch (drug search) | Signed immutable versions, two state machines | ~250 GB/year |
| ⑥ Pharmacy Interface | PostgreSQL `pharmacy` (+ PostGIS) | Redis (availability cache) | Append-only status events, credentials in Vault | ~100 GB/year |
| ⑦ Notification | Cassandra (log, 13-month TTL) | PostgreSQL (templates, preference replica), Redis (dedupe, caps) | No PHI stored at all | ~1.2 TB (13 months, before replication) |
| ⑧ Billing & Payment | PostgreSQL `billing` | Document Store (invoice PDFs, WORM) | Double-entry append-only ledger, minor-unit integers, PSP tokens only | ~100 GB/year |
| Document Store | Object storage | PostgreSQL (metadata, wrapped keys) | Quarantine → scan → encrypt → Object Lock | **~150 TB** cumulative |
| Audit Trail | Object storage (WORM, security account) | OpenSearch (13 months), SIEM | Hash-chained batches, signed daily Merkle roots | ~0.7 TB/year compressed |

### Cross-service domain model

Entities belong to one service; relationships across services are references by identifier.

```mermaid
erDiagram
    PATIENT ||--o{ APPOINTMENT : books
    PRACTITIONER ||--o{ APPOINTMENT : "is booked for"
    APPOINTMENT ||--o| CONSULTATION : "takes place as"
    APPOINTMENT ||--o| PAYMENT : "is paid by"
    PATIENT ||--|| MEDICAL_RECORD : owns
    MEDICAL_RECORD ||--o{ ENCOUNTER : contains
    CONSULTATION ||--o| ENCOUNTER : "is documented as"
    MEDICAL_RECORD ||--o{ DOCUMENT : contains
    ENCOUNTER ||--o{ PRESCRIPTION : "results in"
    PRACTITIONER ||--o{ PRESCRIPTION : signs
    PRESCRIPTION ||--o| FULFILMENT : "is fulfilled through"
    PHARMACY ||--o{ FULFILMENT : performs
    PAYMENT ||--o| INVOICE : "is evidenced by"
    PATIENT ||--o{ NOTIFICATION : receives
```

| Entity | Owner service | Store |
|--------|---------------|-------|
| Patient, Practitioner, Pharmacy (identity, organisation) | ① User Management | PostgreSQL |
| Appointment | ② Scheduling | PostgreSQL |
| Consultation | ③ Consultation | PostgreSQL + Cassandra (chat) |
| Medical record, Encounter, clinical resources | ④ Patient Records | PostgreSQL (FHIR) |
| Document | Document Store (metadata) / ④ (clinical reference) | Object storage + PostgreSQL |
| Prescription | ⑤ Prescription | PostgreSQL |
| Fulfilment | ⑥ Pharmacy Interface (operational) / ⑤ (legal status) | PostgreSQL |
| Notification | ⑦ Notification | Cassandra |
| Payment, Invoice | ⑧ Billing & Payment | PostgreSQL + object storage |

### ① User Management

```mermaid
erDiagram
    USER_ACCOUNT ||--o| PATIENT_PROFILE : "is a"
    USER_ACCOUNT ||--o| PRACTITIONER : "is a"
    USER_ACCOUNT ||--o{ ROLE_ASSIGNMENT : has
    USER_ACCOUNT ||--o{ MEMBERSHIP : "belongs to"
    ORGANIZATION ||--o{ MEMBERSHIP : has
    PRACTITIONER ||--o{ VERIFICATION_CASE : "verified through"
    USER_ACCOUNT ||--o{ DELEGATION : grants
    USER_ACCOUNT ||--|| PREFERENCES : has
    USER_ACCOUNT {
        uuid id PK
        string realm
        string idp_subject UK
        bytea email_enc
        string email_blind_index UK
        bytea phone_enc
        string status
        timestamptz created_at
    }
    PATIENT_PROFILE {
        uuid user_id PK
        bytea name_enc
        bytea birth_date_enc
        bytea national_health_id_enc
        string identity_assurance
    }
    PRACTITIONER {
        uuid user_id PK
        string registry_number UK
        string specialty
        string verification_status
        boolean emergency_access
    }
    ORGANIZATION {
        uuid id PK
        string type
        string registry_number UK
        string name
    }
    MEMBERSHIP {
        uuid user_id FK
        uuid organization_id FK
        string role
    }
    ROLE_ASSIGNMENT {
        uuid id PK
        uuid user_id FK
        string role
        uuid granted_by
        timestamptz valid_until
    }
    DELEGATION {
        uuid id PK
        uuid grantor_id FK
        uuid delegate_id FK
        string scope
        timestamptz valid_until
    }
    PREFERENCES {
        uuid user_id PK
        jsonb settings
        int version
    }
    VERIFICATION_CASE {
        uuid id PK
        uuid practitioner_id FK
        string state
        uuid decided_by
    }
```

*Blind index*: `email_blind_index = HMAC-SHA256(k, normalised e-mail)` lets the service find an account by e-mail
without storing the address in clear; the HMAC key lives in Vault.

### ② Scheduling

```mermaid
erDiagram
    PRACTITIONER_REF ||--o{ AVAILABILITY_RULE : defines
    PRACTITIONER_REF ||--o{ APPOINTMENT : "is booked in"
    APPOINTMENT ||--|{ APPOINTMENT_HISTORY : "changes logged in"
    PRACTITIONER_REF ||--o{ WAITLIST_ENTRY : "is awaited in"
    PRACTITIONER_REF ||--o{ CALENDAR_CONNECTION : owns
    CALENDAR_CONNECTION ||--o{ EXTERNAL_BUSY_BLOCK : imports
    PRACTITIONER_REF {
        uuid practitioner_id PK
        string status
        string timezone
    }
    AVAILABILITY_RULE {
        uuid id PK
        uuid practitioner_id FK
        string rrule
        int slot_minutes
        string consultation_type
    }
    APPOINTMENT {
        uuid id PK
        uuid patient_id
        uuid practitioner_id FK
        timestamptz starts_at
        timestamptz ends_at
        string status
        string urgency
        bytea reason_enc
        uuid payment_id
        int version
    }
    APPOINTMENT_HISTORY {
        uuid appointment_id FK
        int version
        string status
        uuid changed_by
        timestamptz changed_at
    }
    WAITLIST_ENTRY {
        uuid id PK
        uuid patient_id
        uuid practitioner_id FK
        string specialty
        string urgency
        timestamptz joined_at
    }
    CALENDAR_CONNECTION {
        uuid id PK
        uuid practitioner_id FK
        string provider
        string token_ref
        string sync_cursor
        timestamptz subscription_expires_at
    }
    EXTERNAL_BUSY_BLOCK {
        uuid id PK
        uuid connection_id FK
        timestamptz starts_at
        timestamptz ends_at
    }
```

The exclusion constraint on `(practitioner_id, tstzrange(starts_at, ends_at))` for active statuses is described in
[§2.2](02-component-design/02-scheduling.md#booking-saga-and-double-booking-prevention).
Redis keys: `hold:{practitioner}:{start}` (TTL 10 min), `avail:{practitioner}:{date}` (hash of free slots),
`waitlist:{practitioner|specialty}` (sorted set by urgency then time).

### ③ Consultation

```mermaid
erDiagram
    CONSULTATION ||--|{ PARTICIPANT : has
    CONSULTATION ||--o{ SESSION_EVENT : records
    CONSULTATION ||--o| QUALITY_SUMMARY : summarises
    CONSULTATION ||--o{ CHAT_MESSAGE : "chat (Cassandra)"
    CONSULTATION {
        uuid id PK
        uuid appointment_id UK
        string state
        string media_region
        bytea wrapped_chat_key
        timestamptz opened_at
        timestamptz ended_at
    }
    PARTICIPANT {
        uuid id PK
        uuid consultation_id FK
        uuid user_id
        string role
        timestamptz admitted_at
    }
    SESSION_EVENT {
        uuid consultation_id FK
        string type
        timestamptz at
    }
    QUALITY_SUMMARY {
        uuid consultation_id PK
        float avg_rtt_ms
        float packet_loss_pct
        int freeze_count
    }
    CHAT_MESSAGE {
        uuid consultation_id PK
        timeuuid message_id PK
        uuid sender_id
        uuid client_msg_id
        bytea body_enc
        uuid document_id
    }
```

Cassandra partition = `consultation_id` (all messages of one consultation together, ordered by `timeuuid`);
`default_time_to_live` = 30 days; the transcript is archived into the record before expiry.

### ④ Patient Records and Emergency Access

```mermaid
erDiagram
    PATIENT_RECORD ||--|| PATIENT_KEY : "encrypted with"
    PATIENT_RECORD ||--o{ RESOURCE : contains
    RESOURCE ||--|{ RESOURCE_HISTORY : "append-only versions"
    PATIENT_RECORD ||--o{ CARE_GRANT : "shared through"
    PATIENT_RECORD ||--o{ CONSENT : "governed by"
    PATIENT_RECORD ||--|| CRITICAL_SUMMARY : "projected into"
    PATIENT_RECORD {
        uuid patient_id PK
        string status
        date retention_until
        boolean legal_hold
        string chain_head
    }
    PATIENT_KEY {
        uuid patient_id PK
        bytea wrapped_key
        string kek_id
        timestamptz rotated_at
        timestamptz destroyed_at
    }
    RESOURCE {
        uuid id PK
        uuid patient_id FK
        string resource_type
        int version
        string status
        string security_label
        jsonb content
        timestamptz updated_at
    }
    RESOURCE_HISTORY {
        uuid resource_id PK
        int version PK
        jsonb content
        string prev_hash
        string hash
        uuid author_id
        string change_reason
        timestamptz recorded_at
    }
    CARE_GRANT {
        uuid id PK
        uuid patient_id FK
        uuid practitioner_id
        string source
        timestamptz valid_from
        timestamptz valid_to
    }
    CONSENT {
        uuid id PK
        uuid patient_id FK
        string type
        string status
        timestamptz recorded_at
    }
    CRITICAL_SUMMARY {
        uuid patient_id PK
        bytea summary_enc
        boolean break_glass_allowed
        timestamptz refreshed_at
    }
```

```mermaid
erDiagram
    EMERGENCY_GRANT ||--|| REVIEW_CASE : "reviewed in"
    EMERGENCY_GRANT {
        uuid id PK
        uuid practitioner_id
        uuid patient_id
        string reason_code
        bytea justification_enc
        string region
        timestamptz granted_at
        timestamptz expires_at
    }
    REVIEW_CASE {
        uuid grant_id PK
        string status
        uuid reviewer_id
        string outcome
        timestamptz due_at
        timestamptz closed_at
    }
```

- `RESOURCE.content` holds the FHIR JSON; elements classified C4 (free-text notes, sensitive categories, national
  identifier) are replaced by **ciphertext encrypted with the patient key** (AES-256-GCM, additional authenticated
  data = resource ID + version, so ciphertext cannot be moved to another resource).
- FHIR search parameters are extracted into indexed tables at write time (as HAPI FHIR does) — only
  non-sensitive search parameters (codes, dates, statuses) are indexed in clear.
- Tables are **partitioned by hash of `patient_id`** from day one, preparing for sharding by patient.
- The database role of the service has `INSERT/SELECT` only on `RESOURCE_HISTORY`; a trigger rejects any update.

### ⑤ Prescription

```mermaid
erDiagram
    PRESCRIPTION ||--|{ PRESCRIPTION_VERSION : "signed versions"
    PRESCRIPTION_VERSION ||--|{ PRESCRIPTION_ITEM : contains
    PRESCRIPTION_VERSION ||--|| SIGNATURE : "signed by"
    PRESCRIPTION_VERSION ||--o{ SAFETY_CHECK : "checked by"
    PRESCRIPTION ||--|{ STATUS_HISTORY : "append-only"
    PRESCRIPTION ||--o| FULFILMENT : "tracked by"
    PRESCRIPTION {
        uuid id PK
        uuid patient_id
        uuid prescriber_id
        uuid encounter_id
        int current_version
        string status
        string verification_code UK
        date valid_until
    }
    PRESCRIPTION_VERSION {
        uuid prescription_id PK
        int version PK
        jsonb canonical_content
        int supersedes_version
        timestamptz signed_at
    }
    PRESCRIPTION_ITEM {
        uuid id PK
        string drug_code
        jsonb dosage
        int quantity
        int refills_remaining
        boolean substitution_allowed
    }
    SIGNATURE {
        uuid id PK
        string jws
        string key_id
        string algorithm
    }
    SAFETY_CHECK {
        uuid id PK
        string rule
        string severity
        string override_reason
    }
    STATUS_HISTORY {
        uuid prescription_id FK
        string status
        string reason
        uuid actor_id
        timestamptz at
    }
    FULFILMENT {
        uuid prescription_id PK
        uuid pharmacy_id
        string status
        int last_sequence
        timestamptz updated_at
    }
```

### ⑥ Pharmacy Interface

```mermaid
erDiagram
    PHARMACY ||--o{ INTEGRATION : "connected via"
    PHARMACY ||--o{ FULFILMENT_TASK : receives
    FULFILMENT_TASK ||--|{ STATUS_EVENT : "append-only"
    FULFILMENT_TASK ||--o| CONVERSATION : "discussed in"
    CONVERSATION ||--o{ MESSAGE : contains
    PHARMACY {
        uuid id PK
        string registry_number UK
        string name
        geography location
        jsonb opening_hours
        jsonb services
    }
    INTEGRATION {
        uuid id PK
        uuid pharmacy_id FK
        string mode
        string endpoint
        string credential_ref
    }
    FULFILMENT_TASK {
        uuid id PK
        uuid prescription_id
        uuid pharmacy_id FK
        string status
        int sequence
        timestamptz ack_due_at
    }
    STATUS_EVENT {
        uuid task_id FK
        string status
        int sequence
        uuid actor_id
        timestamptz at
    }
    CONVERSATION {
        uuid id PK
        uuid task_id FK
        uuid patient_id
        string state
    }
    MESSAGE {
        uuid id PK
        uuid conversation_id FK
        uuid sender_id
        bytea body_enc
        timestamptz sent_at
    }
```

### ⑦ Notification (Cassandra)

Query-driven tables: "a user's notifications, newest first" and "the status history of one notification".

```sql
CREATE TABLE notification_by_recipient (
    recipient_id    uuid,
    month           text,          -- '2026-03': bounds partition size
    created_at      timeuuid,
    notification_id uuid,
    category        text,
    priority        text,
    channel         text,
    template_id     text,
    status          text,
    PRIMARY KEY ((recipient_id, month), created_at)
) WITH CLUSTERING ORDER BY (created_at DESC)
  AND default_time_to_live = 34214400;   -- 396 days, about 13 months

CREATE TABLE notification_status_event (
    notification_id uuid,
    at              timeuuid,
    status          text,
    provider        text,
    provider_ref    text,
    PRIMARY KEY ((notification_id), at)
) WITH default_time_to_live = 34214400;
```

No message body with personal content is stored — only the template ID and the rendering variables' references.

### ⑧ Billing & Payment

```mermaid
erDiagram
    CUSTOMER ||--o{ PAYMENT_METHOD : "tokens only"
    CUSTOMER ||--o{ PAYMENT : makes
    PAYMENT ||--o{ REFUND : "may have"
    PAYMENT ||--o| INVOICE : "evidenced by"
    INVOICE ||--o{ CREDIT_NOTE : "corrected by"
    JOURNAL_ENTRY ||--|{ JOURNAL_LINE : "balanced lines"
    LEDGER_ACCOUNT ||--o{ JOURNAL_LINE : "posted to"
    CUSTOMER {
        uuid id PK
        uuid user_id UK
        string psp_customer_ref
    }
    PAYMENT_METHOD {
        uuid id PK
        uuid customer_id FK
        string psp_token
        string brand
        string last4
    }
    PAYMENT {
        uuid id PK
        uuid customer_id FK
        uuid appointment_id
        string psp_reference UK
        bigint amount_minor
        string currency
        string status
        string idempotency_key UK
    }
    REFUND {
        uuid id PK
        uuid payment_id FK
        bigint amount_minor
        string reason
        string status
        uuid approved_by
    }
    INVOICE {
        uuid id PK
        string issuer_id
        string number UK
        uuid payment_id FK
        bigint total_minor
        uuid pdf_document_id
        timestamptz issued_at
    }
    CREDIT_NOTE {
        uuid id PK
        uuid invoice_id FK
        string number UK
        bigint amount_minor
    }
    LEDGER_ACCOUNT {
        uuid id PK
        string code UK
        string type
    }
    JOURNAL_ENTRY {
        uuid id PK
        string source_event_id UK
        timestamptz posted_at
    }
    JOURNAL_LINE {
        uuid entry_id FK
        uuid account_id FK
        bigint debit_minor
        bigint credit_minor
    }
```

Invariant enforced by a deferred constraint trigger: for every `JOURNAL_ENTRY`, Σ debits = Σ credits.
`source_event_id` is unique → the same PSP event can never be posted twice.

### Audit Trail (WORM archive + index)

```json
{
  "id": "0192a4c1-8f3e-7b21-9c4d-2e5f6a7b8c9d",
  "recorded": "2026-03-02T03:12:44.182Z",
  "action": "read",
  "purposeOfUse": "ETREAT",
  "outcome": "success",
  "breakGlass": true,
  "agent": { "id": "0192…", "role": "doctor", "organization": "0192…", "aal": 3, "ip": "203.0.113.10", "device": "web" },
  "entity": { "patientId": "0192…", "resourceType": "Composition", "resourceId": "0192…" },
  "source": { "service": "emergency-access", "region": "eu-central", "traceId": "4bf92f3577b34da6a3ce929d0e0e4736" },
  "batch": { "id": "2026-03-02T03:12Z-eu-central-17", "prevHash": "9f2c…", "hash": "b71e…" }
}
```

## 3.5 Consistency model

| Data | Consistency needed | Mechanism |
|------|--------------------|-----------|
| Slot uniqueness | **Strong** | Exclusion constraint (single primary) + Redis hold |
| Clinical record writes | **Strong**, no lost update | Single primary, `If-Match` optimistic concurrency, read-your-writes routing for the author |
| Prescription legal status | **Strong** in the Prescription service; propagated to pharmacies in seconds | State machine + outbox + reconciliation every 5 min |
| Payments and ledger | **Strong**, effect exactly once | Idempotency keys, unique source event IDs, balanced entries |
| Booking + payment across services | **Eventually consistent business transaction** | Saga with compensation (release slot, void authorisation) |
| Availability cache, directory, timeline projection | Eventual (seconds) | Recomputed from events; rebuildable |
| Critical (emergency) summary | Eventual (p99 < 5 s) | Event-driven projection; the emergency view also lists changes of the last 24 h read directly from the replica |
| Notification preferences replica | Eventual (seconds) | `PreferencesUpdated` events |

## 3.6 Identifiers

- **UUIDv7** for every entity: globally unique across services and regions, time-ordered (good index locality),
  not guessable in sequence — never auto-increment integers exposed in URLs (prevents enumeration attacks).
- **Patient identity**: MedX patient ID (internal, pseudonymous) + national health identifier (INS) stored encrypted
  and used only for identity matching and national-service exchanges.
- Human-facing references (invoice numbers, prescription verification codes) are separate, purpose-specific
  identifiers.

## 3.7 Data lifecycle and retention

| Data | Retention | End of life | Basis |
|------|-----------|-------------|-------|
| Medical record (resources, documents, transcripts, prescriptions) | **20 years after the last encounter** (France; longer for minors), configurable per jurisdiction; legal hold possible | **Crypto-shredding** (patient keys destroyed) then physical deletion | Public-health law |
| Chat hot store | 30 days (transcript already archived in the record) | TTL expiry | Minimisation |
| Video/audio | **Not recorded** | — | Privacy by design |
| Appointments | 5 years after the appointment, then anonymised for statistics | Anonymisation job | Evidence of care, disputes |
| User account (patient) | While active; closed after 3 years of inactivity with prior notice | Deletion of C2 data; medical record kept under its own rule | GDPR storage limitation |
| Practitioner identity | As long as records reference the practitioner | Kept (attribution of records) | Integrity of records |
| Invoices, ledger | 10 years | Deletion | Commercial law |
| Payment tokens | Until removed by the user, or 13 months after last use | Deleted at the PSP and locally | PCI DSS, minimisation |
| Notification log | 13 months | TTL expiry | Evidence of delivery |
| Audit trail | ≥ 6 years, configurable up to record retention | Object Lock expiry then deletion | Accountability |
| Technical/security logs | 12 months | Deletion | Security investigations |
| Backups | PITR 35 days · daily snapshots 35 days · monthly snapshots 12 months | Automatic expiry (immutable until then) | Recovery |
| Key registries (wrapped patient keys) | Backups kept 35 days only | Expiry | Makes crypto-shredding effective in backups |
| De-identified analytics | Anonymous data: unlimited · pseudonymised datasets: 2 years | Deletion | Research, statistics |

**Right to erasure vs medical retention** — GDPR art. 17(3) exempts data that must be kept for healthcare or legal
obligations: a patient can close their account and delete contact data, but the medical record stays under its
legal retention (the patient is told so clearly).

## 3.8 Data integrity mechanisms

| Threat | Mechanisms |
|--------|------------|
| Concurrent edits (lost update) | Optimistic concurrency (`If-Match`/version), single primary for writes |
| Invalid or inconsistent data | FHIR profile & terminology validation, foreign keys and check constraints, state machines, exclusion constraint |
| Partial failures between services | Transactional outbox, idempotent consumers, sagas with compensation, reconciliation jobs |
| Silent tampering (insider, compromised admin) | Append-only history, per-patient hash chains, daily Merkle root signed in HSM and timestamped, WORM audit archive, verification jobs |
| Corrupted files | SHA-256 checksum at upload, at every download and in weekly scrub jobs; object versioning |
| Accidental or malicious deletion, ransomware | No delete privilege for application roles on history; Object Lock (compliance mode); **immutable, cross-account backup vault**; deletion protection on databases |
| Loss of a zone or region | Synchronous standby in another AZ (RPO 0), cross-region replicas (RPO ≤ 1 min), replicated object storage |
| Undetected backup failure | Automated restore tests every week (sample) and full restore drill every quarter, with integrity verification |

## 3.9 Backup and recovery

| Store | Backup | Restore objective |
|-------|--------|-------------------|
| PostgreSQL (all services) | Continuous WAL archiving → **PITR 35 days**; daily snapshots; monthly snapshots 12 months; copies in the immutable vault (other account, other region) | Point-in-time restore of one service without touching others |
| Cassandra | Daily snapshots + incremental backups to object storage | Chat is rebuildable from record transcripts; notification log is non-critical |
| Object storage | Versioning + Object Lock + cross-region replication + vault copy | Object or version restore; region failover |
| Kafka | Not backed up as a store (events are also in databases); MirrorMaker to DR for continuity | Replay from outboxes if needed |
| Redis / OpenSearch | Not backed up (derived data) — rebuilt from systems of record | Rebuild jobs (minutes to hours) |
| Keys (KMS/HSM) | Provider-managed, multi-region keys; Vault DR replication | — |

## 3.10 Data residency and replication

- All health data is stored and processed in the **EEA**, in HDS-certified regions (primary France, DR Germany).
- Cross-region replication is encrypted in transit and re-encrypted at rest with multi-region keys.
- Expansion to another jurisdiction (e.g., the US) is done with a **separate regional cell**: a full copy of the
  platform with its own data, keys and compliance scope (HIPAA); only non-personal configuration is shared
  globally. Patient data never flows between cells except at the patient's request.
