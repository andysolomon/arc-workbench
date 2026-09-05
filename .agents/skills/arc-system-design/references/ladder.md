# Example Ladders — rung sequences to adapt

These are **templates**, not prescriptions. Adapt rungs to the user's chosen
systems, stack, and scope decisions; record the agreed ladder in the project's
`docs/progress.md`. The invariants: one concept per rung, and a rung is done
only when the code runs, was exercised with real requests, reviewed, and its
lesson extracted.

---

## Ladder 1 — CRUD app (e.g. todo/notes app) — the warm-up

| Rung | Build | Concept taught |
|------|-------|----------------|
| 0 | Scaffold (package manager, runner, web framework) | tooling |
| 1 | `GET /health` | request→response cycle; LB health checks; JSON responses set Content-Type |
| 2 | In-memory CRUD (5 routes) | REST resource modeling; verbs; 201/204/404; PUT-replaces vs PATCH-merges; per-process state breaks statelessness (deliberate flaw motivating the DB) |
| 3 | Swap memory → real database (containerized), schema file, connection pool, parameterized queries | persistence; the DB as shared source of truth (statelessness payoff); pooling; SQL-injection defense; snake_case↔camelCase mapping |
| 4 | User accounts: register + login with salted password hashing (bcrypt/argon2) | authN; never store plaintext; hashing cost factor |
| 5 | Token/session auth middleware + scope every query by owner | authZ; stateless auth across N servers; privacy enforced in the query |
| 6 | Validation + error-handling middleware; consistent error shape | robustness; 4xx vs 5xx; never leak internals |
| 7 | Search/filter query params + the indexes that serve them; EXPLAIN | query design; index selection |
| 8 | Scale-out lab: run 2 app instances behind a real load balancer (e.g. nginx in Docker); discuss read replicas, caching vs read-your-writes, when (not yet) to shard | horizontal scaling made literal — the diagram becomes real |

## Ladder 2 — Social feed (e.g. Twitter-style) — the fan-out problem

| Rung | Build | Concept taught |
|------|-------|----------------|
| 0 | Design doc + diagram: capacity math (read-heavy ~100:1), AP stance, fan-out trade-off named as centerpiece | the fan-out problem; AP vs the CRUD app's CP |
| 1 | Schema: users, follows, posts; seed-data generator | graph-ish data modeling at scale |
| 2 | Create post + author timeline | write path; cursor pagination (not offset) |
| 3 | Follow/unfollow | many-to-many at scale |
| 4 | Home timeline via fan-out **on read** (pull); measure latency with realistic follow counts | feel the N-way merge cost before fixing it |
| 5 | Cache precomputed timelines (e.g. Redis) + fan-out **on write** via a queue/worker | caching; async decoupling; eventual consistency |
| 6 | Hybrid: pull for high-follower accounts | the "best answer" trade-off, with numbers |
| 7 | Rate limiting (token bucket) | abuse prevention |
| 8 | Optional: SSE/WebSocket live timeline | push protocols |

## Ladder 3 — Media streaming (e.g. video service) — pipelines and CDNs

| Rung | Build | Concept taught |
|------|-------|----------------|
| 0 | Design doc + diagram: upload path vs playback path; AP; precompute-vs-on-demand transcode trade-off | separation of metadata from bytes |
| 1 | Catalog metadata service + search | metadata layer, heavy caching |
| 2 | Blob storage for media files (filesystem or MinIO); metadata in DB, bytes in blobs | the separation principle in code |
| 3 | Transcoding pipeline: queue + worker pool producing renditions (480p/720p/1080p) | async batch pipelines, decoupled from playback |
| 4 | HLS-style manifest endpoint + chunk serving with HTTP Range | adaptive streaming mechanics; why HTTP/CDN-friendly |
| 5 | Watch progress endpoint — write-heavy, buffered/eventually consistent | write-heavy store; eventual consistency by design |
| 6 | Signed/expiring URLs for chunks | abuse prevention; CDN auth model |
| 7 | Scale talk-through: CDN/edge placement for every box | the CDN as hero |
