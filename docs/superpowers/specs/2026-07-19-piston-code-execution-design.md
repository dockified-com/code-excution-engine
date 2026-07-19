# Code Execution API + Piston Integration — Design Spec

**Version:** 1.0  
**Date:** 2026-07-19  
**Status:** Ready for review  
**Owner:** Dockified / Yeakkhai  
**Repo context:** Production platform service (shared runner), NestJS

---

## 1. Problem and goals

### 1.1 Problem

Dockified needs safe, multi-product online code execution for:

1. **AI Tutor** — students run code in the code lab during tutoring and exercises  
2. **Dockified Lab / experiments** — multi-file labs, fill-in-gap, full code lab  
3. **University LMS** — third-party product backends integrate via API key  

Students submit untrusted code. Raw sandbox access must never be public. Grading must support HackerRank-style **public vs hidden** tests. Hidden harnesses and hidden I/O must not leak to clients that should not see them (especially student UIs).

### 1.2 Goals

- Self-host **Piston** via Docker as the sandbox engine  
- Ship a **NestJS judge/gateway** in front of Piston (shared platform API)  
- Support **JavaScript first** on Piston (`ppman install` JS/Node package)  
- Unified execute API for single-file, multi-file, and fill-in-gap payloads  
- Flexible test visibility: creator/product decides `public` | `hidden` per case  
- Production security: API keys, rate limits, private Piston, sanitized responses  
- Structured results suitable for code lab UI and LMS grade sync  

### 1.3 Non-goals (v1)

- Student browsers calling this API with master API keys  
- Public exposure of Piston  
- Full LMS (enrollments, content CMS) inside this service  
- Monaco / Foundation UI (frontend responsibility)  
- Browser-only live preview (frontend strategy; no backend call)  
- Installing all Piston languages on day one  
- Interactive WebSocket Piston sessions (can add later)  
- Full multi-region HA design (document extension points only)

---

## 2. Decisions summary

| Topic | Decision |
|-------|----------|
| Architecture | **Split**: shared Code Execution / Judge API + product backends + private Piston |
| Engine | **Piston** self-hosted via Docker |
| Language v1 | **JavaScript only** |
| Auth | **API keys** per client product (tutor, lab, LMS, …) |
| Piston network | **Private** — Docker internal network only |
| Grading | Server-side compare; filter response by test visibility |
| Test delivery v1 | **Pass-through judge**: trusted caller sends `files` + `tests[]` |
| Lab store | **Phase 2** — optional `labId` + stored suites |
| Student path | Browser → **product backend** → this API → Piston |

---

## 3. Architecture

### 3.1 Service split

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ AI Tutor API │  │ Dockified Lab│  │ University   │
│              │  │ API          │  │ LMS API      │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │  API key        │
       └─────────────────┼─────────────────┘
                         ▼
            ┌────────────────────────┐
            │ Code Execution / Judge │  ← this platform service
            │ NestJS                 │
            └────────────┬───────────┘
                         │ private
                         ▼
            ┌────────────────────────┐
            │ Piston (Docker)        │
            │ JS runtime installed   │
            └────────────────────────┘
```

**Piston already exposes HTTP** (`GET /api/v2/runtimes`, `POST /api/v2/execute`). That is the **engine** API, not the product API. This Nest service is required for auth, multi-tenant keys, judging, sanitization, quotas, and audit.

### 3.2 Component responsibilities

| Component | Responsibility |
|-----------|----------------|
| **Product backends** | Student auth, curriculum, assembling editor payload, mapping results to UI, holding this service’s API key |
| **Nest Judge Gateway** | Validate API key, rate limit, validate payload, orchestrate runs, compare outputs, sanitize, log |
| **Piston** | Isolated compile/run; return stdout/stderr/exit/signal/timings |

### 3.3 Nest module layout (target)

```
src/
  main.ts
  app.module.ts
  auth/
    api-key.guard.ts
    api-key.module.ts
  execution/
    execution.module.ts
    execution.controller.ts      # POST /v1/execute
    execution.service.ts         # orchestration
    judge.service.ts             # compare + summary
    response-filter.service.ts   # public vs hidden
    dto/
  piston/
    piston.module.ts
    piston.client.ts             # HTTP client to PISTON_URL
    piston.types.ts
  limits/
    rate-limit (per key)
  health/
    health.controller.ts         # liveness; optional Piston probe
```

---

## 4. Piston installation (Docker)

### 4.1 Principles

- Run official/community Piston image or compose from [engineer-man/piston](https://github.com/engineer-man/piston)  
- After API is up, **no runtimes are installed by default** — install JS via CLI `ppman`  
- **Do not publish** Piston port on production public interfaces  
- Nest reaches Piston at e.g. `http://piston:2000`  

### 4.2 Conceptual compose

```yaml
services:
  api:
    # Nest judge gateway — public
    ports:
      - "3000:3000"
    environment:
      PISTON_URL: http://piston:2000
      # API keys / DB connection as designed
    depends_on:
      - piston

  piston:
    image: ghcr.io/engineer-man/piston
    privileged: true   # required by Piston/Isolate model
    # no public ports in production
    volumes:
      - piston-data:/piston
```

### 4.3 Install JavaScript runtime

Using Piston CLI against the running API (ops step documented in runbooks):

```bash
# list packages
cli/index.js ppman list

# install JS (package name per current Piston package index — e.g. javascript / node)
cli/index.js ppman install javascript
```

Verify:

```bash
curl http://piston:2000/api/v2/runtimes
# expect javascript/node entry
```

### 4.4 Local debug only

Publishing `localhost:2000` is acceptable on a developer machine. Production and shared staging: internal network only.

---

## 5. API design

### 5.1 Authentication

```http
Authorization: Bearer <api_key>
```

- One key (or key set) per **client product** (AI Tutor, Dockified Lab, each university LMS tenant as needed)  
- Invalid/missing key → `401`  
- Revoked key → `401`  
- v1 storage: config/DB table of hashed keys + `clientId` + limits  
- **Never** embed platform API keys in student-facing frontend bundles  

### 5.2 Execute — unified entry

```http
POST /v1/execute
Authorization: Bearer <api_key>
Content-Type: application/json
```

Supports all Code Lab foundation lab types via one payload:

| Lab type | Payload usage |
|----------|----------------|
| Fill-in-the-gap | Usually one assembled file + tests |
| Exercise lab | `files[]` full workspace + tests |
| Full code lab | Same multi-file + optional `context` |

#### Request body

| Field | Required | Description |
|-------|----------|-------------|
| `language` | yes | v1: `javascript` (aliases as allowlisted) |
| `version` | no | SemVer selector; default `*` |
| `files` | yes | Array of `{ name?, content }`; first file is main if required by runtime |
| `tests` | yes* | Array of test cases (*or empty for “run only” mode — see below) |
| `tests[].id` | yes | Stable id for UI |
| `tests[].stdin` | no | Default `""` |
| `tests[].expectedStdout` | yes if judging | Expected stdout for compare |
| `tests[].visibility` | yes | `public` \| `hidden` |
| `limits.runTimeoutMs` | no | Cap; server enforces max ceiling |
| `context` | no | Opaque product metadata: `enrollmentId`, `lessonId`, `labType`, etc. |
| `mode` | no | `judge` (default if tests present) \| `run` (execute once, no expected compare) |

#### Run-only mode

When the product only needs console output (no grading):

- `mode: "run"` or `tests: []`  
- Single Piston invocation with optional `stdin` at top level  
- Response includes `run` stdout/stderr without test matrix  

#### Response body

```json
{
  "runId": "string",
  "language": "javascript",
  "version": "string",
  "summary": {
    "passed": 0,
    "failed": 0,
    "total": 0,
    "success": false,
    "status": "ok | wrong_answer | runtime_error | timeout | internal_error"
  },
  "tests": [
    {
      "id": "sample-1",
      "visibility": "public",
      "passed": true,
      "status": "ok",
      "stdin": "...",
      "expectedStdout": "...",
      "actualStdout": "...",
      "stderr": "",
      "exitCode": 0
    },
    {
      "id": "hidden-1",
      "visibility": "hidden",
      "passed": false,
      "status": "wrong_answer"
    }
  ],
  "run": null
}
```

#### Visibility rules (HackerRank-style)

| Visibility | On failure, response may include |
|------------|----------------------------------|
| `public` | stdin, expectedStdout, actualStdout, stderr (length-capped) |
| `hidden` | `id`, `passed`, `status` only — **no** I/O fields |

Backend always **executes** all tests. Filtering applies only to the **HTTP response**.

### 5.3 Runtimes (optional proxy)

```http
GET /v1/runtimes
Authorization: Bearer <api_key>
```

Proxies/filters Piston `GET /api/v2/runtimes` to allowlisted languages (v1: JS only).

### 5.4 Health

```http
GET /health
```

No secrets. Optional `GET /health/ready` checks Piston reachability for orchestration.

---

## 6. Judging behavior

### 6.1 Per-test execution (v1 default)

For each test case:

1. Build Piston `POST /api/v2/execute` body from `files` + test `stdin`  
2. Apply timeouts/memory ceilings  
3. Read `run.stdout` / `run.stderr` / `run.code` / status  
4. Normalize stdout (document policy: trim trailing newlines consistently)  
5. Compare to `expectedStdout`  
6. Map Piston failures: timeout → `timeout`, non-zero/signal → `runtime_error`  

### 6.2 Hidden harness injection (product responsibility in v1)

v1 pass-through model: the **trusted product backend** may include harness files in `files[]` and tests that exercise them. Students never receive those files if the product keeps harness server-side.

Phase 2 stored labs: this service stores harness + tests; student-facing product sends only `labId` + student files.

### 6.3 Comparison policy (explicit)

- Default: exact string match after **unified newline normalization** (e.g. strip one trailing `\n`)  
- No regex/fuzzy match in v1  
- stderr does not fail a test by itself unless exit non-zero or status error (document if product needs strict stderr-empty)

---

## 7. Security

| Control | Implementation |
|---------|----------------|
| Network | Piston not published publicly |
| Auth | API key on all `/v1/*` mutating/execute routes |
| Browser | No platform API keys in SPAs |
| Payload limits | Max body size, max files, max file bytes, max tests, max stdin size |
| Time | Server max `runTimeoutMs` (align with ~3s median UX target) |
| Concurrency | Per-key concurrent job cap + global cap |
| Rate limit | Per-key requests/minute |
| Output caps | Truncate stdout/stderr in responses and logs |
| Logging | Log `runId`, `clientId`, durations, summary status — avoid logging full hidden expected I/O by default |
| Fail closed | If Piston unreachable → `503` with stable error code, not fake pass |

### 7.1 Abuse if Piston were public

Open Piston allows free CPU theft, DoS, and unmetered execution. **Forbidden in production.**

---

## 8. Multi-client model

| Client | Auth | Notes |
|--------|------|-------|
| AI Tutor backend | API key `clientId=ai-tutor` | Holds key in server env/secrets |
| Dockified Lab backend | Separate key | Same execute contract |
| University LMS | Key per institution or per integration | Quotas per key |

Recommended v1 key record:

- `keyId`, `keyHash`, `clientId`, `name`, `enabled`  
- `rateLimitPerMinute`, `maxConcurrent`, `dailyRunCap` (simple counters OK at first)  

---

## 9. Alignment with Code Lab requirements

| Requirement theme | How this service supports it |
|-------------------|------------------------------|
| Foundation `executeCode` → backend `/api/execute` | Product maps to `POST /v1/execute` |
| Single + multi-file | `files[]` |
| Fill-in-gap | Assembled source in `files` + tests |
| Hidden test harness never to student client | Product keeps secrets; this API sanitizes hidden tests; Piston private |
| Structured result | `summary` + `tests[]` |
| Log enrollment/lesson | `context.enrollmentId`, `context.lessonId` + timestamp in audit log |
| Pluggable strategies on FE | Backend is Piston strategy; browser preview stays FE |
| Median feedback &lt; 3s | Timeouts + enough Piston capacity; queue later if needed |

---

## 10. Configuration

| Env var | Purpose |
|---------|---------|
| `PORT` | Nest listen port |
| `PISTON_URL` | e.g. `http://piston:2000` |
| `PISTON_TIMEOUT_MS` | HTTP client timeout ceiling |
| `MAX_RUN_TIMEOUT_MS` | Max allowed per-run wall time |
| `MAX_FILES` / `MAX_FILE_BYTES` / `MAX_TESTS` | Payload guards |
| `API_KEYS` or DB URL | Key store |
| `LOG_LEVEL` | Ops |

---

## 11. Error model

| HTTP | When |
|------|------|
| `400` | Validation failed, unknown language, bad test shape |
| `401` | Missing/invalid API key |
| `429` | Rate limit or daily cap |
| `503` | Piston unavailable / overloaded |
| `200` | Execution attempted; check `summary.success` and per-test `passed` for grade |

Business failures (WA, TLE, RE) are **200 with structured status**, not 500.

---

## 12. Observability

- Structured logs: `runId`, `clientId`, `language`, `testCount`, `durationMs`, `summary.status`  
- Metrics (phase 1.5): runs total, error rate, Piston latency p50/p95, 429 count per client  
- Correlate with product using `context` fields when provided  

---

## 13. Phased delivery

### Phase 1 — Ship shared runner (this design)

- Docker Compose: Nest + private Piston  
- Install JavaScript runtime  
- `POST /v1/execute` with API key  
- Pass-through `files` + `tests` + visibility filtering  
- `mode: run` for console-only  
- Health endpoint  
- Unit tests for judge + filter; integration test with Piston when available  

### Phase 2 — Platform hardening

- Key management CRUD / hashed keys in DB  
- Stronger per-key quotas  
- Optional stored labs (`labId` + server-side tests/harness)  
- More languages via `ppman`  

### Phase 3 — Scale

- Job queue when sync p95 exceeds SLO  
- Multiple Piston workers  
- Extract deploy name as dedicated `code-execution-api` service if repo still mixed  

---

## 14. Testing strategy

| Layer | What |
|-------|------|
| Unit | Stdout normalization, pass/fail, hidden field stripping |
| Unit | DTO validation, allowlist language |
| Integration | Mock Piston client responses |
| E2E / manual | Real Piston container + JS hello world + public/hidden suite |
| Security smoke | Ensure no route proxies raw Piston without API key |

---

## 15. Open points (resolved for v1)

| Topic | Resolution |
|-------|------------|
| One backend vs split | **Split** — shared exec for multiple products |
| Need Nest in front of Piston? | **Yes** |
| Online vendor vs Piston | **Self-hosted Piston** v1; strategy interface may allow vendor later |
| Where tests live | **Caller sends tests** v1; store later |
| Hidden failure detail | **Verdict only** for hidden; full I/O for public |

---

## 16. References

- Piston: https://github.com/engineer-man/piston  
- Piston API: `GET /api/v2/runtimes`, `POST /api/v2/execute`  
- Architecture diagrams: [docs/architecture/code-execution-platform.md](../../architecture/code-execution-platform.md)  
- Product requirements: Code Lab foundation (fill-in-gap, multi-file, full lab)  

---

## 17. Approval

Document captures brainstorming outcomes for production multi-client code execution with private Piston and Nest judge gateway.

**Next step after approval:** implementation plan via writing-plans skill.
