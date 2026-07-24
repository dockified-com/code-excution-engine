# Code Execution Platform — Subagent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (or dispatch one general-purpose subagent **per task** below). Steps use checkbox (`- [ ]`) syntax. Complete tasks **in order** unless noted parallel-safe. Do not start Task N+1 until Task N acceptance criteria pass.

**Goal:** Implement a production NestJS judge gateway in front of private Piston (JavaScript only) using **SRP + use-case pattern**, so product backends (AI Tutor, Dockified Lab, LMS) call `POST /v1/execute` with API keys.

**Architecture:** Thin HTTP controllers → use cases → pure domain (Judge, VisibilityFilter, LanguagePolicy) → `CodeRunnerPort` implemented by `PistonClient`. Piston runs in Docker and is never public in production.

**Tech Stack:** NestJS 11, TypeScript strict, Jest, class-validator, Docker Compose, Piston.

**Specs (read before coding):**

| Doc | Path |
|-----|------|
| Clear plan | `docs/superpowers/plans/2026-07-19-code-execution-clear-plan.md` |
| Design (esp. §3.3 use cases) | `docs/superpowers/specs/2026-07-19-piston-code-execution-design.md` |
| Ship checklist | `docs/runbooks/SHIP-FAST.md` |

## Global constraints (every subagent)

1. **Use-case pattern** — no god `ExecutionService`. Orchestration = `ExecuteCodeUseCase` / `ListRuntimesUseCase`.
2. **SRP** — controllers do not judge; Piston client does not compare stdout; domain has no `fetch`.
3. **v1 language** — only `javascript` (aliases `js`, `node`).
4. **Auth** — `Authorization: Bearer <key>` from env `API_KEYS` (comma-separated).
5. **YAGNI** — no queue, no Redis, no lab DB, no multi-language, no student JWT.
6. **Tests** — unit tests for domain + use cases + guard; mock the port, do not require live Piston except Task 9.
7. **Commits** — one logical commit per completed task (subagent: commit when acceptance passes).
8. **Do not** expose Piston publicly in compose comments for prod; local may bind `127.0.0.1:2000`.

## Target tree (create as you go)

```text
src/
  main.ts
  app.module.ts
  config/env.ts
  presentation/
    auth/api-key.guard.ts
    auth/api-key.guard.spec.ts
    auth/auth.module.ts
    http/dto/execute.dto.ts
    http/execution.controller.ts
    http/health.controller.ts
  application/
    ports/code-runner.port.ts
    use-cases/execute-code.use-case.ts
    use-cases/execute-code.use-case.spec.ts
    use-cases/list-runtimes.use-case.ts
    use-cases/list-runtimes.use-case.spec.ts
  domain/
    models/execute.models.ts
    judge.ts
    judge.spec.ts
    visibility-filter.ts
    visibility-filter.spec.ts
    language-policy.ts
    language-policy.spec.ts
  infrastructure/
    piston/piston.types.ts
    piston/piston.client.ts
    piston/piston.client.spec.ts
    piston/piston.module.ts
  execution/execution.module.ts
  health/health.module.ts
docker-compose.yml
Dockerfile
.dockerignore
.env.example
docker/piston/README.md
scripts/smoke-execute.sh
```

## Token for DI (Nest)

```typescript
// application/ports/code-runner.port.ts
export const CODE_RUNNER = Symbol('CODE_RUNNER');

export interface CodeRunnerPort {
  run(input: CodeRunInput): Promise<CodeRunOutput>;
  listRuntimes(): Promise<RunnerRuntime[]>;
}
```

`CodeRunInput` / `CodeRunOutput` / `RunnerRuntime` live in `domain/models` or next to the port — domain-facing, not Piston JSON.

---

### Task 1: Docker Compose + env scaffold

**Assignee notes:** Infrastructure only. No Nest business logic.  
**Parallel:** Can run alone first.  
**Depends on:** nothing  

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `docker/piston/README.md`
- Modify: `.gitignore` (ensure `.env`)

**Acceptance:**
- [ ] `.env.example` contains `PORT`, `PISTON_URL`, `API_KEYS`, `MAX_RUN_TIMEOUT_MS`, `MAX_FILES`, `MAX_FILE_BYTES`, `MAX_TESTS`, `PISTON_HTTP_TIMEOUT_MS`
- [ ] `docker-compose.yml` defines `piston` (privileged, volume) and optional `api` stub section
- [ ] Piston port published only as `127.0.0.1:2000:2000` with comment “local debug only”
- [ ] `docker/piston/README.md` documents JS install via ppman
- [ ] Commit: `chore: add Docker Compose and env for private Piston`

**Steps:**
- [ ] Write files per clear plan / design §4
- [ ] `grep -q '^\.env$' .gitignore || echo '.env' >> .gitignore`
- [ ] `docker compose up -d piston` (if Docker available); note in commit if skipped
- [ ] Commit

---

### Task 2: Config helpers + API key guard

**Depends on:** Task 1 (env names only)  
**Parallel-safe with:** Task 3 (domain) after Task 1  

**Files:**
- Create: `src/config/env.ts`
- Create: `src/presentation/auth/api-key.guard.ts`
- Create: `src/presentation/auth/api-key.guard.spec.ts`
- Create: `src/presentation/auth/auth.module.ts`
- Run: `npm install @nestjs/config` if missing

**Interfaces produced:**
```typescript
getApiKeys(): string[]
getPistonUrl(): string
getMaxRunTimeoutMs(): number
getMaxFiles(): number
getMaxFileBytes(): number
getMaxTests(): number
getPistonHttpTimeoutMs(): number

class ApiKeyGuard implements CanActivate  // sets req.clientId = key on success
```

**Acceptance:**
- [ ] Guard allows `Bearer` key present in `API_KEYS`
- [ ] Guard throws `UnauthorizedException` if missing/wrong
- [ ] `npx jest src/presentation/auth/api-key.guard.spec.ts` PASS
- [ ] Commit: `feat: add API key guard and env config`

**Steps:**
- [ ] Write failing guard tests
- [ ] Implement env + guard + AuthModule
- [ ] Tests green
- [ ] Commit

---

### Task 3: Domain layer (Judge, VisibilityFilter, LanguagePolicy)

**Depends on:** nothing (pure TS)  
**Parallel-safe with:** Task 2  

**Files:**
- Create: `src/domain/models/execute.models.ts`
- Create: `src/domain/judge.ts` + `judge.spec.ts`
- Create: `src/domain/visibility-filter.ts` + `visibility-filter.spec.ts`
- Create: `src/domain/language-policy.ts` + `language-policy.spec.ts`

**Models (minimum):**
```typescript
export type TestVisibility = 'public' | 'hidden';
export type CaseStatus =
  | 'ok'
  | 'wrong_answer'
  | 'runtime_error'
  | 'timeout'
  | 'internal_error';

export interface TestCaseResult {
  id: string;
  visibility: TestVisibility;
  passed: boolean;
  status: CaseStatus;
  stdin?: string;
  expectedStdout?: string;
  actualStdout?: string;
  stderr?: string;
  exitCode?: number | null;
}

export interface ExecuteSummary {
  passed: number;
  failed: number;
  total: number;
  success: boolean;
  status: CaseStatus | 'ok';
}
```

**Domain APIs:**
```typescript
// Judge
normalizeStdout(s: string): string  // strip trailing newlines
compare(actual: string, expected: string): boolean
buildSummary(results: TestCaseResult[]): ExecuteSummary

// VisibilityFilter
filter(results: TestCaseResult[]): TestCaseResult[]  // hidden: only id, visibility, passed, status

// LanguagePolicy
resolve(language: string): string | null  // 'javascript' | null for js/node/javascript
isAllowed(language: string): boolean
```

**Acceptance:**
- [ ] All domain unit tests PASS
- [ ] No imports from `@nestjs/*` or `fetch` in `src/domain/**`
- [ ] Commit: `feat: add domain judge, visibility filter, language policy`

---

### Task 4: CodeRunnerPort + Piston adapter

**Depends on:** Task 3 (models for run I/O — or define run types in port file)  
**Files:**
- Create: `src/application/ports/code-runner.port.ts`
- Create: `src/infrastructure/piston/piston.types.ts`
- Create: `src/infrastructure/piston/piston.client.ts`
- Create: `src/infrastructure/piston/piston.client.spec.ts`
- Create: `src/infrastructure/piston/piston.module.ts`

**Port contract:**
```typescript
export interface CodeRunInput {
  language: string;
  version: string;
  files: { name?: string; content: string }[];
  stdin: string;
  runTimeoutMs: number;
}

export interface CodeRunOutput {
  language: string;
  version: string;
  stdout: string;
  stderr: string;
  code: number | null;
  signal: string | null;
  engineStatus: string | null; // Piston status TO/RE/SG/… or null
}

export interface RunnerRuntime {
  language: string;
  version: string;
  aliases: string[];
}

export interface CodeRunnerPort {
  run(input: CodeRunInput): Promise<CodeRunOutput>;
  listRuntimes(): Promise<RunnerRuntime[]>;
}

export const CODE_RUNNER = Symbol('CODE_RUNNER');
```

**PistonClient:**
- `POST {PISTON_URL}/api/v2/execute`
- `GET {PISTON_URL}/api/v2/runtimes`
- Map wire JSON → `CodeRunOutput`
- On network/HTTP failure: throw `ServiceUnavailableException` (Nest) **or** a domain-neutral error class that use case maps to 503 — prefer Nest exception only in infrastructure if Nest is already a dep

**Acceptance:**
- [ ] Unit test mocks `global.fetch` and asserts URL + mapped stdout
- [ ] `PistonModule` provides `{ provide: CODE_RUNNER, useClass: PistonClient }`
- [ ] Commit: `feat: add CodeRunnerPort and Piston client adapter`

---

### Task 5: ExecuteCodeUseCase + ListRuntimesUseCase

**Depends on:** Task 3, Task 4  
**Files:**
- Create: `src/application/use-cases/execute-code.use-case.ts`
- Create: `src/application/use-cases/execute-code.use-case.spec.ts`
- Create: `src/application/use-cases/list-runtimes.use-case.ts`
- Create: `src/application/use-cases/list-runtimes.use-case.spec.ts`

**ExecuteCodeInput (application):**
```typescript
{
  language: string;
  version?: string;
  files: { name?: string; content: string }[];
  tests?: {
    id: string;
    stdin?: string;
    expectedStdout?: string;
    visibility: 'public' | 'hidden';
  }[];
  mode?: 'judge' | 'run';
  stdin?: string;
  limits?: { runTimeoutMs?: number };
  context?: { enrollmentId?: string; lessonId?: string; labType?: string };
}
```

**Behavior:**
1. Resolve language via `LanguagePolicy`; if null → `BadRequestException`
2. Enforce max files / file bytes / max tests from env helpers
3. `mode`: default `judge` if tests non-empty, else `run`
4. **run:** single `runner.run` → return `run` payload + summary success from exit code
5. **judge:** each test → `runner.run` with test stdin → map engine status → `Judge.compare` → collect `TestCaseResult` → `buildSummary` → `VisibilityFilter.filter`
6. Generate `runId` (uuid)
7. Log JSON: `runId`, mode, language, summary, context ids (not full hidden expected)

**ListRuntimesUseCase:**
- Call `runner.listRuntimes()`, filter to JS via `LanguagePolicy` / language name + aliases

**Acceptance:**
- [ ] Use-case tests use **mock `CodeRunnerPort`**, not real Piston
- [ ] Hidden results have no `actualStdout` / `expectedStdout` after filter
- [ ] Unknown language throws BadRequest
- [ ] Commit: `feat: add ExecuteCode and ListRuntimes use cases`

---

### Task 6: DTOs + ExecutionController + Health

**Depends on:** Task 2, Task 5  
**Files:**
- Create: `src/presentation/http/dto/execute.dto.ts`
- Create: `src/presentation/http/execution.controller.ts`
- Create: `src/presentation/http/health.controller.ts`
- Create: `src/health/health.module.ts`
- Create: `src/execution/execution.module.ts`
- Modify: `src/app.module.ts`
- Modify: `src/main.ts` (global ValidationPipe)
- Run: `npm install class-validator class-transformer` if missing

**Controller rules:**
- `@Controller('v1')` + `@UseGuards(ApiKeyGuard)`
- `POST execute` → map DTO → `ExecuteCodeUseCase.execute`
- `GET runtimes` → `ListRuntimesUseCase.execute`
- **No** judge/Piston logic in controller

**ExecutionModule providers:**
- Use cases, Judge, VisibilityFilter, LanguagePolicy
- Import `PistonModule`, `AuthModule`

**Acceptance:**
- [ ] `npm run build` succeeds
- [ ] Routes exist: `POST /v1/execute`, `GET /v1/runtimes`, `GET /health`
- [ ] Commit: `feat: wire HTTP presentation and modules for execute API`

---

### Task 7: App polish + unit suite green

**Depends on:** Task 6  
**Files:** any fixes; optional remove or keep Hello World route  

**Acceptance:**
- [ ] `npm test` all PASS (or document skipped e2e if no app e2e update)
- [ ] `npm run build` PASS
- [ ] No circular deps between domain and infrastructure
- [ ] Commit: `test: ensure execution platform unit suite passes`

---

### Task 8: Dockerfile for API

**Depends on:** Task 6  
**Files:**
- Create: `Dockerfile` (multi-stage node:20-alpine)
- Create: `.dockerignore`
- Update: `docker-compose.yml` `api` service build if needed

**Acceptance:**
- [ ] `docker compose build api` works (if Docker available)
- [ ] Commit: `chore: containerize Nest judge API`

---

### Task 9: Smoke with real Piston (human or agent with Docker)

**Depends on:** Task 1, 6, 7  
**Files:**
- Create: `scripts/smoke-execute.sh` (executable)

**Steps:**
- [ ] Start Piston; install javascript runtime (see `docker/piston/README.md`)
- [ ] Run Nest with `PISTON_URL=http://127.0.0.1:2000` and `API_KEYS=dev-key-tutor`
- [ ] Smoke: health, execute judge public+hidden, 401 without key
- [ ] Commit: `chore: add smoke script for code execution API`

**Acceptance:**
- [ ] Script exits 0 against local stack
- [ ] Hidden test fields absent in JSON for failed hidden case

---

### Task 10: Client integration runbook

**Depends on:** Task 6  
**Files:**
- Create: `docs/runbooks/client-integration.md`

**Content:**
- Auth header
- Example run vs judge payloads
- Rule: server-side keys only
- Endpoint list

**Acceptance:**
- [ ] Doc committed: `docs: add client integration for code execution API`

---

## Subagent dispatch guide

| Order | Task | Suggested subagent focus |
|-------|------|---------------------------|
| 1 | Task 1 | Docker/env only |
| 2a | Task 2 | Auth/config |
| 2b | Task 3 | Domain pure (can parallel with 2) |
| 3 | Task 4 | Piston adapter |
| 4 | Task 5 | Use cases |
| 5 | Task 6 | HTTP wiring |
| 6 | Task 7 | Stabilize tests |
| 7 | Task 8 | Dockerfile |
| 8 | Task 9 | Smoke (needs Docker) |
| 9 | Task 10 | Docs only |

**Orchestrator rules:**
1. Give each subagent: this plan path + task number + global constraints + “do not expand scope.”
2. After each task: run that task’s acceptance commands; fix before next.
3. If Task 9 fails on missing JS runtime, fix ops docs / install — do not weaken judge logic.
4. Prefer `feature-dev:code-reviewer` or PR review only after Task 7+.

## Definition of done (whole feature)

- [ ] All tasks 1–10 complete (9 may be “blocked on Docker” with script still present)
- [ ] Use-case layout present (no fat execution service)
- [ ] `POST /v1/execute` + API key + public/hidden filtering
- [ ] Piston private by design
- [ ] Unit tests for domain + use cases + guard
- [ ] Smoke path documented

## Out of scope (reject if subagent adds)

- Queue / Bull / Redis  
- Lab CRUD / harness storage  
- Python or other languages  
- Student JWT on this service  
- Exposing Piston without Nest  
- Frontend Monaco work  

---

## Prompt template for each subagent

```text
Implement ONLY Task N from:
docs/superpowers/plans/2026-07-19-code-execution-subagent-impl.md

Read Global constraints and that task’s Files, Interfaces, Acceptance.
Follow SRP + use-case architecture from the design doc.
Write/run the tests listed. Commit when acceptance passes.
Do not implement other tasks. Do not refactor unrelated code.
```
