# How to run and judge code

Call `POST /v1/execute` for a single sandbox run or for multi-test grading with public/hidden visibility.

## Prerequisites

- API base URL and Bearer API key
- Language allowed on the platform (**v1: JavaScript** only)
- For judge mode: each test has `expectedStdout`

Reference: [Execute API](../reference/execute-api.md)

## Steps

### 1. Export base URL and key

```bash
export BASE=http://127.0.0.1:3000
export API_KEY=dev-key-tutor
```

### 2. Run mode (console)

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
        "content": "const fs=require(\"fs\"); const n=fs.readFileSync(0,\"utf8\").trim(); console.log(Number(n)*2)"
      }
    ],
    "stdin": "21",
    "limits": { "runTimeoutMs": 3000 }
  }'
```

**Result:** `run.stdout` / `run.stderr` / `run.code`; `tests` is `[]`; `summary.success` is true when exit code is `0`.

### 3. Judge mode (public + hidden)

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
      "lessonId": "lesson-42",
      "labType": "exercise"
    }
  }'
```

Mode defaults to `judge` when `tests` is non-empty. You may set `"mode": "judge"` explicitly.

### 4. Judge with per-test stdin

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

### 5. List allowlisted runtimes

```bash
curl -s "${BASE}/v1/runtimes" \
  -H "Authorization: Bearer ${API_KEY}"
```

v1 returns JavaScript entries that exist on Piston and pass the allowlist.

## Verification

| Scenario | What to check |
|----------|----------------|
| Run success | `summary.success === true`, `run.code === 0` |
| Judge all pass | `summary.success === true`, `summary.failed === 0` |
| Wrong answer | `status` `wrong_answer`, hidden case has no I/O fields |
| Bad language | HTTP `400` |
| No key | HTTP `401` |

Stdout compare is **newline-normalized exact match** (trailing newlines stripped). Other whitespace is significant.

## Troubleshooting

| Problem | Cause / fix |
|---------|-------------|
| `Language not allowed` | Only JS in v1; use `javascript` / `js` / `node` |
| Judge `400` missing `expectedStdout` | Every test needs `expectedStdout` in judge mode |
| `503` in judge mid-suite | Piston down — service fails closed (does not return fake grades) |
| Timeout | Increase within cap, or raise `MAX_RUN_TIMEOUT_MS` on the server |

## Related

- [Public vs hidden tests (why)](../explanation/public-vs-hidden-tests.md)
- [Errors and status codes](../reference/errors-and-status.md)
- [Smoke script](../../scripts/smoke-execute.sh)
