# Errors and status reference

HTTP status codes from the Nest gateway and domain result statuses inside successful `200` execute responses.

## HTTP statuses

| HTTP | When |
|------|------|
| `200` | Execute completed (including student wrong answer / runtime error / timeout) |
| `400` | Validation or policy: bad body, language not allowed, missing `files`, judge test missing `expectedStdout`, too many files/tests, file too large |
| `401` | Missing `Authorization: Bearer …` or key not in `API_KEYS` |
| `503` | Piston unreachable, non-OK upstream, malformed upstream response, or HTTP timeout to Piston |

### Fail-closed judge behavior

If Piston throws `ServiceUnavailableException` during a judge loop, the use case **rethrows 503**. It does not mark remaining tests as `internal_error` and return 200. Product backends should retry or show “sandbox unavailable,” not treat 503 as a grade.

---

## `summary.status` and per-test `status` (v1 shipped)

Type: `CaseStatus` in `src/domain/models/execute.models.ts`.

| Status | Meaning |
|--------|---------|
| `ok` | Run: exit 0. Judge: test passed (or all passed for summary) |
| `wrong_answer` | Engine ok but stdout ≠ expected (after newline normalize) |
| `runtime_error` | Non-zero exit, or engine status `RE` / `SG`, or other run failure |
| `timeout` | Engine status `TO` |
| `internal_error` | Unexpected non-503 error while grading a case |

### Summary priority (judge, when any test failed)

From `Judge.buildSummary` (highest first among failed tests):

1. `internal_error`  
2. `timeout`  
3. `runtime_error`  
4. else `wrong_answer`  

`success` is true only when `failed === 0` and `total > 0` (judge), or run exit code is 0 (run mode).

---

## Planned: `compile_error`

Multi-language design adds:

| Status | Meaning |
|--------|---------|
| `compile_error` | C/C++ (or any language) failed the Piston **compile** stage |

Updated priority when shipped:

```
internal_error > timeout > compile_error > runtime_error > wrong_answer
```

Compiler diagnostics go into `stderr` for **public** tests and **run** mode; **hidden** tests still strip I/O.

---

## Engine status mapping (use case)

| Piston / output | Case status |
|-----------------|-------------|
| `engineStatus === 'TO'` | `timeout` |
| `engineStatus === 'RE'` or `'SG'` | `runtime_error` |
| `engineStatus === 'XX'` | `internal_error` |
| `code !== 0` and not null | `runtime_error` |
| otherwise | `ok` (then compare stdout in judge) |

---

## Common 400 messages (conceptual)

| Message pattern | Cause |
|-----------------|--------|
| Language not allowed | Not in allowlist |
| `files required` | Empty / missing files |
| Too many files / tests | Exceeds env max |
| File content too large | Exceeds `MAX_FILE_BYTES` |
| Test `…` missing `expectedStdout` | Judge mode without expected output |

ValidationPipe also rejects unknown properties (`forbidNonWhitelisted: true`) and type errors on the DTO.

---

## Related

- [Execute API](./execute-api.md)
- [How to run and judge code](../howtos/run-and-judge-code.md)
