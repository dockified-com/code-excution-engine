# Multi-Language Piston Execution — Design Spec

**Version:** 1.0  
**Date:** 2026-07-24  
**Status:** Approved for implementation planning  
**Owner:** Dockified / Yeakkhai  
**Repo context:** NestJS Code Execution / Judge API (platform service)  
**Extends:** [2026-07-19-piston-code-execution-design.md](./2026-07-19-piston-code-execution-design.md) (v1 JavaScript-only)

---

## 1. Problem and goals

### 1.1 Problem

v1 of the Code Execution API allowlists **JavaScript only** via `LanguagePolicy`. Product use cases (AI Tutor, Dockified Lab, University LMS) need additional languages:

1. **Python** — general programming / data exercises  
2. **C and C++** — systems and algorithms tracks (compile + run)  
3. **SQL** — database exercises where students create tables and write queries  

The Nest gateway and Piston client are already language-agnostic at the transport layer. The gaps are: allowlist/registry, compile-stage mapping, package install ops, and tests.

### 1.2 Goals

- Support **javascript**, **python**, **c**, **cpp**, and **sql** on the same `POST /v1/execute` and `GET /v1/runtimes` APIs  
- Keep the existing layered architecture (presentation → use cases → domain → Piston port)  
- Map C/C++ **compile failures** to a distinct `compile_error` status  
- Run SQL via **SQLite in Piston** (`sqlite3` package); allow full scripts including `CREATE TABLE`  
- Install runtimes with **documented, pinned `ppman install`** (no auto-install on boot)  
- Enable **parallel implementation** via git worktrees / subagents with a clean merge order  
- Preserve security model: private Piston, API keys, public/hidden test filtering  

### 1.3 Non-goals

- Postgres / MySQL as the SQL engine  
- SQL-aware result-set comparison (column/row order insensitivity)  
- Auto-install of Piston packages when the API starts  
- Per-API-key language allowlists  
- Interactive REPL / WebSocket sessions  
- Short-circuiting remaining judge tests after the first `compile_error` (may optimize later)  
- Exposing a top-level `compile` object in the HTTP response (stderr folded into existing `run` / test fields)

---

## 2. Decisions summary

| Topic | Decision |
|-------|----------|
| Approach | **Language registry** (config map) replacing thin alias-only `LanguagePolicy` |
| Languages | `javascript`, `python`, `c`, `cpp`, `sql` |
| C family | **Two API languages**: `c` and `cpp` (not a single umbrella) |
| SQL engine | **SQLite via Piston** package `sqlite3` |
| SQL student model | Full scripts allowed (`CREATE TABLE`, `INSERT`, `SELECT`, …); optional multi-file harness later |
| Compile failures | New status: **`compile_error`** |
| Judging | Unchanged: newline-normalized **exact stdout** match |
| Packages | Documented **`ppman install` + pinned versions** in runbook |
| Delivery | Parallel git worktrees: **shared plumbing first**, then language packs |
| HTTP contract | Additive only (new language values + new status enum value) |

---

## 3. Architecture

### 3.1 Unchanged service split

```
Product backends (Tutor / Lab / LMS)
        │  Bearer API key
        ▼
Nest Code Execution / Judge API
        │  private
        ▼
Piston (Docker) — packages: JS, python, c, c++, sqlite3
```

### 3.2 Internal change: language registry

Replace the v1 `LanguagePolicy` (JS-only aliases) with a domain **LanguageRegistry** backed by per-language definition modules. Responsibilities stay pure domain: no HTTP, no fetch.

```text
HTTP → ExecutionController
         → ExecuteCodeUseCase / ListRuntimesUseCase
              → LanguageRegistry.resolve / isAllowed
              → Judge / VisibilityFilter
              → CodeRunnerPort (PistonClient)
```

### 3.3 Parallel delivery shape

| Workstream | Owns |
|------------|------|
| **shared** (land first) | Registry abstraction, migrate JS, `compile_error`, Piston compile mapping, Judge summary priority, use-case wiring |
| **python** | Definition file + unit tests + runbook install section |
| **c-cpp** | `c` + `cpp` definitions, default filenames, compile_error tests |
| **sql** | `sql` → `sqlite3` definition, aliases, runbook + client examples |

Merge order: **shared → (python ∥ c-cpp ∥ sql)**.

---

## 4. Language registry

### 4.1 Definition shape

```ts
type LanguageDefinition = {
  /** Canonical API language id */
  id: string;
  /** Lowercase aliases including id */
  aliases: string[];
  /** Language string sent to Piston /api/v2/execute */
  pistonLanguage: string;
  /** Applied when a file has no name */
  defaultFileName: string;
  /** Metadata: language normally has a compile stage (C/C++) */
  hasCompileStage: boolean;
};
```

### 4.2 Supported languages

| API `id` | Aliases | `pistonLanguage` | `defaultFileName` | `hasCompileStage` |
|----------|---------|------------------|-------------------|-------------------|
| `javascript` | `javascript`, `js`, `node`, `node.js` | `javascript` | `main.js` | false |
| `python` | `python`, `python3`, `py` | `python` | `main.py` | false |
| `c` | `c` | `c` | `main.c` | true |
| `cpp` | `cpp`, `c++`, `cxx` | `c++` | `main.cpp` | true |
| `sql` | `sql`, `sqlite`, `sqlite3` | `sqlite3` | `main.sql` | false |

**Resolve:** `language.trim().toLowerCase()` → alias map → definition (or null).  
**Unknown language:** HTTP 400 with message listing: `javascript, python, c, cpp, sql`.

### 4.3 Suggested module layout (merge-friendly)

```text
src/domain/languages/
  types.ts
  registry.ts              # resolve, isAllowed, listIds, getDefinition
  definitions/
    javascript.ts
    python.ts
    c.ts
    cpp.ts
    sql.ts
  index.ts
```

`LanguagePolicy` may remain as a thin deprecated alias to `LanguageRegistry` during migration, or be renamed in the shared PR. Prefer **rename + update injection sites** in one shared change to avoid dual types.

**Registration for parallel packs:** each definition file exports a single `LanguageDefinition`. Shared lands `definitions/index.ts` that re-exports an `ALL_DEFINITIONS` array starting with `javascript`. Each language pack PR adds one import + one array entry (single-line conflict risk only). Do not scatter language entries inside `registry.ts` logic.

### 4.4 Default file names

Before calling the runner, for each file with missing `name`, set `name` to `definition.defaultFileName`.  
If multiple files omit names, only the first may receive the default; additional nameless files keep no name or get indexed names (`main_1.c`) — **v1.1 rule: apply default only to the first file without a name; require names when multiple files lack them** (400 if two or more files omit `name`). This avoids ambiguous multi-file C projects.

---

## 5. API surface

### 5.1 `POST /v1/execute`

- Request DTO unchanged in shape.  
- `language` accepts the ids and aliases in §4.2.  
- Modes `run` | `judge` unchanged.  
- SQL: product/student sends SQL source in `files[]` (full script including DDL/DML/queries).

### 5.2 Response status values

`CaseStatus` becomes:

```ts
type CaseStatus =
  | 'ok'
  | 'wrong_answer'
  | 'runtime_error'
  | 'timeout'
  | 'compile_error'
  | 'internal_error';
```

`ExecuteSummary.status` uses the same set.

### 5.3 Compile failure presentation

- No new top-level `compile` field in this release.  
- On compile failure in **run** mode: `summary.status = compile_error`, `summary.success = false`, `run.stderr` populated from compiler stderr (fallback compile stdout), grading skipped.  
- On compile failure in **judge** mode: per-test `status = compile_error`, `passed = false`; for **public** tests, stderr may include compiler diagnostics; for **hidden** tests, VisibilityFilter strips I/O fields (status only).

### 5.4 `GET /v1/runtimes`

- Intersection of Piston installed runtimes and registry allowlist (match on language or aliases).  
- Swagger description updated from “JavaScript only” to the multi-language list.

---

## 6. Data flow

### 6.1 Shared path

1. Authenticate API key  
2. Validate DTO  
3. `registry.resolve(language)` → 400 if null  
4. Validate files/tests limits  
5. Apply default file name rules (§4.4)  
6. Branch `run` vs `judge`  
7. Call `CodeRunnerPort.run` with **`pistonLanguage`** (not only API id) and version (`*` default)  
8. Map engine outcome → status  
9. Judge compare only when engine status is ok  
10. Filter visibility; return result  

### 6.2 Engine status mapping

| Condition | Status |
|-----------|--------|
| Compile stage present and failed (`code !== 0` or failure status) | `compile_error` |
| Run engine status `TO` | `timeout` |
| Run engine status `RE` / `SG`, or non-zero exit | `runtime_error` |
| Engine ok, stdout mismatch (judge) | `wrong_answer` |
| Engine ok, stdout match (judge) or exit 0 (run) | `ok` |
| Unexpected error (non-503) in judge loop | `internal_error` |
| Piston unavailable | HTTP **503** (fail closed; do not grade as 200) |

**Defensive rule:** if Piston returns a failed `compile` stage, map to `compile_error` even if `hasCompileStage` is false.

### 6.3 Judge summary priority

When any test failed, pick the highest-priority status among failed tests:

```
internal_error > timeout > compile_error > runtime_error > wrong_answer
```

### 6.4 Judge loop behavior

- Continue running remaining tests after `compile_error` or `runtime_error` (consistent with v1).  
- No short-circuit optimization in this design.

### 6.5 Port / client mapping

Extend `CodeRunOutput` so the use case does not depend on Piston wire types:

```ts
// Conceptual — exact fields may match existing style
{
  language, version, stdout, stderr, code, signal, engineStatus,
  compile?: {
    stdout: string;
    stderr: string;
    code: number | null;
    signal: string | null;
    engineStatus: string | null;
  }
}
```

`PistonClient.mapExecuteResponse` copies `data.compile` when present. Use case treats compile failure before interpreting run stage for grading.

Optional: pass `compile_timeout` later; **not required for v1.1** (Piston defaults).

---

## 7. SQL product behavior

- Engine: Piston **`sqlite3`** package.  
- API language id: **`sql`** (product-facing); aliases include `sqlite` / `sqlite3`.  
- Students **may create tables and write queries** in the same script or multi-file payload.  
- Each execution is **ephemeral** (no shared state across students/runs).  
- Expected output for judge mode: exact stdout dump as produced by the runtime (lesson authors format expected strings accordingly).  
- No SQL-specific judge in this release.

---

## 8. Operations: package install

### 8.1 Principles

- Packages are **not** installed by the Nest process.  
- Ops installs via Piston CLI `ppman` (or packages API) after Piston is healthy.  
- Pin versions discovered from the package index; document in runbook.

### 8.2 Install checklist (conceptual)

```bash
# Against running Piston (ops host / docker exec as documented)
ppman install python@<pinned>
ppman install c@<pinned>
ppman install c++@<pinned>
ppman install sqlite3@<pinned>
# javascript already required for v1
```

Verify:

```bash
curl -s "$PISTON_URL/api/v2/runtimes"
# expect python, c, c++, sqlite3, javascript entries
```

Then:

```bash
curl -s -H "Authorization: Bearer $API_KEY" "$API_URL/v1/runtimes"
# policy-filtered list includes the five languages when packages exist
```

### 8.3 Documentation updates

- Extend `docs/runbooks/` (client-integration and/or a dedicated `piston-languages.md`) with:  
  - pinned install commands  
  - example `POST /v1/execute` bodies per language  
  - note that SQL uses SQLite semantics  

---

## 9. Error catalog

| Situation | HTTP | Notes |
|-----------|------|--------|
| Unknown / disallowed language | 400 | List supported API ids |
| Validation (files, tests, limits) | 400 | Existing rules |
| ≥2 files missing `name` | 400 | See §4.4 |
| Piston down / timeout / 5xx | 503 | Fail closed |
| Student compile/runtime/wrong answer | 200 | `summary.success = false` + status |

---

## 10. Security

Unchanged principles from v1 design:

- Students never call this API with platform master keys  
- Piston not publicly exposed in production  
- Hidden tests: status only; no stdin/expected/actual/stderr leak  
- Untrusted code only executes inside Piston isolate  

Additional notes:

- SQL cannot access shared databases; only ephemeral SQLite in the sandbox  
- No new privileges required on the Nest API container  

---

## 11. Testing strategy

| Layer | Coverage |
|-------|----------|
| `LanguageRegistry` | All aliases; rejects unknown; lists ids |
| `Judge.buildSummary` | Priority includes `compile_error` |
| `ExecuteCodeUseCase` | Mock runner: python ok; C compile fail → `compile_error`; SQL judge; default filename; multi-file nameless → 400 |
| `PistonClient` | Maps compile failure and success+run |
| `ListRuntimesUseCase` | Multi-language filter |
| Optional local smoke | Real Piston with packages: one `run` per language |

Quality gate before merge: `npm run lint`, `npm run typecheck`, `npm test`.

---

## 12. Implementation workstreams (for planning)

### 12.1 Shared (blocking)

1. Introduce `src/domain/languages/*` registry; migrate JavaScript definition  
2. Wire DI (`ExecutionModule`) to registry  
3. Extend `CaseStatus` + Judge priority  
4. Extend `CodeRunOutput` + `PistonClient` compile mapping  
5. `ExecuteCodeUseCase`: piston language id, default filenames, compile_error mapping, error message allowlist  
6. Update Swagger strings  
7. Unit tests for plumbing  

### 12.2 Python pack

1. `definitions/python.ts`  
2. Registry unit cases  
3. Use-case example test  
4. Runbook install + sample payload  

### 12.3 C/C++ pack

1. `definitions/c.ts`, `definitions/cpp.ts`  
2. Compile-error unit tests (use case + client)  
3. Default `main.c` / `main.cpp` tests  
4. Runbook install for `c` and `c++`  

### 12.4 SQL pack

1. `definitions/sql.ts` (`pistonLanguage: 'sqlite3'`)  
2. Tests for alias `sql` / `sqlite3`  
3. Runbook: full script example with `CREATE TABLE` + `SELECT`  
4. Client integration notes  

### 12.5 Success criteria

- [ ] Five languages resolve and are documented  
- [ ] Python and SQL run/judge parity with JS path  
- [ ] C/C++ compile failures → `compile_error` on 200  
- [ ] Hidden tests do not leak compile/run I/O  
- [ ] Runbook has pinned `ppman` installs  
- [ ] lint + typecheck + unit tests pass  

---

## 13. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Piston package name/version drift | Pin versions in runbook; verify on deploy |
| `c++` vs `cpp` naming confusion | API id `cpp`; piston language `c++`; aliases cover both |
| Multi-file C without names | 400 when ≥2 files omit `name` |
| SQL stdout formatting surprises for authors | Document exact-match grading; authors freeze expected dumps |
| Parallel PR merge conflicts | Shared first; one definition file per language |

---

## 14. Open items closed during design

| Question | Resolution |
|----------|------------|
| SQL engine | SQLite via Piston |
| Student CREATE TABLE | Allowed |
| C vs C++ | Separate API languages |
| Compile UX | `compile_error` status; no top-level compile object |
| Judge compare | Exact stdout (existing Judge) |
| Package install | Documented pinned ppman |
| Delivery | Parallel worktrees after shared base |
| Implementation approach | Language registry (Approach B) |

---

## 15. Next step

After stakeholder review of this spec, produce an implementation plan via the writing-plans skill (`docs/superpowers/plans/…`) covering shared + three language packs and merge order.
`)
