# How to integrate a product backend

Wire AI Tutor, Dockified Lab, or an LMS so **your server** calls the Code Execution API with an API key, and the student browser never sees that key or Piston.

## Prerequisites

- Code Execution API reachable over HTTPS (or local base URL)
- A key listed in the service env `API_KEYS` (comma-separated)
- Product auth already protecting your student-facing endpoints
- Familiarity with [Execute API reference](../reference/execute-api.md)

## Steps

### 1. Store secrets on the product server only

Put base URL and key in your backend secret store / env:

```bash
CODE_EXEC_BASE_URL=https://code-exec.example.com
CODE_EXEC_API_KEY=prod-key-tutor   # never ship to browsers
```

Do **not** put these in frontend env (`NEXT_PUBLIC_*`, Vite `VITE_*`, mobile apps, or public repos).

### 2. After student auth, assemble the execute payload

Your BFF maps the editor state into the platform contract:

```ts
// Pseudocode on your product backend
async function runLab(studentSession, editorFiles, suite) {
  assertStudentAuthed(studentSession);

  const body = {
    language: 'javascript', // v1 allowlist
    files: editorFiles,     // [{ name?, content }]
    mode: suite ? 'judge' : 'run',
    tests: suite?.map((t) => ({
      id: t.id,
      stdin: t.stdin ?? '',
      expectedStdout: t.expectedStdout,
      visibility: t.visibility, // 'public' | 'hidden'
    })),
    context: {
      enrollmentId: studentSession.enrollmentId,
      lessonId: suite?.lessonId,
      labType: 'exercise',
    },
  };

  const res = await fetch(`${process.env.CODE_EXEC_BASE_URL}/v1/execute`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.CODE_EXEC_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (res.status === 401) throw new Error('Invalid platform API key');
  if (res.status === 503) throw new Error('Sandbox unavailable');
  if (!res.ok) throw new Error(await res.text());

  return res.json();
}
```

### 3. Choose run vs judge

| UI action | Platform mode |
|-----------|----------------|
| “Run” / console | `mode: "run"` (or omit tests) |
| “Submit” / grade | non-empty `tests` (defaults to judge) |

Inject **server-only harness files** (hidden setup) in `files[]` on the product backend when the lab needs them. Never trust the client to supply hidden expected I/O for grading that must stay secret — those belong in `tests` on the trusted path.

### 4. Map the response for the student UI

```ts
function toStudentView(platformResult) {
  return {
    success: platformResult.summary.success,
    status: platformResult.summary.status,
    run: platformResult.run, // only in run mode
    tests: platformResult.tests.map((t) => {
      if (t.visibility === 'hidden') {
        // Platform already stripped I/O; keep it that way in YOUR API too
        return {
          id: t.id,
          visibility: t.visibility,
          passed: t.passed,
          status: t.status,
        };
      }
      return t; // public: may show stdin / expected / actual / stderr
    }),
  };
}
```

### 5. Do not open Piston to the product or the internet

- Product backends call **only** this Nest API  
- Piston stays on a private Docker/network URL (`PISTON_URL`)  
- Local `127.0.0.1:2000` is for developer debug only  

### 6. Verify integration

```bash
BASE="$CODE_EXEC_BASE_URL" API_KEY="$CODE_EXEC_API_KEY" ./scripts/smoke-execute.sh
```

Or manually: health → execute judge with one public + one hidden case → confirm hidden has no `expectedStdout`.

## Verification

| Check | Expected |
|-------|----------|
| Call without `Authorization` | HTTP `401` |
| Valid key + `console.log(1+2)` judge | `summary.passed` / `failed` match tests |
| Hidden failed case | No `expectedStdout` / `actualStdout` in body |
| Student network tab | No platform API key |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Always `401` | Key not in server `API_KEYS`, or missing `Bearer ` prefix |
| Always `503` / “Piston unreachable” | Nest `PISTON_URL` wrong; Piston down; no JS package installed |
| Empty `GET /v1/runtimes` | Install JS on Piston; see [install runtimes](./install-piston-runtimes.md) |
| `400` language not allowed | v1 supports JavaScript only (`js` / `node` aliases) |
| Students see hidden expected output | Your BFF is re-adding fields — stop mapping them |

## Related

- [Client integration runbook](../runbooks/client-integration.md) (full examples)
- [How to run and judge code](./run-and-judge-code.md)
- [Why Nest in front of Piston](../explanation/why-judge-gateway.md)
