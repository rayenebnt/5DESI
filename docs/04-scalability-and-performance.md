# 4. Scalability & Performance

> **Deliverable 4.** How MedX handles a growing user base and keeps its performance — with numbers.
> Targets come from [§0.7 capacity targets](00-context-and-assumptions.md#07-capacity-targets) and
> [§0.8 service levels](00-context-and-assumptions.md#08-service-levels-and-criticality-tiers).

## 4.1 Strategy in one page

| Lever | What MedX does |
|-------|----------------|
| **Scale out, not up** | Stateless services on Kubernetes, autoscaled on the metric that really limits each one (requests, connections, queue lag, participants). |
| **Separate what scales differently** | Media plane, records, notifications and payments have independent scaling and failure domains. |
| **Keep the hot path short** | Local token validation and policy decisions, pre-computed availability and emergency summaries, at most two synchronous hops. |
| **Absorb peaks asynchronously** | Kafka and priority lanes turn spikes into backlogs that drain in seconds, never into errors. |
| **Protect what matters most** | Bulkheads and load-shedding order: emergency access → ongoing consultations → clinical writes → booking → the rest. |
| **Grow in steps with explicit triggers** | Replicas → partitioning → sharding by patient → regional cells; each step triggered by measured thresholds. |
| **Prove it continuously** | Load, soak, chaos and WebRTC tests at 2× the forecast peak before each major release; SLOs with error budgets. |

## 4.2 Workload model

| Pattern | Description | Design response |
|---------|-------------|-----------------|
| Daily cycle | Peaks Monday 8–10 am and 6–8 pm; nights ≈ 5 % of peak | Scheduled pre-scaling + autoscaling; batch jobs at night |
| Seasonal surges | Flu season, epidemics: **×3 to ×5** demand in days | Surge playbook (§4.10), headroom ×2 by design, DR region can absorb read traffic |
| Reminder bursts | Thousands of reminders due at round hours | Jittered sending window, dedicated notification lane |
| Read-heavy clinical data | Records read ≈ 5–10× more than written | Replicas, projections, patient-scoped queries |
| Long-lived connections | WebSocket for chat/status, WebRTC for media | Dedicated gateways and media nodes scaled on connections/participants |

## 4.3 Capacity estimates (Year 3)

| Quantity | Estimate | Result | Design capacity |
|----------|----------|--------|-----------------|
| API throughput | ~75 M calls/day ÷ 86 400 s × peak factor 5 | **≈ 4.3 k req/s** | 10 k req/s |
| Concurrent video sessions | 200 k consultations/day × 12 % in peak hour × 20 min | **≈ 8 k** | 10 k (autoscale to 20 k) |
| SFU egress bandwidth | 20 k participants × ~1.2 Mbit/s received | **≈ 24 Gbit/s** | 48 Gbit/s |
| Media nodes (8 vCPU) | 20 k participants ÷ ~200 per node | **≈ 100 nodes** | up to 200 |
| WebSocket connections | 1 M daily users × ~20 % connected at peak | **≈ 200 k** | 400 k |
| Records reads | ~10 M/day, peak factor 5 | **≈ 600 req/s** | 2 k req/s |
| Records writes | 200 k consultations × ~10 resources, over working hours | **≈ 55/s, peaks ≈ 110/s** | 500/s |
| Domain events | ~50 M/day | **≈ 600/s avg, 3 k/s peak** | trivial for a 3-broker Kafka cluster |
| Audit events | 20 M/day | **≈ 230/s avg, 1.2 k/s peak** | batched writes to WORM storage |
| Notifications | 2 M/day | **≈ 25/s avg, 500/s at reminder peaks** | 2 k/s (provider limits) |
| Document storage | ~1 MB/consultation + patient uploads | **≈ 75 TB/year** at Year-3 run-rate, 150 TB cumulative | object storage (no practical limit) |
| Structured clinical data | ~50 KB/consultation incl. history & indexes | **≈ 4 TB/year**, 10 TB at Year 3 | single primary + replicas; sharding path ready |

## 4.4 Performance objectives and latency budgets

SLOs are defined per criticality tier in [§0.8](00-context-and-assumptions.md#08-service-levels-and-criticality-tiers).
Each critical request has a **latency budget** that the design must respect:

**Emergency critical summary (target p95 < 300 ms server-side)**

| Step | Budget |
|------|--------|
| Gateway: JWT signature (cached JWKS), DPoP check, rate limit | ≤ 5 ms |
| mTLS hop to the Emergency Access pod | ≤ 2 ms |
| OPA decision (sidecar, in memory) | ≤ 1 ms |
| Insert grant + audit outbox (synchronous Multi-AZ commit) | ≤ 15 ms |
| Read pre-computed summary (one indexed row, local replica) | ≤ 10 ms |
| Unwrap patient key (in-memory cache; KMS on a miss) | ≤ 1 ms (≤ 30 ms on miss) |
| Decrypt, apply obligations, serialise | ≤ 5 ms |
| **Typical total** | **≈ 40–70 ms**, leaving a wide margin under 300 ms |

**Booking confirmation (target p95 < 800 ms excluding 3-D Secure)** — hold ≤ 20 ms (Redis + insert), payment
authorisation 300–600 ms (PSP, the dominant term), commit + outbox ≤ 20 ms.

**Chat message (target p95 < 500 ms)** — gateway ≤ 5 ms, authorisation + encryption ≤ 3 ms, Cassandra write
(`LOCAL_QUORUM`) ≤ 10 ms, pub/sub fan-out ≤ 5 ms; the rest is network.

## 4.5 Scaling by layer and by service

| Layer | Mechanism |
|-------|-----------|
| Edge | CDN offloads static assets; managed WAF/load balancers scale automatically; gateway pods autoscaled on RPS and CPU. |
| Services | Kubernetes Horizontal Pod Autoscaler on CPU and custom metrics (RPS, p95 latency, Kafka lag via KEDA); cluster autoscaler adds nodes; pod anti-affinity spreads replicas across 3 AZs; minimum 3 replicas for Tier 0/1. |
| Data | Vertical sizing + read replicas + connection pooling (PgBouncer) + partitioning; sharding path for Records (§4.7). |
| Events | Topics partitioned by aggregate key (12–48 partitions); consumer groups scale up to the partition count. |
| Real-time | WebSocket pods scaled on open connections; Redis pub/sub cluster for fan-out. |
| Media | SFU nodes scaled on participants and egress bandwidth; region-aware placement; drain before scale-in. |

| Service | Load driver | Autoscaling signal | Replicas (Year 3, min–max) | Main bottleneck → mitigation |
|---------|-------------|--------------------|----------------------------|------------------------------|
| API Gateway | Requests | RPS, CPU | 6 – 40 | — |
| Real-time Gateway | Connections | Connections per pod (~25 k) | 4 – 20 | Memory per connection → lean frames, heartbeats |
| ① User Management + IdP | Logins, refreshes | CPU | 3 – 12 | Password hashing CPU → rate limits, passkeys |
| ② Scheduling | Searches, bookings | RPS | 3 – 30 | Availability computation → pre-computed Redis cache |
| ③ Consultation (control plane) | Joins, chat | RPS, WebSocket messages | 3 – 20 | — |
| Media plane (SFU + TURN) | Participants | Participants per node, bandwidth | 10 – 200 nodes | Bandwidth → simulcast, adaptive stream, audio-only |
| ④ Patient Records | Reads | RPS, p95 latency | 4 – 30 | Database → replicas, projections, sharding path |
| Emergency Access | Break-glass requests | **Reserved capacity** + RPS | 3 per region (fixed floor) – 12 | Isolated by design (bulkhead) |
| ⑤ Prescription | Writes, checks | RPS | 3 – 12 | Drug checks → cached reference data |
| ⑥ Pharmacy Interface | Webhooks, status updates | Queue lag | 2 – 12 | Slow pharmacy systems → asynchronous webhooks |
| ⑦ Notification | Events | Consumer lag per priority lane | 2 – 40 | Provider rate limits → two providers per channel |
| ⑧ Billing & Payment | Payments | RPS | 3 – 8 | PSP latency → asynchronous capture |
| Audit Trail | Audit events | Consumer lag | 2 – 10 | Object-storage writes → 1-minute batches |

## 4.6 Caching strategy

| Cache | Content | Location | Freshness | Health data? |
|-------|---------|----------|-----------|--------------|
| CDN | App bundles, images | Edge | Versioned, immutable | No |
| Keys & policies | JWKS, OPA bundles | In-process | 5 min / pulled every 60 s | No |
| Availability | Free slots per doctor and day (60 days) | Redis | Recomputed on events (seconds) | No patient data |
| Directory | Doctor public profiles + next free slot | OpenSearch | Event-driven | No (public) |
| Drug reference | Drug catalogue, interactions | In-process + OpenSearch | Daily refresh | No |
| Emergency summary | International Patient Summary per patient | PostgreSQL projection + replicas | Event-driven (p99 < 5 s) | **Yes — encrypted** |
| Data keys | Unwrapped patient/file keys | Service memory only | ≤ 5 min, bounded LRU | Key material, never persisted |
| Inventory | Availability level per pharmacy and item | Redis | 15 min | No |

**Rules** — no health data in shared caches (the encrypted emergency summary is the only exception); responses with
personal data carry `Cache-Control: no-store`; caches use jittered TTLs and request coalescing to avoid stampedes;
every cache is rebuildable from its system of record.

## 4.7 Database scaling path

| Stage | Trigger (measured) | Action |
|-------|--------------------|--------|
| **1 — Launch** | — | One Multi-AZ primary (synchronous standby) per service; Records with 2 read replicas; PgBouncer; `statement_timeout` and connection quotas per service |
| **2 — Growth** | Records > 2 TB, replica lag > 1 s, or primary CPU > 60 % at peak | Larger instances, more replicas, partition pruning, older history partitions moved to a cheaper storage tier |
| **3 — Scale-out** | Records writes > ~5 k/s or > 20 TB | **Shard by `patient_id` hash** (e.g., Citus or application-level routing); each shard with its own replicas — nearly every query is patient-scoped, so shards are independent |
| **4 — New jurisdiction** | New country or regulation | New **regional cell** (§4.12) |

Query hygiene is part of the definition of done: indexes reviewed with `EXPLAIN` in CI for new queries,
`pg_stat_statements` dashboards, keyset pagination (no deep `OFFSET`), no N+1 access patterns.

## 4.8 Video at scale

- **One room per SFU node** for 1-to-1 consultations (no cross-node forwarding); multi-party rooms (interpreter)
  can cascade across nodes.
- **Placement** chooses the region with the lowest measured RTT for both participants, then the least-loaded node
  (CPU, bandwidth, participants).
- **Simulcast + dynacast + adaptive stream** send each receiver only the resolution its screen and network need;
  average received bitrate ~1.2 Mbit/s instead of 2.5 Mbit/s for full 720p.
- **Audio-first**: under congestion video degrades first; below ~150 kbit/s the call becomes audio-only.
- **TURN** fleet sized for ~20 % of sessions relayed; TURN over TLS 443 for restrictive networks.
- **Scale-in by draining**: a node marked for removal accepts no new rooms and is removed when its last call ends.
- **Load testing**: headless-browser bots generate thousands of simultaneous calls with injected packet loss and
  jitter; the node capacity figure (~200 participants per 8 vCPU) is re-measured at every SFU upgrade.
- **Cost lever to evaluate**: direct peer-to-peer media for 1-to-1 calls when networks allow would cut SFU egress,
  at the price of weaker quality monitoring and control — kept as an optimisation, not the baseline.

## 4.9 High availability and disaster recovery

| Component | Within the region (AZ failure) | Across regions (region failure) |
|-----------|-------------------------------|---------------------------------|
| Gateways, services | ≥ 3 replicas over 3 AZs; load balancer health checks | Pre-deployed in DR, scaled up by the runbook |
| Emergency Access, IdP | ≥ 3 replicas over 3 AZs | **Active in both regions** (DNS health-checked routing) |
| PostgreSQL | Synchronous standby in another AZ, automatic failover < 60 s (RPO 0) | Asynchronous cross-region replica (lag < 1 s, RPO ≤ 1 min), promoted by the runbook |
| Redis | Replicas in other AZs, automatic failover | Rebuilt (derived data) |
| Kafka | 3 brokers / 3 AZs, RF 3, `min.insync.replicas = 2` | MirrorMaker 2 to the DR cluster |
| Cassandra | RF 3 across AZs, `LOCAL_QUORUM` | Second datacenter in DR (asynchronous) |
| Object storage | Regional service (multi-AZ by design) | Cross-region replication |
| Media plane | Nodes in 3 AZs, clients reconnect | Media nodes in DR scale up |

**Regional failover runbook** (rehearsed twice a year):

1. Detection by synthetic probes and health checks → incident declared, communication started.
2. Tier 0 continues immediately: emergency access and sign-in are already served by the DR region.
3. Promote DR database replicas for Tier 1 services (scripted, in dependency order), switch producers to the DR
   Kafka cluster (translated consumer offsets).
4. Scale DR Kubernetes node groups to production size (pre-approved capacity reservations) → **Tier 1 back ≤ 1 h**.
5. Restore Tier 2 services and rebuild derived stores (caches, search) → **Tier 2 back ≤ 4 h**.
6. Fail back after recovery with reverse replication, outside peak hours.

## 4.10 Resilience patterns and graceful degradation

- **Timeouts everywhere** (no call without a deadline), **retries with exponential backoff and jitter** only for
  idempotent operations, **circuit breakers** in the mesh, **bulkheads** (separate pools and deployments for the
  emergency path and each priority lane), **idempotency keys** on every create.
- **Load-shedding order** under extreme load, enforced by gateway route priorities, Kubernetes priority classes and
  queue lanes: ① emergency access → ② ongoing consultations → ③ clinical writes (notes, prescriptions) → ④ booking
  → ⑤ non-critical notifications → ⑥ analytics and exports.

| Failure | Degraded behaviour |
|---------|--------------------|
| Payment provider down | Holds keep slots; retry; optional "pay later" booking for returning patients |
| Calendar provider down | Last known busy times used; doctor warned that sync is delayed |
| SMS / e-mail provider down | Automatic failover to the second provider; in-app notifications continue |
| Drug database down | Prescribing possible only after explicit acknowledgement that checks are unavailable |
| Event bus unavailable | Core transactions continue; events wait in outboxes; notifications and projections catch up |
| Records primary database down | Automatic failover (< 60 s); reads continue on replicas; emergency access unaffected |
| Media node failure | Clients reconnect to another node within seconds |
| Search cluster down | Fallback search by specialty served from PostgreSQL |
| Whole region down | Tier 0 continues in DR; Tier 1 ≤ 1 h; Tier 2 ≤ 4 h |

**Surge playbook** (epidemic, ×3–×5 demand): scheduled pre-scaling; "surge mode" raising autoscaling floors;
additional on-call doctors in the urgent queue; feature flags that switch off non-essential features (exports,
recommendations); a **virtual waiting room** in front of booking if needed, so the platform stays responsive for
people already in care.

## 4.11 Performance engineering practice

| Practice | Cadence |
|----------|---------|
| Performance budgets checked in CI (key endpoints, p95) | Every merge |
| Load tests at 1× and **2× forecast peak** (k6 / Gatling), including WebRTC bots with network impairment | Every major release |
| Soak tests (24 h) for leaks and slow degradation | Monthly |
| Chaos experiments (pod kill, AZ loss, latency injection, dependency outage) | Monthly in staging, quarterly game days in production |
| DR failover drill | Twice a year |
| Capacity review vs forecast (users, bandwidth, storage) | Monthly |
| SLO review with **error budgets** — feature work pauses for reliability when a budget is burnt | Weekly |

## 4.12 Growth beyond Year 3 — cells

When MedX outgrows one region or enters a new jurisdiction, it scales by **cells**: a cell is a complete, isolated
copy of the platform (services, data, keys) serving a population (a country, or a shard of patients). A thin global
routing layer — holding **no health data** — sends each user to their home cell. Cells limit the blast radius of any
incident, keep data residency simple (a US cell under HIPAA, EU cells under GDPR/HDS) and turn growth into a
repeatable deployment rather than a redesign.

## 4.13 Cost efficiency

- Autoscaling floors lowered at night; non-production environments scaled to zero outside working hours.
- Reserved capacity for the steady baseline; spot/preemptible capacity only for stateless, non-critical workloads
  (never Tier 0, never media).
- Storage lifecycle: documents older than 1 year move to an infrequent-access tier, older than 5 years to an archive
  tier — with Object Lock retention preserved.
- Media bandwidth is the largest variable cost: simulcast, audio-only fallback and tuned bitrates are both quality
  and cost measures; **cost per consultation** is tracked as a KPI.
