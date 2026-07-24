# Execute API reference

HTTP surface of the Nest Code Execution / Judge gateway. Product backends call these endpoints with Bearer API keys. Students never call this API with platform keys.

Interactive OpenAPI UI when the server is running: `/docs` (Swagger).

Related: [Configuration](./configuration.md) · [Errors and status](./errors-and-status.md) · [Languages](./languages.md)

---

## Authentication

| Item | Value |
|------|--------|
| Scheme | `Authorization: Bearer <api_key>` |
| Key source | Server env `API_KEYS` (comma-separated) |
| Missing / invalid | HTTP `401` |
| Applied to | `POST /v1/execute`, `GET /v1/runtimes` |
| Not applied to | `GET /health` |

Implementation: `ApiKeyGuard` (`src/presentation/auth/api-key.guard.ts`).

---

## Endpoints

### `GET /health`

| | |
|--|--|
| Auth | None |
| Purpose | Liveness |
| Response | `{ "status": "ok" }` |

---

### `GET /v1/runtimes`

| | |
|--|--|
| Auth | Bearer API key |
| Purpose | List Piston runtimes that pass the platform language allowlist |
| Response | Array of `{ language, version, aliases }` |

v1 allowlist is JavaScript only. Empty array means nothing installed on Piston or no allowlisted match.

---

### `POST /v1/execute`

| | |
|--|--|
| Auth | Bearer API key |
| Purpose | Single run or multi-test judge |

#### Modes

| Mode | Selection | Behavior |
|------|-----------|----------|
| `run` | `mode: "run"`, or no tests | One Piston execution; response includes `run` |
| `judge` | `mode: "judge"` or non-empty `tests` | One Piston run per test; stdout compare; visibility filter |

Default: non-empty `tests` → `judge`; else → `run`.

#### Request body

| Field | Type | Required | Constraints / notes |
|-------|------|----------|---------------------|
| `language` | string | yes | v1: `javascript` and aliases `js`, `node`, `node.js` |
| `version` | string | no | Runtime pin; default `*` |
| `files` | array | yes | Max `MAX_FILES` (default 20). Each: `name?` (max 255), `content` (max 100_000 chars DTO; also byte cap `MAX_FILE_BYTES`) |
| `tests` | array | judge | Max `MAX_TESTS` (default 50) |
| `mode` | `"judge" \| "run"` | no | See modes |
| `stdin` | string | no | Run mode stdin; max 50_000 chars |
| `limits.runTimeoutMs` | int | no | 100–10_000 in DTO; server clamps to `MAX_RUN_TIMEOUT_MS` |
| `context` | object | no | `enrollmentId?`, `lessonId?`, `labType?` — logged, not used for grading |

#### Test case object

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | yes | 1–128 chars |
| `visibility` | `"public" \| "hidden"` | yes | Filters response fields |
| `stdin` | string | no | Max 50_000 |
| `expectedStdout` | string | **yes in judge** | Max 50_000; exact match after newline normalize |

#### Response body

```json
{
  "runId": "uuid",
  "language": "javascript",
  "version": "18.x.x",
  "summary": {
    "passed": 1,
    "failed": 0,
    "total": 1,
    "success": true,
    "status": "ok"
  },
  "tests": [],
  "run": {
    "stdout": "…",
    "stderr": "…",
    "code": 0,
    "signal": null
  }
}
```

| Field | Notes |
|-------|--------|
| `runId` | UUID for this request |
| `summary.passed` / `failed` / `total` | Judge counts; run mode uses zeros for test counts |
| `summary.success` | Judge: all tests passed. Run: exit code `0` |
| `summary.status` | Aggregate status (see [errors and status](./errors-and-status.md)) |
| `tests` | Judge: filtered cases. Run: `[]` |
| `run` | Run mode payload. Judge: `null` |

#### Public vs hidden test fields

| Visibility | Fields returned |
|------------|-----------------|
| `public` | `id`, `visibility`, `passed`, `status`, `stdin`, `expectedStdout`, `actualStdout`, `stderr`, `exitCode` |
| `hidden` | `id`, `visibility`, `passed`, `status` only |

All tests still execute. Filtering is response-only (`VisibilityFilter`).

#### Grading

- Engine must be ok (not timeout / runtime error)  
- `Judge.compare`: strip trailing newlines from actual and expected, then string equality  
- Case `status` when compare fails with ok engine: `wrong_answer`

---

## Examples

### Run

```bash
curl -s -X POST "http://127.0.0.1:3000/v1/execute" \
  -H "Authorization: Bearer dev-key-tutor" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "javascript",
    "mode": "run",
    "files": [{"name":"main.js","content":"console.log(1+2)"}]
  }'
```

### Judge

```bash
curl -s -X POST "http://127.0.0.1:3000/v1/execute" \
  -H "Authorization: Bearer dev-key-tutor" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "js",
    "files": [{"name":"main.js","content":"console.log(1+2)"}],
    "tests": [
      {"id":"t1","expectedStdout":"3","visibility":"public"},
      {"id":"t2","expectedStdout":"3","visibility":"hidden"}
    ]
  }'
```

---

## Implementation map

| Concern | Location |
|---------|----------|
| HTTP controller | `src/presentation/http/execution.controller.ts` |
| DTO validation | `src/presentation/http/dto/execute.dto.ts` |
| Orchestration | `src/application/use-cases/execute-code.use-case.ts` |
| Language allowlist | `src/domain/language-policy.ts` |
| Compare / summary | `src/domain/judge.ts` |
| Hidden filter | `src/domain/visibility-filter.ts` |
| Piston HTTP | `src/infrastructure/piston/piston.client.ts` |

---

## Related

- [How to run and judge code](../howtos/run-and-judge-code.md)
- [Client integration runbook](../runbooks/client-integration.md)
