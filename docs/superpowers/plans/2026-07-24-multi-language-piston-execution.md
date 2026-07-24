# Multi-Language Piston Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the Nest judge gateway from JavaScript-only to **javascript, python, c, cpp, and sql (SQLite)** via a language registry, compile-error mapping, and documented Piston package installs.

**Architecture:** Replace thin `LanguagePolicy` with a domain **LanguageRegistry** (per-language definition modules). Keep presentation → use cases → domain → `CodeRunnerPort` / `PistonClient`. Shared plumbing lands first; language packs only append definition files + tests + runbook sections. Parallel worktrees after Task 5 are safe for python / c-cpp / sql.

**Tech Stack:** NestJS 11, TypeScript, Jest, class-validator, Docker Compose, self-hosted Piston.

**Spec (source of truth):** [docs/superpowers/specs/2026-07-24-multi-language-piston-execution-design.md](../specs/2026-07-24-multi-language-piston-execution-design.md)

## Global Constraints

1. **Additive HTTP only** — same `POST /v1/execute` / `GET /v1/runtimes` shapes; new language values + `compile_error` status.
2. **No auto-install** of Piston packages on Nest boot.
3. **SQL = SQLite** (`pistonLanguage: 'sqlite3'`); full scripts including `CREATE TABLE` allowed.
4. **C and C++ are separate** API ids (`c`, `cpp`); Piston language for C++ is `c++`.
5. **Judging** stays newline-normalized exact stdout (`Judge.compare` unchanged except summary priority).
6. **Fail closed** — Piston 503 still rethrown in judge mode (do not invent grades).
7. **Hidden tests** still strip I/O including compile stderr.
8. **Quality gate per task:** `npm run lint && npm run typecheck && npm test` for touched areas; full suite before final merge.
9. **Do not commit secrets** or edit `.env` with real keys.
10. **YAGNI** — no Postgres, no SQL-aware compare, no short-circuit after compile_error, no top-level `compile` response field.

---

## File structure (target)

```text
src/domain/languages/
  types.ts                         # LanguageDefinition
  registry.ts                      # LanguageRegistry class
  registry.spec.ts
  definitions/
    javascript.ts
    python.ts
    c.ts
    cpp.ts
    sql.ts
    index.ts                       # ALL_DEFINITIONS array
  index.ts                         # re-exports

src/domain/language-policy.ts      # DELETE after migration (or thin re-export during one PR)
src/domain/language-policy.spec.ts # DELETE or replace with registry.spec.ts

src/domain/models/execute.models.ts          # CaseStatus += compile_error
src/domain/judge.ts                          # summary priority
src/domain/judge.spec.ts

src/application/ports/code-runner.port.ts    # CodeRunOutput.compile?
src/infrastructure/piston/piston.client.ts   # map compile stage
src/infrastructure/piston/piston.client.spec.ts

src/application/use-cases/execute-code.use-case.ts
src/application/use-cases/execute-code.use-case.spec.ts
src/application/use-cases/list-runtimes.use-case.ts
src/application/use-cases/list-runtimes.use-case.spec.ts

src/execution/execution.module.ts            # LanguageRegistry provider
src/presentation/http/execution.controller.ts  # swagger text
src/presentation/http/dto/execute.dto.ts       # swagger language description

docs/runbooks/piston-languages.md            # NEW — install + examples
docs/runbooks/client-integration.md          # multi-lang note
docs/reference/languages.md                  # mark shipped
docs/howtos/install-piston-runtimes.md       # pin commands
```

### Merge / worktree map

| Task range | Worktree suggestion | Owns |
|------------|---------------------|------|
| Tasks 1–5 | `feature/lang-registry-shared` | Registry, compile_error, client, use case |
| Task 6 | `feature/lang-python` | python definition + tests + runbook section |
| Task 7 | `feature/lang-c-cpp` | c + cpp + compile tests |
| Task 8 | `feature/lang-sql` | sql definition + tests + docs |
| Tasks 9–10 | shared or main branch | docs polish + final gate |

**Merge order:** Tasks 1–5 → then 6 ∥ 7 ∥ 8 → 9–10.

---

### Task 1: Language registry (types, JS definition, resolve API)

**Files:**
- Create: `src/domain/languages/types.ts`
- Create: `src/domain/languages/definitions/javascript.ts`
- Create: `src/domain/languages/definitions/index.ts`
- Create: `src/domain/languages/registry.ts`
- Create: `src/domain/languages/registry.spec.ts`
- Create: `src/domain/languages/index.ts`
- Delete after Task 5: `src/domain/language-policy.ts`, `src/domain/language-policy.spec.ts` (keep until DI switched)

**Interfaces:**
- Produces: `LanguageDefinition`, `LanguageRegistry` with:
  - `resolve(language: string): LanguageDefinition | null`
  - `isAllowed(language: string): boolean`
  - `listIds(): string[]`
  - `getById(id: string): LanguageDefinition | null`

- [ ] **Step 1: Write failing registry tests**

Create `src/domain/languages/registry.spec.ts`:

```typescript
import { LanguageRegistry } from './registry';

describe('LanguageRegistry', () => {
  const registry = new LanguageRegistry();

  describe('resolve', () => {
    it('resolves javascript aliases to definition id javascript', () => {
      expect(registry.resolve('javascript')?.id).toBe('javascript');
      expect(registry.resolve('js')?.id).toBe('javascript');
      expect(registry.resolve('node')?.id).toBe('javascript');
      expect(registry.resolve('node.js')?.id).toBe('javascript');
    });

    it('is case-insensitive and trims', () => {
      expect(registry.resolve('  JS  ')?.id).toBe('javascript');
    });

    it('returns null for unknown languages', () => {
      // Until Task 6 lands, python is not registered — this assertion will change after Task 6.
      // In Task 1 only register javascript; expect python null.
      expect(registry.resolve('python')).toBeNull();
      expect(registry.resolve('')).toBeNull();
    });

    it('exposes pistonLanguage and defaultFileName for javascript', () => {
      const def = registry.resolve('js');
      expect(def?.pistonLanguage).toBe('javascript');
      expect(def?.defaultFileName).toBe('main.js');
      expect(def?.hasCompileStage).toBe(false);
    });
  });

  describe('listIds', () => {
    it('includes javascript', () => {
      expect(registry.listIds()).toContain('javascript');
    });
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm test -- --testPathPatterns=domain/languages/registry.spec
```

Expected: FAIL (module not found)

- [ ] **Step 3: Implement types + javascript definition + registry**

`src/domain/languages/types.ts`:

```typescript
export type LanguageDefinition = {
  id: string;
  aliases: string[];
  pistonLanguage: string;
  defaultFileName: string;
  hasCompileStage: boolean;
};
```

`src/domain/languages/definitions/javascript.ts`:

```typescript
import type { LanguageDefinition } from '../types';

export const javascript: LanguageDefinition = {
  id: 'javascript',
  aliases: ['javascript', 'js', 'node', 'node.js'],
  pistonLanguage: 'javascript',
  defaultFileName: 'main.js',
  hasCompileStage: false,
};
```

`src/domain/languages/definitions/index.ts`:

```typescript
import type { LanguageDefinition } from '../types';
import { javascript } from './javascript';

/** Append new language definitions here (one import + one array entry per pack). */
export const ALL_DEFINITIONS: LanguageDefinition[] = [javascript];
```

`src/domain/languages/registry.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ALL_DEFINITIONS } from './definitions';
import type { LanguageDefinition } from './types';

@Injectable()
export class LanguageRegistry {
  private readonly byAlias = new Map<string, LanguageDefinition>();
  private readonly byId = new Map<string, LanguageDefinition>();

  constructor() {
    for (const def of ALL_DEFINITIONS) {
      this.byId.set(def.id, def);
      for (const alias of def.aliases) {
        this.byAlias.set(alias.toLowerCase(), def);
      }
    }
  }

  resolve(language: string): LanguageDefinition | null {
    const key = language.trim().toLowerCase();
    if (!key) return null;
    return this.byAlias.get(key) ?? null;
  }

  isAllowed(language: string): boolean {
    return this.resolve(language) !== null;
  }

  listIds(): string[] {
    return [...this.byId.keys()];
  }

  getById(id: string): LanguageDefinition | null {
    return this.byId.get(id) ?? null;
  }
}
```

`src/domain/languages/index.ts`:

```typescript
export type { LanguageDefinition } from './types';
export { LanguageRegistry } from './registry';
export { ALL_DEFINITIONS } from './definitions';
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test -- --testPathPatterns=domain/languages/registry.spec
```

- [ ] **Step 5: Commit**

```bash
git add src/domain/languages
git commit -m "feat: add LanguageRegistry with javascript definition"
```

---

### Task 2: Add `compile_error` to CaseStatus and Judge summary priority

**Files:**
- Modify: `src/domain/models/execute.models.ts`
- Modify: `src/domain/judge.ts`
- Modify: `src/domain/judge.spec.ts`

**Interfaces:**
- Produces: `CaseStatus` includes `'compile_error'`
- Produces: `Judge.buildSummary` priority  
  `internal_error > timeout > compile_error > runtime_error > wrong_answer`

- [ ] **Step 1: Write failing judge tests**

Add to `src/domain/judge.spec.ts`:

```typescript
it('prefers compile_error over runtime_error and wrong_answer', () => {
  const results = [
    {
      id: 'a',
      visibility: 'public' as const,
      passed: false,
      status: 'wrong_answer' as const,
    },
    {
      id: 'b',
      visibility: 'public' as const,
      passed: false,
      status: 'runtime_error' as const,
    },
    {
      id: 'c',
      visibility: 'public' as const,
      passed: false,
      status: 'compile_error' as const,
    },
  ];
  expect(judge.buildSummary(results).status).toBe('compile_error');
});

it('prefers timeout over compile_error', () => {
  const results = [
    {
      id: 'a',
      visibility: 'public' as const,
      passed: false,
      status: 'compile_error' as const,
    },
    {
      id: 'b',
      visibility: 'public' as const,
      passed: false,
      status: 'timeout' as const,
    },
  ];
  expect(judge.buildSummary(results).status).toBe('timeout');
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test -- --testPathPatterns=domain/judge.spec
```

Expected: type error or wrong status (compile_error not handled)

- [ ] **Step 3: Implement**

In `execute.models.ts`:

```typescript
export type CaseStatus =
  | 'ok'
  | 'wrong_answer'
  | 'runtime_error'
  | 'timeout'
  | 'compile_error'
  | 'internal_error';
```

In `judge.ts` `buildSummary`, inside `failed > 0` branch, after timeout check and before runtime_error:

```typescript
} else if (failedStatuses.includes('compile_error')) {
  status = 'compile_error';
} else if (failedStatuses.includes('runtime_error')) {
  status = 'runtime_error';
```

Full priority order in code:

```typescript
if (failedStatuses.includes('internal_error')) {
  status = 'internal_error';
} else if (failedStatuses.includes('timeout')) {
  status = 'timeout';
} else if (failedStatuses.includes('compile_error')) {
  status = 'compile_error';
} else if (failedStatuses.includes('runtime_error')) {
  status = 'runtime_error';
} else {
  status = 'wrong_answer';
}
```

- [ ] **Step 4: Run tests — PASS**

```bash
npm test -- --testPathPatterns=domain/judge.spec
```

- [ ] **Step 5: Commit**

```bash
git add src/domain/models/execute.models.ts src/domain/judge.ts src/domain/judge.spec.ts
git commit -m "feat: add compile_error status to judge summary priority"
```

---

### Task 3: Map Piston compile stage on CodeRunnerPort + PistonClient

**Files:**
- Modify: `src/application/ports/code-runner.port.ts`
- Modify: `src/infrastructure/piston/piston.client.ts`
- Modify: `src/infrastructure/piston/piston.client.spec.ts`

**Interfaces:**
- Produces: `CodeRunOutput.compile?: { stdout, stderr, code, signal, engineStatus }`
- Consumes: existing `PistonExecuteResponse.compile?`

- [ ] **Step 1: Write failing client test**

Add to `piston.client.spec.ts`:

```typescript
it('maps compile stage when present', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        language: 'c',
        version: '10.2.0',
        compile: {
          stdout: '',
          stderr: 'error: expected ;',
          code: 1,
          signal: null,
          status: null,
        },
        run: {
          stdout: '',
          stderr: '',
          code: null,
          signal: null,
          status: null,
        },
      }),
  });

  const client = new PistonClient();
  const res = await client.run({
    language: 'c',
    version: '*',
    files: [{ name: 'main.c', content: 'int main(){' }],
    stdin: '',
    runTimeoutMs: 3000,
  });

  expect(res.compile).toEqual({
    stdout: '',
    stderr: 'error: expected ;',
    code: 1,
    signal: null,
    engineStatus: null,
  });
  expect(res.language).toBe('c');
});
```

- [ ] **Step 2: Run test — expect FAIL** (compile undefined)

```bash
npm test -- --testPathPatterns=piston.client.spec
```

- [ ] **Step 3: Extend port + map response**

In `code-runner.port.ts`:

```typescript
export interface CodeRunStage {
  stdout: string;
  stderr: string;
  code: number | null;
  signal: string | null;
  engineStatus: string | null;
}

export interface CodeRunOutput {
  language: string;
  version: string;
  stdout: string;
  stderr: string;
  code: number | null;
  signal: string | null;
  engineStatus: string | null;
  /** Present when Piston returned a compile stage */
  compile?: CodeRunStage;
}
```

In `piston.client.ts` `mapExecuteResponse`:

```typescript
private mapExecuteResponse(data: PistonExecuteResponse): CodeRunOutput {
  const stage = data.run;
  const base: CodeRunOutput = {
    language: data.language,
    version: data.version,
    stdout: stage.stdout ?? '',
    stderr: stage.stderr ?? '',
    code: stage.code ?? null,
    signal: stage.signal ?? null,
    engineStatus: stage.status ?? null,
  };

  if (data.compile) {
    base.compile = {
      stdout: data.compile.stdout ?? '',
      stderr: data.compile.stderr ?? '',
      code: data.compile.code ?? null,
      signal: data.compile.signal ?? null,
      engineStatus: data.compile.status ?? null,
    };
  }

  return base;
}
```

- [ ] **Step 4: Run tests — PASS**

```bash
npm test -- --testPathPatterns=piston.client.spec
```

- [ ] **Step 5: Commit**

```bash
git add src/application/ports/code-runner.port.ts \
  src/infrastructure/piston/piston.client.ts \
  src/infrastructure/piston/piston.client.spec.ts
git commit -m "feat: map Piston compile stage on CodeRunOutput"
```

---

### Task 4: Wire LanguageRegistry into ExecuteCodeUseCase (defaults, piston id, compile_error)

**Files:**
- Modify: `src/application/use-cases/execute-code.use-case.ts`
- Modify: `src/application/use-cases/execute-code.use-case.spec.ts`
- Modify: `src/application/use-cases/list-runtimes.use-case.ts`
- Modify: `src/application/use-cases/list-runtimes.use-case.spec.ts`
- Modify: `src/execution/execution.module.ts`

**Interfaces:**
- Consumes: `LanguageRegistry.resolve` → definition
- Produces: runner called with `def.pistonLanguage`; default filename rules; compile failure → `compile_error`

**Default filename rules (spec §4.4):**
1. Count files with missing/empty `name`.
2. If count ≥ 2 → `BadRequestException` (`Multiple files missing name; provide files[].name for multi-file projects`).
3. If count === 1 → set that file’s `name` to `def.defaultFileName`.
4. If count === 0 → leave as-is.

**Compile failure detection:**

```typescript
function isCompileFailure(out: CodeRunOutput): boolean {
  if (!out.compile) return false;
  if (out.compile.code !== null && out.compile.code !== 0) return true;
  // treat non-null failure-like statuses if Piston sets them
  const st = out.compile.engineStatus;
  if (st && st !== 'OK' && st !== 'ok') return true;
  return false;
}

function compileStderr(out: CodeRunOutput): string {
  const c = out.compile!;
  return c.stderr || c.stdout || '';
}
```

- [ ] **Step 1: Rewrite use-case constructor dependency and failing tests**

Replace `LanguagePolicy` with `LanguageRegistry` in constructor and specs:

```typescript
import { LanguageRegistry } from '../../domain/languages';

function createUseCase(runner: CodeRunnerPort): ExecuteCodeUseCase {
  return new ExecuteCodeUseCase(
    runner,
    new Judge(),
    new VisibilityFilter(),
    new LanguageRegistry(),
  );
}
```

Add tests:

```typescript
it('sends pistonLanguage and applies default file name for javascript', async () => {
  const run = jest.fn().mockResolvedValue(okRun('3\n'));
  const uc = createUseCase({ run, listRuntimes: jest.fn() });

  await uc.execute({
    language: 'js',
    mode: 'run',
    files: [{ content: 'console.log(3)' }],
  });

  expect(run).toHaveBeenCalledWith(
    expect.objectContaining({
      language: 'javascript',
      files: [{ name: 'main.js', content: 'console.log(3)' }],
    }),
  );
});

it('rejects when two files omit name', async () => {
  const run = jest.fn();
  const uc = createUseCase({ run, listRuntimes: jest.fn() });

  await expect(
    uc.execute({
      language: 'javascript',
      mode: 'run',
      files: [{ content: 'a' }, { content: 'b' }],
    }),
  ).rejects.toThrow(BadRequestException);

  expect(run).not.toHaveBeenCalled();
});

it('maps compile failure to compile_error in run mode', async () => {
  const run = jest.fn().mockResolvedValue({
    language: 'c',
    version: '10.2.0',
    stdout: '',
    stderr: '',
    code: null,
    signal: null,
    engineStatus: null,
    compile: {
      stdout: '',
      stderr: 'error: expected ;',
      code: 1,
      signal: null,
      engineStatus: null,
    },
  });
  // Note: compile_error path needs c registered — if only JS in registry,
  // mock by temporarily using a language that is allowed and faking compile on JS,
  // OR land this test in Task 7 after c is registered.
  // Preferred for Task 4: force compile on javascript-allowed path:
  const uc = createUseCase({ run, listRuntimes: jest.fn() });
  const res = await uc.execute({
    language: 'javascript',
    mode: 'run',
    files: [{ name: 'main.js', content: 'x' }],
  });
  expect(res.summary.status).toBe('compile_error');
  expect(res.summary.success).toBe(false);
  expect(res.run?.stderr).toContain('error: expected ;');
});

it('error message lists supported language ids', async () => {
  const uc = createUseCase({ run: jest.fn(), listRuntimes: jest.fn() });
  await expect(
    uc.execute({ language: 'ruby', files: [{ content: '1' }] }),
  ).rejects.toThrow(/javascript/);
});
```

- [ ] **Step 2: Run use-case tests — expect FAIL**

```bash
npm test -- --testPathPatterns=execute-code.use-case.spec
```

- [ ] **Step 3: Implement use-case changes**

Key changes in `execute()`:

```typescript
const def = this.languages.resolve(input.language);
if (!def) {
  throw new BadRequestException(
    `Language not allowed. Supported: ${this.languages.listIds().join(', ')}`,
  );
}

const files = this.applyDefaultFileNames(input.files, def);

// when calling runner:
await this.runner.run({
  language: def.pistonLanguage,
  version,
  files,
  stdin: ...,
  runTimeoutMs,
});
```

```typescript
private applyDefaultFileNames(
  files: { name?: string; content: string }[],
  def: LanguageDefinition,
): { name?: string; content: string }[] {
  const missingIdx = files
    .map((f, i) => (!f.name || !f.name.trim() ? i : -1))
    .filter((i) => i >= 0);
  if (missingIdx.length >= 2) {
    throw new BadRequestException(
      'Multiple files missing name; provide files[].name for multi-file projects',
    );
  }
  return files.map((f, i) => {
    if (missingIdx.length === 1 && missingIdx[0] === i) {
      return { name: def.defaultFileName, content: f.content };
    }
    return {
      ...(f.name !== undefined ? { name: f.name } : {}),
      content: f.content,
    };
  });
}
```

In run mode after `runner.run`:

```typescript
if (isCompileFailure(out)) {
  const stderr = compileStderr(out);
  return {
    runId,
    language: out.language,
    version: out.version,
    summary: {
      passed: 0,
      failed: 0,
      total: 0,
      success: false,
      status: 'compile_error',
    },
    tests: [],
    run: {
      stdout: '',
      stderr,
      code: out.compile?.code ?? null,
      signal: out.compile?.signal ?? null,
    },
  };
}
```

In judge loop, before `mapEngineStatus` / compare:

```typescript
if (isCompileFailure(out)) {
  rawResults.push({
    id: t.id,
    visibility: t.visibility,
    passed: false,
    status: 'compile_error',
    stdin: t.stdin ?? '',
    expectedStdout: t.expectedStdout,
    actualStdout: '',
    stderr: compileStderr(out),
    exitCode: out.compile?.code ?? null,
  });
  continue;
}
```

Update `mapEngineStatus` only for run stage (compile handled above).

**ListRuntimesUseCase:** inject `LanguageRegistry`; filter with `isAllowed` on language or aliases (same logic as today).

**ExecutionModule:**

```typescript
providers: [
  ExecuteCodeUseCase,
  ListRuntimesUseCase,
  Judge,
  VisibilityFilter,
  LanguageRegistry,
],
```

- [ ] **Step 4: Update list-runtimes specs to use LanguageRegistry**

- [ ] **Step 5: Run tests**

```bash
npm test -- --testPathPatterns='execute-code.use-case|list-runtimes'
npm run typecheck
```

- [ ] **Step 6: Remove old LanguagePolicy files; fix any remaining imports**

```bash
# grep -r LanguagePolicy src
# delete language-policy.ts and .spec.ts when no references remain
```

- [ ] **Step 7: Commit**

```bash
git add src/application src/execution src/domain
git commit -m "feat: wire LanguageRegistry into execute/list runtimes with compile_error"
```

---

### Task 5: Swagger / DTO copy for multi-language (shared)

**Files:**
- Modify: `src/presentation/http/dto/execute.dto.ts` — language description
- Modify: `src/presentation/http/execution.controller.ts` — runtimes description

- [ ] **Step 1: Update descriptions**

`ExecuteDto.language`:

```typescript
@ApiProperty({
  example: 'javascript',
  description:
    'Language id or alias. Supported: javascript (js, node), python (python3, py), c, cpp (c++, cxx), sql (sqlite, sqlite3). Packs land progressively; unregistered ids return 400.',
})
```

Note: after Task 1 only JS works until packs land — description may list all planned ids once Task 6–8 complete, or say “see GET /v1/runtimes”. Prefer after all packs: list five.

Controller runtimes:

```typescript
description: 'Allowlisted runtimes installed on Piston (policy-filtered).',
```

- [ ] **Step 2: typecheck + lint**

```bash
npm run lint && npm run typecheck && npm test
```

- [ ] **Step 3: Commit**

```bash
git add src/presentation
git commit -m "docs: update Swagger copy for multi-language execute API"
```

**Checkpoint:** Shared branch is mergeable. Language packs (Tasks 6–8) can fork from here in parallel.

---

### Task 6: Python language pack

**Files:**
- Create: `src/domain/languages/definitions/python.ts`
- Modify: `src/domain/languages/definitions/index.ts` — import + array entry
- Modify: `src/domain/languages/registry.spec.ts` — python aliases
- Modify: `src/application/use-cases/execute-code.use-case.spec.ts` — python run path

**Interfaces:**
- Produces: definition `{ id: 'python', aliases: ['python','python3','py'], pistonLanguage: 'python', defaultFileName: 'main.py', hasCompileStage: false }`

- [ ] **Step 1: Failing tests for python aliases**

```typescript
it('resolves python aliases', () => {
  expect(registry.resolve('python')?.id).toBe('python');
  expect(registry.resolve('python3')?.pistonLanguage).toBe('python');
  expect(registry.resolve('py')?.defaultFileName).toBe('main.py');
});
```

```typescript
it('runs python via piston language python', async () => {
  const run = jest.fn().mockResolvedValue({
    language: 'python',
    version: '3.12.0',
    stdout: '1\n',
    stderr: '',
    code: 0,
    signal: null,
    engineStatus: null,
  });
  const uc = createUseCase({ run, listRuntimes: jest.fn() });
  const res = await uc.execute({
    language: 'py',
    mode: 'run',
    files: [{ content: 'print(1)' }],
  });
  expect(run).toHaveBeenCalledWith(
    expect.objectContaining({
      language: 'python',
      files: [{ name: 'main.py', content: 'print(1)' }],
    }),
  );
  expect(res.summary.success).toBe(true);
});
```

- [ ] **Step 2: Implement definition + register**

```typescript
// definitions/python.ts
export const python: LanguageDefinition = {
  id: 'python',
  aliases: ['python', 'python3', 'py'],
  pistonLanguage: 'python',
  defaultFileName: 'main.py',
  hasCompileStage: false,
};
```

In `definitions/index.ts`:

```typescript
import { python } from './python';
export const ALL_DEFINITIONS: LanguageDefinition[] = [javascript, python];
```

- [ ] **Step 3: Tests pass + commit**

```bash
npm test -- --testPathPatterns='registry.spec|execute-code.use-case'
git add src/domain/languages src/application/use-cases/execute-code.use-case.spec.ts
git commit -m "feat: allowlist python for piston execution"
```

---

### Task 7: C and C++ language pack + compile_error judge path

**Files:**
- Create: `src/domain/languages/definitions/c.ts`
- Create: `src/domain/languages/definitions/cpp.ts`
- Modify: `src/domain/languages/definitions/index.ts`
- Modify: `src/domain/languages/registry.spec.ts`
- Modify: `src/application/use-cases/execute-code.use-case.spec.ts`

**Interfaces:**
- `c`: piston `c`, `main.c`, `hasCompileStage: true`
- `cpp`: aliases `cpp`, `c++`, `cxx`; piston `c++`; `main.cpp`; compile true

- [ ] **Step 1: Registry + use-case tests**

```typescript
it('resolves c and cpp', () => {
  expect(registry.resolve('c')?.pistonLanguage).toBe('c');
  expect(registry.resolve('c++')?.id).toBe('cpp');
  expect(registry.resolve('cxx')?.defaultFileName).toBe('main.cpp');
  expect(registry.resolve('cpp')?.hasCompileStage).toBe(true);
});

it('judge mode records compile_error and continues other tests', async () => {
  const run = jest
    .fn()
    .mockResolvedValueOnce({
      language: 'c',
      version: '10.2.0',
      stdout: '',
      stderr: '',
      code: null,
      signal: null,
      engineStatus: null,
      compile: {
        stdout: '',
        stderr: 'error: syntax',
        code: 1,
        signal: null,
        engineStatus: null,
      },
    })
    .mockResolvedValueOnce({
      language: 'c',
      version: '10.2.0',
      stdout: '',
      stderr: '',
      code: null,
      signal: null,
      engineStatus: null,
      compile: {
        stdout: '',
        stderr: 'error: syntax',
        code: 1,
        signal: null,
        engineStatus: null,
      },
    });
  const uc = createUseCase({ run, listRuntimes: jest.fn() });
  const res = await uc.execute({
    language: 'c',
    files: [{ content: 'int main(){' }],
    tests: [
      { id: 't1', expectedStdout: '0', visibility: 'public' },
      { id: 't2', expectedStdout: '0', visibility: 'hidden' },
    ],
  });
  expect(res.summary.status).toBe('compile_error');
  expect(res.tests[0].status).toBe('compile_error');
  expect(res.tests[0].stderr).toContain('error: syntax');
  expect(res.tests[1].status).toBe('compile_error');
  // hidden strip
  expect(res.tests[1].stderr).toBeUndefined();
  expect(run).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 2: Implement definitions**

```typescript
export const c: LanguageDefinition = {
  id: 'c',
  aliases: ['c'],
  pistonLanguage: 'c',
  defaultFileName: 'main.c',
  hasCompileStage: true,
};

export const cpp: LanguageDefinition = {
  id: 'cpp',
  aliases: ['cpp', 'c++', 'cxx'],
  pistonLanguage: 'c++',
  defaultFileName: 'main.cpp',
  hasCompileStage: true,
};
```

Register both in `ALL_DEFINITIONS`.

- [ ] **Step 3: Tests + commit**

```bash
npm test
git add src/domain/languages src/application/use-cases/execute-code.use-case.spec.ts
git commit -m "feat: allowlist c and cpp with compile_error grading"
```

---

### Task 8: SQL language pack (SQLite)

**Files:**
- Create: `src/domain/languages/definitions/sql.ts`
- Modify: `src/domain/languages/definitions/index.ts`
- Modify: `src/domain/languages/registry.spec.ts`
- Modify: `src/application/use-cases/execute-code.use-case.spec.ts`

**Interfaces:**
- `sql` → piston `sqlite3`; aliases `sql`, `sqlite`, `sqlite3`; `main.sql`; no compile

- [ ] **Step 1: Tests**

```typescript
it('resolves sql to sqlite3 piston language', () => {
  expect(registry.resolve('sql')?.pistonLanguage).toBe('sqlite3');
  expect(registry.resolve('sqlite3')?.id).toBe('sql');
  expect(registry.resolve('sqlite')?.defaultFileName).toBe('main.sql');
});

it('runs sql via sqlite3', async () => {
  const run = jest.fn().mockResolvedValue({
    language: 'sqlite3',
    version: '3.x',
    stdout: '1\n',
    stderr: '',
    code: 0,
    signal: null,
    engineStatus: null,
  });
  const uc = createUseCase({ run, listRuntimes: jest.fn() });
  await uc.execute({
    language: 'sql',
    mode: 'run',
    files: [
      {
        content:
          'CREATE TABLE t(x INT); INSERT INTO t VALUES (1); SELECT x FROM t;',
      },
    ],
  });
  expect(run).toHaveBeenCalledWith(
    expect.objectContaining({
      language: 'sqlite3',
      files: [
        expect.objectContaining({
          name: 'main.sql',
        }),
      ],
    }),
  );
});
```

- [ ] **Step 2: Implement + register**

```typescript
export const sql: LanguageDefinition = {
  id: 'sql',
  aliases: ['sql', 'sqlite', 'sqlite3'],
  pistonLanguage: 'sqlite3',
  defaultFileName: 'main.sql',
  hasCompileStage: false,
};
```

- [ ] **Step 3: Tests + commit**

```bash
npm test
git add src/domain/languages src/application/use-cases/execute-code.use-case.spec.ts
git commit -m "feat: allowlist sql via sqlite3 piston package"
```

---

### Task 9: Ops + product documentation

**Files:**
- Create: `docs/runbooks/piston-languages.md`
- Modify: `docs/runbooks/client-integration.md` — languages section
- Modify: `docs/reference/languages.md` — mark five languages as shipped (when code is merged)
- Modify: `docs/howtos/install-piston-runtimes.md` — pin install commands
- Modify: `docs/README.md` — link piston-languages runbook
- Modify: `src/presentation/http/dto/execute.dto.ts` — final language description listing all five

- [ ] **Step 1: Write `docs/runbooks/piston-languages.md`**

Contents must include:

1. Install commands (placeholders for pins — ops fills versions after `ppman list`):

```bash
ppman install javascript@<pin>
ppman install python@<pin>
ppman install c@<pin>
ppman install c++@<pin>
ppman install sqlite3@<pin>
```

2. Verify via Piston `/api/v2/runtimes` and Nest `/v1/runtimes`
3. Example execute bodies for python, c, cpp, sql (CREATE TABLE + SELECT)
4. Note: exact stdout grading; SQL authors freeze dumps
5. Link to multi-language design spec

- [ ] **Step 2: Update client-integration language section from “JS only” to five languages + aliases table**

- [ ] **Step 3: Update reference languages shipped table**

- [ ] **Step 4: Commit**

```bash
git add docs src/presentation/http/dto/execute.dto.ts
git commit -m "docs: multi-language piston install and client examples"
```

---

### Task 10: Final quality gate

**Files:** none new (verification only)

- [ ] **Step 1: Full suite**

```bash
npm run lint
npm run typecheck
npm test
```

Expected: all pass.

- [ ] **Step 2: Grep hygiene**

```bash
# no remaining LanguagePolicy imports
grep -r LanguagePolicy src || true
# five definitions registered
grep -n "id:" src/domain/languages/definitions/*.ts
```

- [ ] **Step 3: Optional live smoke (if Piston + packages available)**

```bash
# after ppman installs
BASE=http://127.0.0.1:3000 API_KEY=dev-key-tutor ./scripts/smoke-execute.sh
# manual: POST execute language=python / c / sql
```

- [ ] **Step 4: Commit any leftover fixes; open PR if not already**

```bash
git status
# git push -u origin HEAD
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| Language registry / replace LanguagePolicy | 1, 4 |
| javascript, python, c, cpp, sql | 1, 6, 7, 8 |
| Aliases + pistonLanguage mapping | 1, 6–8 |
| Default file names + multi-missing-name 400 | 4 |
| `compile_error` status | 2, 4, 7 |
| Judge priority with compile_error | 2 |
| Piston compile stage on port/client | 3 |
| Fail closed 503 | unchanged (verify in existing tests) |
| SQL sqlite3 full scripts | 8, 9 |
| Exact stdout judge | no change to compare |
| ppman docs pinned | 9 |
| Swagger / runtimes copy | 5, 9 |
| Parallel packs via definitions/index | 6–8 |
| No auto-install, no Postgres, no SQL-aware judge | constraints |

**Placeholder scan:** none intentional — pin versions filled by ops at deploy time with `<pin>` marked explicitly.

**Type consistency:** `LanguageDefinition`, `LanguageRegistry`, `CodeRunStage`, `compile_error` used consistently across tasks.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-24-multi-language-piston-execution.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks; after Task 5, parallel subagents for Tasks 6–8 in git worktrees  
2. **Inline Execution** — execute tasks in this session with checkpoints  

Which approach?
