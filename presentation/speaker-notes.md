# MedX — Presentation Script & Speaker Notes

> Brief presentation (≈ 15–18 minutes + questions). One section per slide; the same text is embedded as speaker
> notes in `MedX-Technical-Solution.pptx`. Slides 19–23 (appendix A1–A5) are backup material for questions.

## Slide 1 — Opening (30 s)

Good morning. We were asked to design the technical solution for MedX: a platform for teleconsultations, patient records and prescription tracking.
In the next 15 minutes I will show the architecture, how each component works, how data is stored, how the platform scales, and how it protects health data.
One idea guides every choice: MedX's own priorities. Data protection and emergency access come first; everything else is built on top of them.

## Slide 2 — Design drivers (1 min)

MedX has three pillars: teleconsultation, a lifelong patient record, and prescription tracking up to the pharmacy.
The brief ranks requirements. The five HIGH priorities — encryption, records, emergency access, authentication and integrity — are not features we add at the end: they are the foundations and the non-negotiable principles of the architecture.
The MEDIUM priorities are the care workflows built on that foundation, and the LOW priorities are fully designed now but delivered last, mostly with partners such as a payment provider.

## Slide 3 — Targets and principles (1 min)

We sized the platform for year 3: 10 million patients, 200 thousand teleconsultations a day, up to 10 thousand simultaneous video calls — and we keep a 2x headroom on top of that.
Two numbers matter most because they come from the HIGH priorities: emergency access must be available 99.99% of the time and return the critical summary in under 300 milliseconds.
The eight principles below turn the priorities into rules every team follows — for example "integrity first": clinical history is never overwritten.

## Slide 4 — Architecture at a glance (2 min) — the key slide

Read it from left to right. Users reach MedX only through the edge: CDN and firewall, the API gateway, a real-time gateway for chat and live statuses, and the media plane for video.
Behind it, the eight components of the brief are microservices grouped in security zones. The identity zone decides who you are and what you may do. The clinical zone holds all health data and has the strictest controls. Notification never stores health data, and billing sits in its own payment zone.
Services talk through a Kafka event bus; shared platform services provide audit, secure documents and key management; each service owns its database.
Emergency access — in red — is deployed separately so nothing else can slow it down.

## Slide 5 — How the pieces work together (1.5 min)

Here is one care journey. The patient books: Scheduling holds the slot for 10 minutes, a database constraint makes double booking impossible, and Billing pre-authorises the fee.
They meet by video in the Consultation service; the doctor documents in the Records service, then signs a prescription, which the pharmacy receives within seconds; finally the payment is captured.
Below, the event bus: each step publishes an event. Three rules keep this robust: synchronous calls only when a user is waiting, events never carry clinical content, and the outbox pattern guarantees we never lose or invent an event.

## Slide 6 — HIGH priority H4 — authentication and authorization (1.5 min)

We do not build authentication ourselves: Keycloak, a proven identity provider, handles OpenID Connect, MFA and passkeys, with three separate realms. Patients get a smooth experience; professionals always use phishing-resistant MFA and must re-authenticate before signing a prescription or breaking the glass; MedX staff never see health data.
Authorization is two layers: roles for the coarse rules, and attribute-based policies for the fine ones — is this doctor treating this patient, for which purpose, with which consent. OPA evaluates them next to every service in under a millisecond, and returns masking obligations with the decision.

## Slide 7 — HIGH priorities H2 and H5 — patient records (1.5 min)

Records are stored in HL7 FHIR, the healthcare standard, so validation, versioning and future integration with national services come for free.
Every request goes through the same seven-step chain on the left, so no endpoint can forget a control.
Integrity is provable: history is append-only, each version is chained by a hash, and every night the chain heads are signed in a hardware security module and stored in write-once storage — even an administrator cannot rewrite history unnoticed.
Access is explicit: the patient, a proxy, a treating doctor with a time-limited care grant, a doctor the patient shared with, or break-glass. Pharmacists and MedX staff have no access to the record.

## Slide 8 — HIGH priority H3 — emergency access (2 min)

In an emergency, minutes matter, so access is never blocked by a workflow: it is narrow, time-boxed and answered for afterwards.
The clinician identifies the patient by exact match only, declares the emergency with a reason, re-authenticates with a passkey or smart card, and immediately gets a four-hour read-only grant. The International Patient Summary — allergies, problems, medications, blood group, directives — comes back in under 300 milliseconds.
Accountability: the audit record is written in the same transaction, the privacy office is alerted in real time, the patient is informed within 24 hours, and every case is reviewed within 72 hours.
And it survives failures: separate deployment, pre-computed summaries on replicas, active in two regions.

## Slide 9 — HIGH priorities H1 and H5 — encryption and integrity (1.5 min)

In transit, there is no plaintext hop: TLS 1.3 at the edge, mutual TLS between services, verified TLS to every database, and end-to-end encryption for video. Because health data must stay secret for decades, we enable hybrid post-quantum key exchange where supported.
At rest we have two independent layers: storage encryption everywhere, plus application-level encryption with one key per patient, wrapped by keys that never leave hardware security modules. A stolen backup is useless, and destroying a patient's keys at the end of retention makes every copy unreadable.
Integrity is enforced by constraints and append-only history, and proven by hash chains, checksums and immutable backups that we restore every week.

## Slide 10 — MEDIUM priorities — the care workflows (1.5 min)

Scheduling: a short hold plus a database constraint make double booking impossible; waitlists and an urgent queue serve priority cases, and red-flag symptoms redirect to emergency services. External calendars are read as free/busy only — no patient data ever leaves MedX.
Consultation: a self-hosted WebRTC media server in the EU, with adaptive quality, audio-only fallback and end-to-end encryption for one-to-one calls; chat and file sharing are persisted securely.
Prescription: safety checks against the patient's allergies at signing, a signature in a hardware module, and a revocation that reaches the pharmacy as a critical alert. Masking guarantees pharmacists see only what dispensing requires.

## Slide 11 — LOW priorities — designed now, delivered last (1 min)

These services complete the platform. The pharmacy interface offers a web portal to every pharmacy on day one and an API with signed webhooks for integrated systems.
Notifications have priority lanes so a revocation alert is never stuck behind reminders, and they never contain health data.
Billing uses the payment provider's hosted fields, so card numbers never touch MedX, which keeps us in the lightest PCI scope.
And non-production environments only ever see synthetic or anonymised data.

## Slide 12 — Data model and storage (1.5 min)

Each service owns its database. PostgreSQL is our default because transactions and constraints protect integrity — for example the exclusion constraint that forbids double booking, or the balanced double-entry ledger.
We add a specialised store only when PostgreSQL is a poor fit: Cassandra for append-heavy logs with expiry, object storage for 150 terabytes of documents with write-once retention, Redis and OpenSearch for derived data that can always be rebuilt.
Clinical data is modelled in FHIR and kept 20 years; at the end, crypto-shredding makes it unrecoverable.

## Slide 13 — Scalability and performance (1.5 min)

At year 3 we expect about 5 thousand requests per second at peak, and we design for 10 thousand; 10 thousand simultaneous calls means about 24 gigabits per second through roughly 100 media servers.
The levers: stateless services autoscaled on their real bottleneck, pre-computed availability and summaries, Kafka to absorb peaks, and a clear database path — replicas, partitions, then sharding by patient, and finally regional cells.
The latency budget of the emergency path shows the design leaves a wide margin: about 40 to 70 milliseconds typical against a 300 millisecond objective. Everything is load-tested at twice the forecast peak before each major release.

## Slide 14 — Resilience and disaster recovery (1.5 min)

Services are grouped in three criticality tiers. Tier 0 — emergency access and sign-in — targets 99.99% and keeps working even if the whole primary region is lost, because it is active in both regions.
Inside a region, every tier is replicated across three availability zones with a synchronous database standby, so losing a zone loses no data. Across regions, a warm standby receives asynchronous replication with less than a minute of potential loss; care services are back within an hour.
Under extreme load we shed in a fixed order: emergency access and ongoing consultations are protected first; analytics are sacrificed first.

## Slide 15 — Security and compliance (1.5 min)

Health data puts MedX under GDPR article 9: we need a DPIA before launch, a DPO, and 72-hour breach notification. In France, hosting requires HDS certification, so we only use HDS-certified regions in the European Economic Area. Telemedicine rules, NIS2, eIDAS for signatures, PCI DSS for payments and the European Health Data Space are covered by design, and a separate US cell would make MedX HIPAA-ready.
Privacy by design is visible in concrete rules: no health data in SMS, e-mails, calendars or logs; production data never leaves production; records are crypto-shredded at the end of retention; and patients can see who accessed their record.

## Slide 16 — Key decisions and trade-offs (1.5 min)

Every decision has a cost, and we chose the cost that MedX's priorities make acceptable.
Microservices in security zones cost operational complexity, but isolate health data and the emergency path. Break-glass without pre-approval accepts that misuse is possible — it is detected, reviewed and sanctioned — because a pre-approval would be too slow at 3 am in an emergency room. Per-patient encryption adds key management; append-only history costs about 30% more storage; a self-hosted video server means operating media infrastructure and no recording; and we keep full active-active only for Tier 0 to control cost.

## Slide 17 — Roadmap (1 min)

We deliver in the order of MedX's priorities. Phase 0 builds the platform foundations. Phase 1 delivers the secure clinical core — identity, records, integrity, emergency access and the DR region — and ends with a security gate: DPIA, penetration test and DR drill.
Phase 2 adds the care workflows and ends with a pilot with partner clinics. Phase 3 brings pharmacies, notifications tracking, billing and anonymisation, then the public launch. Each phase has measured exit criteria, not declared ones.

## Slide 18 — Conclusion (30 s)

To summarise: security is the foundation — health data is encrypted twice, every access is authorised and audited, and history cannot be rewritten. Emergency access works in seconds, even during a regional outage, and remains accountable. And the platform scales by design, from launch to ten times the load, through events, autoscaling, sharding and regional cells.
All the details — component designs, data models, capacity math, security controls and decision records — are in the repository. Thank you; I'm happy to take your questions.

## Slide 19 — Detailed container view with every component, zone, platform service, datastore and external system. Use it to answer detailed questions; zoom in PowerPoint (the image is high resolution)

Detailed container view with every component, zone, platform service, datastore and external system. Use it to answer detailed questions; zoom in PowerPoint (the image is high resolution).

## Slide 20 — Who uses MedX and which external systems it depends on

Who uses MedX and which external systems it depends on.

## Slide 21 — Primary region with three availability zones, warm-standby DR region, node pools per security zone, and one cloud account per environment

Primary region with three availability zones, warm-standby DR region, node pools per security zone, and one cloud account per environment.

## Slide 22 — Five steps, guardrails and resilience mechanisms of the break-glass capability

Five steps, guardrails and resilience mechanisms of the break-glass capability.

## Slide 23 — Every encrypted channel and the envelope-encryption key hierarchy

Every encrypted channel and the envelope-encryption key hierarchy.
