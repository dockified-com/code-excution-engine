# Client integration — Code Execution API

**Audience:** Product backends (AI Tutor, Dockified Lab, University LMS)  
**Service:** Nest judge gateway (`ai-tutor-backend`)  
**Language v1:** JavaScript only

Related:

- Architecture: [../architecture/code-execution-platform.md](../architecture/code-execution-platform.md)
- Design: [../superpowers/specs/2026-07-19-piston-code-execution-design.md](../superpowers/specs/2026-07-19-piston-code-execution-design.md)
- Ship checklist: [./SHIP-FAST.md](./SHIP-FAST.md)
- Smoke: `./scripts/smoke-execute.sh`

---

## Mental model

```text
Student browser
      │  product session / JWT (your auth)
      ▼
Your product backend (Tutor / Lab / LMS)
      │  Authorization: Bearer <API_KEY>
      ▼
This service  POST /v1/execute
      │  private network only
      ▼
Piston sandbox
```

| Actor | May hold platform API key? | May call this API? | May call Piston? |
|-------|----------------------------|--------------------|------------------|
| Product backend | **Yes** | **Yes** | No |
| Student browser / mobile app | **No** | **No** | **No** |
| This Nest service | N/A (calls Piston with config) | N/A | Yes (private) |

---

## Critical rules

1. **API keys live only on product servers** (env/secrets manager).  
2. **Never** put platform API keys in browser bundles, mobile apps, or public repos.  
3. **Never** call Piston directly from product code or clients — always go through this API for auth, limits, judging, and sanitization.  
4. Students authenticate to **your** product; your backend calls this service with the shared key.  
5. **Hidden tests** are always executed server-side; only the **response** is filtered. Do not re-expose hidden expected I/O in your own APIs to students.

---

## Base URL and auth

| Item | Value |
|------|--------|
| Base (local default) | `http://127.0.0.1:3000` |
| Auth scheme | `Authorization: Bearer <API_KEY>` |
| Key source (server) | Env `API_KEYS` — comma-separated list (e.g. `dev-key-tutor,dev-key-lab`) |
| Missing/invalid key | HTTP `401` |

Example header:

```http
Authorization: Bearer dev-key-tutor
Content-Type: application/json
```

Local keys match `.env.example`. Production keys must be rotated secrets per product (or per tenant if you issue separate keys).

---

## Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/v1/execute` | Bearer API key | Run and/or judge code |
| `GET` | `/v1/runtimes` | Bearer API key | List allowlisted runtimes (v1: JS) |
| `GET` | `/health` | None | Liveness (`{ "status": "ok" }`) |

---

## `GET /health`

No auth. Use for load balancers and smoke checks.

```bash
curl -s http://127.0.0.1:3000/health
# {"status":"ok"}
```

---

## `GET /v1/runtimes`

Returns installed runtimes filtered to the platform allowlist (v1: JavaScript / aliases). Requires API key.

```bash
curl -s http://127.0.0.1:3000/v1/runtimes \
  -H "Authorization: Bearer dev-key-tutor"
```

Typical shape (fields depend on Piston):

```json
[
  {
    "language": "javascript",
    "version": "18.15.0",
    "aliases": ["node-javascript", "js", "node"]
  }
]
```

If the list is empty, JS may not be installed on Piston yet (ops: install via Piston/ppman — see ship docs).

---

## `POST /v1/execute`

Unified entry for console run and exercise judging.

### Modes

| Mode | How selected | Behavior |
|------|--------------|----------|
| `run` | `mode: "run"`, or omit `tests` / empty tests without `mode: "judge"` | Single sandbox run; response `run` has stdout/stderr; `tests` is `[]` |
| `judge` | `mode: "judge"` or non-empty `tests` (default when tests present) | One Piston run per test; compare stdout; apply visibility filter |

Default: if `tests` has items → `judge`; otherwise → `run`.

### Request body

| Field | Required | Description |
|-------|----------|-------------|
| `language` | yes | v1: `javascript` (allowlisted aliases resolve to JS) |
| `version` | no | SemVer selector; default `*` |
| `files` | yes | `[{ "name"?, "content" }]` — max 20 files; content size capped |
| `tests` | for judge | Cases with `id`, `visibility`, optional `stdin`, `expectedStdout` (required in judge mode) |
| `mode` | no | `"judge"` \| `"run"` |
| `stdin` | no | Top-level stdin for **run** mode |
| `limits.runTimeoutMs` | no | Per-run timeout (ms); server clamps to `MAX_RUN_TIMEOUT_MS` (default 3000) |
| `context` | no | Opaque product metadata: `enrollmentId`, `lessonId`, `labType` (logged, not required for grading) |

**Test case fields**

| Field | Required | Description |
|-------|----------|-------------|
| `id` | yes | Stable id for UI / grade maps |
| `visibility` | yes | `"public"` \| `"hidden"` |
| `stdin` | no | Default empty |
| `expectedStdout` | yes in judge | Exact stdout compare (newline-normalized server-side) |

### Visibility (public vs hidden)

| Visibility | Student-facing fields in response |
|------------|-----------------------------------|
| `public` | `id`, `visibility`, `passed`, `status`, plus `stdin`, `expectedStdout`, `actualStdout`, `stderr`, `exitCode` |
| `hidden` | **`id`, `visibility`, `passed`, `status` only** — no I/O |

All tests still **run** on the server. Filtering applies only to the HTTP response.

Use **public** for sample cases the learner can debug against. Use **hidden** for real grading so expected/actual I/O cannot leak.

### Response body

```json
{
  "runId": "uuid",
  "language": "javascript",
  "version": "…",
  "summary": {
    "passed": 1,
    "failed": 1,
    "total": 2,
    "success": false,
    "status": "wrong_answer"
  },
  "tests": [ /* filtered results */ ],
  "run": null
}
```

| Field | Notes |
|-------|--------|
| `summary.success` | Judge: all tests passed. Run: exit code 0 |
| `summary.status` | Aggregate / primary status (`ok`, `wrong_answer`, `runtime_error`, `timeout`, `internal_error`) |
| `tests` | Judge mode: per-case results after visibility filter. Run mode: `[]` |
| `run` | Run mode: `{ stdout, stderr, code, signal }`. Judge mode: `null` |

Case `status` values: `ok` | `wrong_answer` | `runtime_error` | `timeout` | `internal_error`.

---

## Examples

Base and key for local defaults (adjust for your environment):

```bash
export BASE=http://127.0.0.1:3000
export API_KEY=dev-key-tutor
```

### 1) Run mode — console / try code

```bash
curl -s -X POST "${BASE}/v1/execute" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "javascript",
    "mode": "run",
    "files": [
      {
        "name": "main.js",
        "content": "console.log(\"hello\", 1 + 2)"
      }
    ],
    "stdin": "",
    "context": {
      "lessonId": "lesson-42",
      "labType": "sandbox"
    }
  }'
```

Example response:

```json
{
  "runId": "…",
  "language": "javascript",
  "version": "…",
  "summary": {
    "passed": 0,
    "failed": 0,
    "total": 0,
    "success": true,
    "status": "ok"
  },
  "tests": [],
  "run": {
    "stdout": "hello 3\n",
    "stderr": "",
    "code": 0,
    "signal": null
  }
}
```

### 2) Judge mode — public + hidden tests

```bash
curl -s -X POST "${BASE}/v1/execute" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "javascript",
    "files": [
      {
        "name": "main.js",
        "content": "console.log(1+2)"
      }
    ],
    "tests": [
      {
        "id": "sample",
        "expectedStdout": "3",
        "visibility": "public"
      },
      {
        "id": "hidden-1",
        "expectedStdout": "3",
        "visibility": "hidden"
      }
    ],
    "context": {
      "enrollmentId": "enr-1",
      "lessonId": "lesson-42",
      "labType": "exercise"
    }
  }'
```

Example response (public may include I/O; hidden does not):

```json
{
  "runId": "…",
  "language": "javascript",
  "version": "…",
  "summary": {
    "passed": 2,
    "failed": 0,
    "total": 2,
    "success": true,
    "status": "ok"
  },
  "tests": [
    {
      "id": "sample",
      "visibility": "public",
      "passed": true,
      "status": "ok",
      "stdin": "",
      "expectedStdout": "3",
      "actualStdout": "3\n",
      "stderr": "",
      "exitCode": 0
    },
    {
      "id": "hidden-1",
      "visibility": "hidden",
      "passed": true,
      "status": "ok"
    }
  ],
  "run": null
}
```

Wrong expected on a hidden case still returns only status fields for that case — never `expectedStdout` / `actualStdout`.

### 3) Judge with stdin per test

```bash
curl -s -X POST "${BASE}/v1/execute" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "javascript",
    "files": [
      {
        "name": "main.js",
        "content": "const fs=require(\"fs\"); const n=fs.readFileSync(0,\"utf8\").trim(); console.log(Number(n)*2)"
      }
    ],
    "tests": [
      {
        "id": "double-public",
        "stdin": "21",
        "expectedStdout": "42",
        "visibility": "public"
      },
      {
        "id": "double-hidden",
        "stdin": "100",
        "expectedStdout": "200",
        "visibility": "hidden"
      }
    ]
  }'
```

### 4) Unauthorized (expect 401)

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "${BASE}/v1/execute" \
  -H "Content-Type: application/json" \
  -d '{"language":"javascript","files":[{"content":"1"}]}'
# 401
```

---

## Product integration checklist

1. Store `API_KEY` (and base URL) in your backend secrets; never ship to the client.  
2. After student auth, assemble `files[]` (student editor + any **server-only** harness you inject).  
3. Choose `mode`:
   - Sandbox / “Run” button → `mode: "run"`  
   - Grade / submit → non-empty `tests` (or `mode: "judge"`)  
4. Mark sample cases `public`, grading cases `hidden`.  
5. Map response for UI:
   - Show full I/O only for `visibility === "public"`  
   - For hidden: show pass/fail (and aggregate `summary`) only  
6. Do not proxy Piston URLs or open Piston ports to the internet.  
7. Optionally pass `context.lessonId` / `enrollmentId` for correlation in this service’s logs.  
8. Before release, run `./scripts/smoke-execute.sh` against a stack with Nest + Piston + JS runtime.

---

## Errors (common)

| HTTP | Meaning |
|------|---------|
| `401` | Missing/invalid `Authorization: Bearer …` |
| `400` | Validation / policy (e.g. language not allowed, missing `files`, judge test without `expectedStdout`, too many files/tests) |
| `5xx` | Service or upstream engine failure |

Language v1 reject message (approx.): language not allowed — supports JavaScript only.

---

## Limits (defaults)

Configurable via env on this service (see `.env.example`):

| Limit | Default |
|-------|---------|
| `MAX_RUN_TIMEOUT_MS` | 3000 |
| `MAX_FILES` | 20 |
| `MAX_FILE_BYTES` | 100000 |
| `MAX_TESTS` | 50 |

DTO validation also caps string lengths and array sizes; server clamps `limits.runTimeoutMs` to the max.

---

## What not to do

- Embed `dev-key-tutor` (or any key) in frontend code  
- Call `http://piston:2000` or host-mapped `:2000` from product services in production  
- Return hidden test `expectedStdout` / `actualStdout` from **your** BFF to the student UI  
- Rely on client-side “grading” for anything that must stay secret  

---

## Smoke verification

With Nest and Piston running and JS installed:

```bash
BASE=http://127.0.0.1:3000 API_KEY=dev-key-tutor ./scripts/smoke-execute.sh
```

Checks health, a public+hidden judge payload, visibility stripping, and 401 without a key.
