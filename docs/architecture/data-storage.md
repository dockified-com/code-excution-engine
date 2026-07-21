# Data storage — when this service needs DB / cache

**Status:** Approved for Phase 1  
**Date:** 2026-07-21  
**Service:** Nest judge gateway + private Piston  

Related:

- Architecture overview: [code-execution-platform.md](./code-execution-platform.md)
- Clear plan (phases): [../superpowers/plans/2026-07-19-code-execution-clear-plan.md](../superpowers/plans/2026-07-19-code-execution-clear-plan.md)
- Client integration: [../runbooks/client-integration.md](../runbooks/client-integration.md)
- Ship checklist: [../runbooks/SHIP-FAST.md](../runbooks/SHIP-FAST.md)

---

## Decision (Phase 1 / MVP)

**No database. No Redis. No result cache.**

Execute and judge are **stateless**:

```text
Product backend  --Bearer key-->  Nest  -->  Piston  -->  Nest grades  -->  response
                                      │
                                      └── env config only (API_KEYS, limits)
```

| Layer | Storage required for run/judge? |
|-------|----------------------------------|
| Nest judge gateway | **No** |
| Piston sandbox | **No** product DB |
| Product backends (Tutor / Lab / LMS) | **Yes** — student identity, attempts, curriculum (their systems) |

If a call does not need to remember prior requests to return a correct grade, do not add storage.

---

## Mental model — who owns what data

```text
Tutor / Lab / LMS backends
  ├── student identity & sessions
  ├── attempt / grade history
  └── lab definitions & curriculum     ← stay in product DBs

This Nest service (code execution platform)
  ├── sandbox + judge (stateless)      ← core job today
  ├── API keys from env API_KEYS       ← Phase 1
  ├── (later) platform API keys in DB  ← Phase 2
  ├── (later) rate limits / queues     ← Phase 2–3
  └── never stores student code by default for grading history
```

Students never get platform API keys. This service does not replace product LMS storage.

---

## Capability matrix

| Concern | Database? | Cache / Redis? | Phase |
|---------|-----------|----------------|-------|
| `POST /v1/execute` run + judge | No | No | **1 (now)** |
| `GET /v1/runtimes` | No | Optional in-memory TTL | **1** |
| API keys as env list (`API_KEYS`) | No | No | **1** |
| Hashed keys, rotate, enable/disable | **Yes** (keys table) | Optional | **2** |
| Per-client quotas / daily caps | **Yes** (or Redis counters) | Often Redis if multi-instance | **2** |
| Stored labs (`labId` + server harness) | **Yes** | Optional | **2** (prefer product DB first) |
| Shared rate limits across Nest replicas | No | **Yes** (Redis) | **2–3** |
| Async submit → poll job status | **Yes** (jobs/submissions) | **Yes** (queue, often Redis) | **3** |
| Cache full execute/grade results | Usually no | **Avoid by default** | — |
| Student progress / transcripts | Product DB only | Product concern | — |

---

## Why no DB for computing interaction (now)

1. **Correctness is per request** — grade from current code + tests in the payload; no prior state required.  
2. **Piston is ephemeral** — sandbox runs; it is not a grade store.  
3. **YAGNI** — DB adds ops, migrations, backups, and failure modes before clients are live.  
4. **Secrets for MVP** — comma-separated keys in env/secrets manager is enough for a few product backends.  
5. **History belongs to products** — Tutor/Lab should persist attempts if the product needs them.

---

## When to introduce a database

Add a **database first** when any of these become true:

| Trigger | What to store |
|---------|----------------|
| Many clients / key rotation | `keyId`, `keyHash`, `clientId`, `name`, `enabled`, limits |
| Enforce per-client quotas | Usage counters + key metadata |
| Central stored labs on this platform | Lab definitions, harness, hidden tests (only if you deliberately own labs here) |
| Async judging | Submission/job rows and final verdict |

**First useful DB use case for this service:** platform API key management (hashed keys), not student code history.

Suggested later shape (not implemented):

```text
api_keys
  key_id, key_hash, client_id, name, enabled, daily_cap, created_at, revoked_at
```

Auth compares `hash(Bearer token)` to `key_hash`. Plaintext key is shown **once** at generation time.

---

## When to introduce cache / Redis

| Use case | Recommendation |
|----------|----------------|
| Cache `GET /v1/runtimes` | Optional; tiny list; **in-process memory** is enough |
| Cache execute results by code hash | **Do not** for MVP — risk of wrong grades, invalidation pain |
| Rate limit across multiple Nest instances | **Redis** (shared counters) |
| Job queue for async judge | **Redis** (or equivalent) + workers |
| Session store for students | **Not this service** — product backends |

Redis is for **coordination and scale**, not for “making judge faster” in Phase 1.

---

## Phase map (storage only)

### Phase 1 — Ship (current)

```text
Config:  env (.env / secrets manager)
Data:    none
Cache:   none
```

- `API_KEYS=dev-key-tutor,dev-key-lab`
- Limits: `MAX_RUN_TIMEOUT_MS`, `MAX_FILES`, `MAX_TESTS`, …

### Phase 2 — Platform

```text
Config:  env + DB connection
Data:    hashed API keys (+ optional quotas / stored labs)
Cache:   Redis only if multi-instance rate limits or shared counters
```

### Phase 3 — Scale

```text
Config:  env + DB + queue broker
Data:    submissions / job status
Cache/queue: Redis (or similar) for workers + rate limits
```

Async shape (later):

```text
POST /v1/submissions  →  { submissionId }
GET  /v1/submissions/:id  →  verdict when ready
```

Keep **sync** `POST /v1/execute` for interactive “Run” unless scale forces async.

---

## Explicit non-goals for storage

Do **not** add the following without a concrete product need:

- Database “because every Nest app has one”
- Redis “for cache” with no multi-instance or queue requirement
- Storing every student submission in this service by default
- Caching grades in front of Nest
- Putting API keys or student PII in Piston volumes beyond engine needs

---

## Operational checklist

| Question | Phase 1 answer |
|----------|----------------|
| Do we need Postgres/MySQL to run execute? | **No** |
| Do we need Redis to run execute? | **No** |
| Where do client keys live? | Env `API_KEYS` (or secrets manager → env) |
| Where does attempt history live? | Product backend DB |
| When do we revisit this doc? | First real multi-tenant key rotation, multi-replica Nest, or async exams |

---

## Summary

| | |
|--|--|
| **Computing interaction (run/judge)** | Stateless — **no DB, no cache required** |
| **First storage to add later** | Hashed **API keys** (and quotas) |
| **First Redis use later** | **Rate limits** or **job queue**, not grade cache |
| **Student/curriculum data** | Stays on **Tutor / Lab / LMS** |

Ship and integrate clients with env keys + Nest + private Piston. Add database and Redis only when the triggers above are real.
