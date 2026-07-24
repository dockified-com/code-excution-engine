# Code Execution API + Piston — Ship-Fast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a production-usable NestJS judge gateway in front of private Piston (JS only) so AI Tutor, Dockified Lab, and LMS backends can call `POST /v1/execute` with API keys.

**Architecture:** Nest validates API keys, runs student `files` against each test via private Piston, compares stdout, and returns sanitized public/hidden results. Piston is Docker-only and never public. No lab storage in v1 (pass-through judge).

**Tech Stack:** NestJS 11, TypeScript strict, Jest, Docker Compose, Piston (`ghcr.io/engineer-man/piston`), Node 20+ fetch/undici for Piston HTTP.

**Design spec:** [docs/superpowers/specs/2026-07-19-piston-code-execution-design.md](../specs/2026-07-19-piston-code-execution-design.md)

## Global Constraints

- Language allowlist v1: `javascript` only (aliases: `js`, `node` map to javascript)
- Piston URL default: `http://piston:2000` (local dev may use `http://127.0.0.1:2000`)
- Auth: `Authorization: Bearer <api_key>`; keys from env `API_KEYS` (comma-separated plain keys for v1 ship)
- Never publish Piston port on production compose; dev may bind `127.0.0.1:2000`
- Business WA/TLE/RE → HTTP 200 + structured `summary`; auth/validation → 401/400; Piston down → 503
- YAGNI: no Redis, no queue, no lab CRUD, no multi-language, no JWT student auth on this service
- Prefer small files; module layout under `src/execution`, `src/piston`, `src/auth`, `src/health`
- Tests: unit first for judge + filter; mock Piston client; one manual smoke with real Piston

## Architecture constraint (all tasks)

Use **single responsibility + use-case pattern** (see design §3.3 and clear plan §9):

- Controllers: HTTP only  
- **Use cases**: `ExecuteCodeUseCase`, `ListRuntimesUseCase` (orchestration)  
- **Domain**: `Judge`, `VisibilityFilter`, `LanguagePolicy` (no I/O)  
- **Port**: `CodeRunnerPort` ← implemented by `PistonClient`  
- Do **not** put judge logic in the controller or Piston client  

## File map (create / modify)

| Path | Responsibility |
|------|----------------|
| `docker-compose.yml` | `api` + private `piston` |
| `.env.example` | `PORT`, `PISTON_URL`, `API_KEYS`, limits |
| `src/main.ts` | Bootstrap, global validation pipe |
| `src/app.module.ts` | Import feature modules |
| `src/config/env.ts` | Env helpers |
| `src/presentation/auth/api-key.guard.ts` | Bearer key check |
| `src/presentation/auth/auth.module.ts` | Guard provider |
| `src/presentation/http/dto/execute.dto.ts` | Request DTO |
| `src/presentation/http/execution.controller.ts` | HTTP routes only |
| `src/presentation/http/health.controller.ts` | `GET /health` |
| `src/application/ports/code-runner.port.ts` | Runner interface |
| `src/application/use-cases/execute-code.use-case.ts` | Run + judge orchestration |
| `src/application/use-cases/list-runtimes.use-case.ts` | List allowlisted runtimes |
| `src/domain/judge.ts` | Normalize + compare + summary |
| `src/domain/visibility-filter.ts` | Strip hidden I/O |
| `src/domain/language-policy.ts` | JS allowlist / aliases |
| `src/domain/models/execute.models.ts` | Domain types |
| `src/infrastructure/piston/piston.client.ts` | Implements `CodeRunnerPort` |
| `src/infrastructure/piston/piston.types.ts` | Piston wire types |
| `src/infrastructure/piston/piston.module.ts` | Bind port → client |
| `src/execution/execution.module.ts` | Wire presentation + use cases + domain |
| Unit specs next to domain / use cases | Judge, filter, use case, guard |

> Path aliases: if the team prefers `src/execution/{domain,application,...}` feature folders, keep the **same layer boundaries**; do not collapse into one god service.

---


### Task 1: Docker Compose + env for private Piston

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `docker/piston/README.md` (install JS runtime steps)
- Modify: `.gitignore` (ensure `.env` ignored)

**Interfaces:**
- Produces: Compose service names `api`, `piston`; env `PISTON_URL=http://piston:2000`

- [ ] **Step 1: Add `.env.example`**

```env
PORT=3000
PISTON_URL=http://piston:2000
API_KEYS=dev-key-tutor,dev-key-lab
MAX_RUN_TIMEOUT_MS=3000
MAX_FILES=20
MAX_FILE_BYTES=100000
MAX_TESTS=50
PISTON_HTTP_TIMEOUT_MS=15000
```

- [ ] **Step 2: Add `docker-compose.yml`**

```yaml
services:
  piston:
    image: ghcr.io/engineer-man/piston:latest
    privileged: true
    volumes:
      - piston-data:/piston
    # Production: do NOT publish ports.
    # Local debug only — comment out in shared/staging/prod:
    ports:
      - "127.0.0.1:2000:2000"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://127.0.0.1:2000/api/v2/runtimes"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 20s

  api:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env
    environment:
      PISTON_URL: http://piston:2000
    depends_on:
      piston:
        condition: service_started
    restart: unless-stopped

volumes:
  piston-data:
```

Note: Nest `Dockerfile` is Task 8. Until then, run Nest on host against `PISTON_URL=http://127.0.0.1:2000`.

- [ ] **Step 3: Add `docker/piston/README.md` with JS install**

```markdown
# Piston JS runtime

1. Start piston: `docker compose up -d piston`
2. Clone Piston CLI once (or use container exec per upstream docs):
   - `cli/index.js ppman install javascript`
3. Verify: `curl -s http://127.0.0.1:2000/api/v2/runtimes | jq .`
```

- [ ] **Step 4: Ensure `.env` is gitignored; copy example**

```bash
grep -q '^\.env$' .gitignore || echo '.env' >> .gitignore
cp .env.example .env
```

- [ ] **Step 5: Start Piston only and verify API responds**

```bash
docker compose up -d piston
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:2000/api/v2/runtimes
```

Expected: `200` (body may be `[]` until JS installed).

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml .env.example docker/piston/README.md .gitignore
git commit -m "chore: add Docker Compose for private Piston"
```

---

### Task 2: Config + API key guard

**Files:**
- Create: `src/config/env.ts`
- Create: `src/auth/api-key.guard.ts`
- Create: `src/auth/api-key.guard.spec.ts`
- Create: `src/auth/auth.module.ts`
- Modify: `package.json` (add `@nestjs/config` if missing)

**Interfaces:**
- Produces: `ApiKeyGuard` — rejects missing/invalid Bearer tokens
- Produces: `getApiKeys(): string[]` from `API_KEYS` env

- [ ] **Step 1: Install config dependency**

```bash
npm install @nestjs/config
```

- [ ] **Step 2: Write failing guard test `src/auth/api-key.guard.spec.ts`**

```typescript
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';

function mockContext(authHeader?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: { authorization: authHeader },
      }),
    }),
  } as ExecutionContext;
}

describe('ApiKeyGuard', () => {
  const original = process.env.API_KEYS;

  beforeEach(() => {
    process.env.API_KEYS = 'secret-a,secret-b';
  });

  afterAll(() => {
    process.env.API_KEYS = original;
  });

  it('allows valid bearer key', () => {
    const guard = new ApiKeyGuard();
    expect(guard.canActivate(mockContext('Bearer secret-a'))).toBe(true);
  });

  it('rejects missing header', () => {
    const guard = new ApiKeyGuard();
    expect(() => guard.canActivate(mockContext(undefined))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects wrong key', () => {
    const guard = new ApiKeyGuard();
    expect(() => guard.canActivate(mockContext('Bearer nope'))).toThrow(
      UnauthorizedException,
    );
  });
});
```

- [ ] **Step 3: Run test — expect FAIL (module missing)**

```bash
npx jest src/auth/api-key.guard.spec.ts --no-cache
```

Expected: FAIL cannot find module `./api-key.guard`

- [ ] **Step 4: Implement `src/config/env.ts` and guard**

```typescript
// src/config/env.ts
export function getApiKeys(): string[] {
  return (process.env.API_KEYS ?? '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

export function getPistonUrl(): string {
  return process.env.PISTON_URL ?? 'http://127.0.0.1:2000';
}

export function getMaxRunTimeoutMs(): number {
  return Number(process.env.MAX_RUN_TIMEOUT_MS ?? 3000);
}

export function getMaxFiles(): number {
  return Number(process.env.MAX_FILES ?? 20);
}

export function getMaxFileBytes(): number {
  return Number(process.env.MAX_FILE_BYTES ?? 100_000);
}

export function getMaxTests(): number {
  return Number(process.env.MAX_TESTS ?? 50);
}

export function getPistonHttpTimeoutMs(): number {
  return Number(process.env.PISTON_HTTP_TIMEOUT_MS ?? 15_000);
}
```

```typescript
// src/auth/api-key.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { getApiKeys } from '../config/env';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      clientId?: string;
    }>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }
    const key = header.slice('Bearer '.length).trim();
    const keys = getApiKeys();
    if (!keys.length || !keys.includes(key)) {
      throw new UnauthorizedException('Invalid API key');
    }
    req.clientId = key;
    return true;
  }
}
```

```typescript
// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';

@Module({
  providers: [ApiKeyGuard],
  exports: [ApiKeyGuard],
})
export class AuthModule {}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
npx jest src/auth/api-key.guard.spec.ts --no-cache
```

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/config src/auth
git commit -m "feat: add API key guard and env helpers"
```

---

### Task 3: Judge + response filter (pure logic)

**Files:**
- Create: `src/execution/types.ts`
- Create: `src/execution/judge.service.ts`
- Create: `src/execution/judge.service.spec.ts`
- Create: `src/execution/response-filter.service.ts`
- Create: `src/execution/response-filter.service.spec.ts`

**Interfaces:**
- Produces:
  - `normalizeStdout(s: string): string` — trim trailing newlines
  - `JudgeService.compare(actual, expected): boolean`
  - `JudgeService.buildSummary(results): ExecuteSummary`
  - `ResponseFilterService.filter(results): PublicTestResult[]`

- [ ] **Step 1: Write types `src/execution/types.ts`**

```typescript
export type TestVisibility = 'public' | 'hidden';
export type TestStatus =
  | 'ok'
  | 'wrong_answer'
  | 'runtime_error'
  | 'timeout'
  | 'internal_error';

export interface TestCaseInput {
  id: string;
  stdin?: string;
  expectedStdout?: string;
  visibility: TestVisibility;
}

export interface TestCaseResult {
  id: string;
  visibility: TestVisibility;
  passed: boolean;
  status: TestStatus;
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
  status: TestStatus | 'ok';
}

export interface ExecuteResponse {
  runId: string;
  language: string;
  version: string;
  summary: ExecuteSummary;
  tests: TestCaseResult[];
  run: {
    stdout: string;
    stderr: string;
    code: number | null;
    signal: string | null;
  } | null;
}
```

- [ ] **Step 2: Write failing tests for normalize/compare/summary and filter**

```typescript
// src/execution/judge.service.spec.ts
import { JudgeService } from './judge.service';
import { TestCaseResult } from './types';

describe('JudgeService', () => {
  const judge = new JudgeService();

  it('normalizes trailing newlines', () => {
    expect(judge.normalizeStdout('hello\n')).toBe('hello');
    expect(judge.normalizeStdout('hello\n\n')).toBe('hello');
  });

  it('compares equal normalized stdout', () => {
    expect(judge.compare('3\n', '3')).toBe(true);
    expect(judge.compare('3', '4')).toBe(false);
  });

  it('builds summary', () => {
    const tests: TestCaseResult[] = [
      {
        id: '1',
        visibility: 'public',
        passed: true,
        status: 'ok',
      },
      {
        id: '2',
        visibility: 'hidden',
        passed: false,
        status: 'wrong_answer',
      },
    ];
    const s = judge.buildSummary(tests);
    expect(s).toEqual({
      passed: 1,
      failed: 1,
      total: 2,
      success: false,
      status: 'wrong_answer',
    });
  });
});
```

```typescript
// src/execution/response-filter.service.spec.ts
import { ResponseFilterService } from './response-filter.service';
import { TestCaseResult } from './types';

describe('ResponseFilterService', () => {
  const filter = new ResponseFilterService();

  it('keeps I/O for public tests', () => {
    const input: TestCaseResult[] = [
      {
        id: 'p',
        visibility: 'public',
        passed: false,
        status: 'wrong_answer',
        stdin: '1',
        expectedStdout: '2',
        actualStdout: '3',
        stderr: '',
        exitCode: 0,
      },
    ];
    const out = filter.filter(input);
    expect(out[0].stdin).toBe('1');
    expect(out[0].expectedStdout).toBe('2');
    expect(out[0].actualStdout).toBe('3');
  });

  it('strips I/O for hidden tests', () => {
    const input: TestCaseResult[] = [
      {
        id: 'h',
        visibility: 'hidden',
        passed: false,
        status: 'wrong_answer',
        stdin: 'secret',
        expectedStdout: 'x',
        actualStdout: 'y',
        stderr: 'err',
        exitCode: 1,
      },
    ];
    const out = filter.filter(input);
    expect(out[0]).toEqual({
      id: 'h',
      visibility: 'hidden',
      passed: false,
      status: 'wrong_answer',
    });
  });
});
```

- [ ] **Step 3: Run tests — expect FAIL**

```bash
npx jest src/execution/judge.service.spec.ts src/execution/response-filter.service.spec.ts --no-cache
```

- [ ] **Step 4: Implement services**

```typescript
// src/execution/judge.service.ts
import { Injectable } from '@nestjs/common';
import { ExecuteSummary, TestCaseResult, TestStatus } from './types';

@Injectable()
export class JudgeService {
  normalizeStdout(s: string): string {
    return s.replace(/\n+$/g, '');
  }

  compare(actual: string, expected: string): boolean {
    return this.normalizeStdout(actual) === this.normalizeStdout(expected);
  }

  buildSummary(tests: TestCaseResult[]): ExecuteSummary {
    const passed = tests.filter((t) => t.passed).length;
    const failed = tests.length - passed;
    let status: TestStatus | 'ok' = 'ok';
    if (failed > 0) {
      const failedStatuses = tests.filter((t) => !t.passed).map((t) => t.status);
      if (failedStatuses.includes('internal_error')) status = 'internal_error';
      else if (failedStatuses.includes('timeout')) status = 'timeout';
      else if (failedStatuses.includes('runtime_error')) status = 'runtime_error';
      else status = 'wrong_answer';
    }
    return {
      passed,
      failed,
      total: tests.length,
      success: failed === 0 && tests.length > 0,
      status: tests.length === 0 ? 'ok' : status,
    };
  }
}
```

```typescript
// src/execution/response-filter.service.ts
import { Injectable } from '@nestjs/common';
import { TestCaseResult } from './types';

@Injectable()
export class ResponseFilterService {
  filter(results: TestCaseResult[]): TestCaseResult[] {
    return results.map((r) => {
      if (r.visibility === 'public') {
        return { ...r };
      }
      return {
        id: r.id,
        visibility: r.visibility,
        passed: r.passed,
        status: r.status,
      };
    });
  }
}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
npx jest src/execution/judge.service.spec.ts src/execution/response-filter.service.spec.ts --no-cache
```

- [ ] **Step 6: Commit**

```bash
git add src/execution
git commit -m "feat: add judge compare and hidden test response filter"
```

---

### Task 4: Piston HTTP client

**Files:**
- Create: `src/piston/piston.types.ts`
- Create: `src/piston/piston.client.ts`
- Create: `src/piston/piston.client.spec.ts`
- Create: `src/piston/piston.module.ts`

**Interfaces:**
- Produces: `PistonClient.execute(input): Promise<PistonExecuteResponse>`
- Produces: `PistonClient.runtimes(): Promise<PistonRuntime[]>`
- On network failure: throw error with message; ExecutionService maps to 503

- [ ] **Step 1: Types**

```typescript
// src/piston/piston.types.ts
export interface PistonFile {
  name?: string;
  content: string;
}

export interface PistonExecuteRequest {
  language: string;
  version: string;
  files: PistonFile[];
  stdin?: string;
  run_timeout?: number;
  compile_timeout?: number;
}

export interface PistonStageResult {
  stdout: string;
  stderr: string;
  output?: string;
  code: number | null;
  signal: string | null;
  message?: string | null;
  status?: string | null;
  cpu_time?: number;
  wall_time?: number;
  memory?: number;
}

export interface PistonExecuteResponse {
  language: string;
  version: string;
  run: PistonStageResult;
  compile?: PistonStageResult;
}

export interface PistonRuntime {
  language: string;
  version: string;
  aliases: string[];
}
```

- [ ] **Step 2: Failing unit test with mocked fetch**

```typescript
// src/piston/piston.client.spec.ts
import { PistonClient } from './piston.client';

describe('PistonClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('posts execute and returns JSON', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        language: 'javascript',
        version: '18.0.0',
        run: {
          stdout: '2\n',
          stderr: '',
          code: 0,
          signal: null,
        },
      }),
    }) as unknown as typeof fetch;

    process.env.PISTON_URL = 'http://piston:2000';
    const client = new PistonClient();
    const res = await client.execute({
      language: 'javascript',
      version: '*',
      files: [{ content: 'console.log(1+1)' }],
    });
    expect(res.run.stdout).toBe('2\n');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://piston:2000/api/v2/execute',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
```

- [ ] **Step 3: Implement client**

```typescript
// src/piston/piston.client.ts
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { getPistonHttpTimeoutMs, getPistonUrl } from '../config/env';
import {
  PistonExecuteRequest,
  PistonExecuteResponse,
  PistonRuntime,
} from './piston.types';

@Injectable()
export class PistonClient {
  private baseUrl(): string {
    return getPistonUrl().replace(/\/$/, '');
  }

  async execute(body: PistonExecuteRequest): Promise<PistonExecuteResponse> {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      getPistonHttpTimeoutMs(),
    );
    try {
      const res = await fetch(`${this.baseUrl()}/api/v2/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const data = (await res.json()) as PistonExecuteResponse & {
        message?: string;
      };
      if (!res.ok) {
        throw new ServiceUnavailableException(
          data.message ?? `Piston execute failed: ${res.status}`,
        );
      }
      return data;
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      throw new ServiceUnavailableException(
        err instanceof Error ? err.message : 'Piston unreachable',
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async runtimes(): Promise<PistonRuntime[]> {
    try {
      const res = await fetch(`${this.baseUrl()}/api/v2/runtimes`);
      if (!res.ok) {
        throw new ServiceUnavailableException('Piston runtimes unavailable');
      }
      return (await res.json()) as PistonRuntime[];
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      throw new ServiceUnavailableException('Piston unreachable');
    }
  }
}
```

```typescript
// src/piston/piston.module.ts
import { Module } from '@nestjs/common';
import { PistonClient } from './piston.client';

@Module({
  providers: [PistonClient],
  exports: [PistonClient],
})
export class PistonModule {}
```

- [ ] **Step 4: Run unit test — PASS**

```bash
npx jest src/piston/piston.client.spec.ts --no-cache
```

- [ ] **Step 5: Commit**

```bash
git add src/piston
git commit -m "feat: add Piston HTTP client"
```

---

### Task 5: Execute DTO + ExecutionService orchestration

**Files:**
- Create: `src/execution/dto/execute.dto.ts`
- Create: `src/execution/execution.service.ts`
- Create: `src/execution/execution.service.spec.ts`
- Create: `src/execution/execution.module.ts`
- Modify: `package.json` — add `class-validator` `class-transformer` if missing

**Interfaces:**
- Consumes: `PistonClient`, `JudgeService`, `ResponseFilterService`
- Produces: `ExecutionService.execute(dto): Promise<ExecuteResponse>`

- [ ] **Step 1: Install validation libs**

```bash
npm install class-validator class-transformer
```

- [ ] **Step 2: DTO**

```typescript
// src/execution/dto/execute.dto.ts
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ExecuteFileDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsString()
  @MinLength(0)
  @MaxLength(100_000)
  content!: string;
}

export class ExecuteTestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50_000)
  stdin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50_000)
  expectedStdout?: string;

  @IsIn(['public', 'hidden'])
  visibility!: 'public' | 'hidden';
}

export class ExecuteLimitsDto {
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(10_000)
  runTimeoutMs?: number;
}

export class ExecuteContextDto {
  @IsOptional()
  @IsString()
  enrollmentId?: string;

  @IsOptional()
  @IsString()
  lessonId?: string;

  @IsOptional()
  @IsString()
  labType?: string;
}

export class ExecuteDto {
  @IsString()
  language!: string;

  @IsOptional()
  @IsString()
  version?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExecuteFileDto)
  @ArrayMaxSize(20)
  files!: ExecuteFileDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExecuteTestDto)
  @ArrayMaxSize(50)
  tests?: ExecuteTestDto[];

  @IsOptional()
  @IsIn(['judge', 'run'])
  mode?: 'judge' | 'run';

  @IsOptional()
  @IsString()
  @MaxLength(50_000)
  stdin?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ExecuteLimitsDto)
  limits?: ExecuteLimitsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ExecuteContextDto)
  context?: ExecuteContextDto;
}
```

- [ ] **Step 3: Execution service with language allowlist + loop**

```typescript
// src/execution/execution.service.ts
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  getMaxRunTimeoutMs,
  getMaxFileBytes,
  getMaxFiles,
  getMaxTests,
} from '../config/env';
import { PistonClient } from '../piston/piston.client';
import { ExecuteDto } from './dto/execute.dto';
import { JudgeService } from './judge.service';
import { ResponseFilterService } from './response-filter.service';
import {
  ExecuteResponse,
  TestCaseResult,
  TestStatus,
} from './types';

const LANG_MAP: Record<string, string> = {
  javascript: 'javascript',
  js: 'javascript',
  node: 'javascript',
};

@Injectable()
export class ExecutionService {
  private readonly logger = new Logger(ExecutionService.name);

  constructor(
    private readonly piston: PistonClient,
    private readonly judge: JudgeService,
    private readonly filter: ResponseFilterService,
  ) {}

  async execute(dto: ExecuteDto): Promise<ExecuteResponse> {
    const language = LANG_MAP[dto.language.toLowerCase()];
    if (!language) {
      throw new BadRequestException(
        `Language not allowed. v1 supports: javascript`,
      );
    }
    if (!dto.files?.length) {
      throw new BadRequestException('files required');
    }
    if (dto.files.length > getMaxFiles()) {
      throw new BadRequestException(`Too many files (max ${getMaxFiles()})`);
    }
    for (const f of dto.files) {
      if (Buffer.byteLength(f.content, 'utf8') > getMaxFileBytes()) {
        throw new BadRequestException('File content too large');
      }
    }

    const mode =
      dto.mode ??
      (dto.tests && dto.tests.length > 0 ? 'judge' : 'run');
    const version = dto.version ?? '*';
    const runTimeout = Math.min(
      dto.limits?.runTimeoutMs ?? getMaxRunTimeoutMs(),
      getMaxRunTimeoutMs(),
    );
    const runId = randomUUID();

    if (mode === 'run') {
      const pistonRes = await this.piston.execute({
        language,
        version,
        files: dto.files.map((f) => ({ name: f.name, content: f.content })),
        stdin: dto.stdin ?? '',
        run_timeout: runTimeout,
      });
      this.logger.log(
        JSON.stringify({
          runId,
          mode: 'run',
          language,
          lessonId: dto.context?.lessonId,
          enrollmentId: dto.context?.enrollmentId,
        }),
      );
      return {
        runId,
        language: pistonRes.language,
        version: pistonRes.version,
        summary: {
          passed: 0,
          failed: 0,
          total: 0,
          success: pistonRes.run.code === 0,
          status: pistonRes.run.code === 0 ? 'ok' : 'runtime_error',
        },
        tests: [],
        run: {
          stdout: pistonRes.run.stdout,
          stderr: pistonRes.run.stderr,
          code: pistonRes.run.code,
          signal: pistonRes.run.signal,
        },
      };
    }

    const tests = dto.tests ?? [];
    if (tests.length > getMaxTests()) {
      throw new BadRequestException(`Too many tests (max ${getMaxTests()})`);
    }
    for (const t of tests) {
      if (t.expectedStdout === undefined) {
        throw new BadRequestException(
          `Test ${t.id} missing expectedStdout in judge mode`,
        );
      }
    }

    const rawResults: TestCaseResult[] = [];
    let resolvedVersion = version;
    let resolvedLanguage = language;

    for (const t of tests) {
      try {
        const pistonRes = await this.piston.execute({
          language,
          version,
          files: dto.files.map((f) => ({ name: f.name, content: f.content })),
          stdin: t.stdin ?? '',
          run_timeout: runTimeout,
        });
        resolvedVersion = pistonRes.version;
        resolvedLanguage = pistonRes.language;

        const status = this.mapPistonStatus(pistonRes);
        const actual = pistonRes.run.stdout ?? '';
        const passed =
          status === 'ok' &&
          this.judge.compare(actual, t.expectedStdout ?? '');

        rawResults.push({
          id: t.id,
          visibility: t.visibility,
          passed,
          status: passed ? 'ok' : status === 'ok' ? 'wrong_answer' : status,
          stdin: t.stdin ?? '',
          expectedStdout: t.expectedStdout,
          actualStdout: actual,
          stderr: pistonRes.run.stderr ?? '',
          exitCode: pistonRes.run.code,
        });
      } catch {
        rawResults.push({
          id: t.id,
          visibility: t.visibility,
          passed: false,
          status: 'internal_error',
        });
      }
    }

    const summary = this.judge.buildSummary(rawResults);
    const filtered = this.filter.filter(rawResults);

    this.logger.log(
      JSON.stringify({
        runId,
        mode: 'judge',
        language: resolvedLanguage,
        summary,
        lessonId: dto.context?.lessonId,
        enrollmentId: dto.context?.enrollmentId,
      }),
    );

    return {
      runId,
      language: resolvedLanguage,
      version: resolvedVersion,
      summary,
      tests: filtered,
      run: null,
    };
  }

  private mapPistonStatus(pistonRes: {
    run: { code: number | null; status?: string | null; signal: string | null };
  }): TestStatus {
    const st = pistonRes.run.status;
    if (st === 'TO') return 'timeout';
    if (st === 'RE' || st === 'SG') return 'runtime_error';
    if (st === 'XX') return 'internal_error';
    if (pistonRes.run.code !== 0 && pistonRes.run.code !== null) {
      return 'runtime_error';
    }
    return 'ok';
  }

  async listRuntimes() {
    const all = await this.piston.runtimes();
    return all.filter(
      (r) =>
        r.language === 'javascript' ||
        r.aliases?.includes('js') ||
        r.aliases?.includes('node'),
    );
  }
}
```

- [ ] **Step 4: Unit test orchestration with mocked PistonClient**

```typescript
// src/execution/execution.service.spec.ts
import { ExecutionService } from './execution.service';
import { JudgeService } from './judge.service';
import { ResponseFilterService } from './response-filter.service';
import { PistonClient } from '../piston/piston.client';

describe('ExecutionService', () => {
  it('judges public and strips hidden fields', async () => {
    const piston = {
      execute: jest
        .fn()
        .mockResolvedValueOnce({
          language: 'javascript',
          version: '18.0.0',
          run: { stdout: '3\n', stderr: '', code: 0, signal: null },
        })
        .mockResolvedValueOnce({
          language: 'javascript',
          version: '18.0.0',
          run: { stdout: '0\n', stderr: '', code: 0, signal: null },
        }),
    } as unknown as PistonClient;

    const service = new ExecutionService(
      piston,
      new JudgeService(),
      new ResponseFilterService(),
    );

    const res = await service.execute({
      language: 'javascript',
      files: [{ name: 'main.js', content: 'console.log(3)' }],
      tests: [
        {
          id: 'pub',
          stdin: '',
          expectedStdout: '3',
          visibility: 'public',
        },
        {
          id: 'hid',
          stdin: '',
          expectedStdout: '9',
          visibility: 'hidden',
        },
      ],
    });

    expect(res.summary.passed).toBe(1);
    expect(res.summary.failed).toBe(1);
    expect(res.tests[0].actualStdout).toBeDefined();
    expect(res.tests[1].actualStdout).toBeUndefined();
    expect(res.tests[1].expectedStdout).toBeUndefined();
  });
});
```

- [ ] **Step 5: Wire `execution.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PistonModule } from '../piston/piston.module';
import { ExecutionController } from './execution.controller';
import { ExecutionService } from './execution.service';
import { JudgeService } from './judge.service';
import { ResponseFilterService } from './response-filter.service';

@Module({
  imports: [PistonModule, AuthModule],
  controllers: [ExecutionController],
  providers: [ExecutionService, JudgeService, ResponseFilterService],
})
export class ExecutionModule {}
```

(Controller added in Task 6 — if compile fails, add a stub controller first.)

- [ ] **Step 6: Run unit tests PASS**

```bash
npx jest src/execution --no-cache
```

- [ ] **Step 7: Commit**

```bash
git add src/execution package.json package-lock.json
git commit -m "feat: add execution orchestration and DTOs"
```

---

### Task 6: HTTP controllers + app wiring

**Files:**
- Create: `src/execution/execution.controller.ts`
- Create: `src/health/health.controller.ts`
- Create: `src/health/health.module.ts`
- Modify: `src/main.ts`
- Modify: `src/app.module.ts`
- Optional: keep or slim `AppController` hello route

**Interfaces:**
- Produces: `POST /v1/execute`, `GET /v1/runtimes`, `GET /health`

- [ ] **Step 1: Controllers**

```typescript
// src/execution/execution.controller.ts
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { ExecuteDto } from './dto/execute.dto';
import { ExecutionService } from './execution.service';

@Controller('v1')
@UseGuards(ApiKeyGuard)
export class ExecutionController {
  constructor(private readonly execution: ExecutionService) {}

  @Post('execute')
  execute(@Body() body: ExecuteDto) {
    return this.execution.execute(body);
  }

  @Get('runtimes')
  runtimes() {
    return this.execution.listRuntimes();
  }
}
```

```typescript
// src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  health() {
    return { status: 'ok' };
  }
}
```

```typescript
// src/health/health.module.ts
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
```

- [ ] **Step 2: `app.module.ts` + `main.ts`**

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ExecutionModule } from './execution/execution.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HealthModule,
    ExecutionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

```typescript
// src/main.ts
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: success

- [ ] **Step 4: Commit**

```bash
git add src
git commit -m "feat: expose /v1/execute and /health"
```

---

### Task 7: Smoke test with real Piston (JS)

**Files:**
- Create: `scripts/smoke-execute.sh`

- [ ] **Step 1: Install JS on Piston** (see `docker/piston/README.md`)

- [ ] **Step 2: Run Nest against local Piston**

```bash
# terminal 1
export $(grep -v '^#' .env | xargs)
export PISTON_URL=http://127.0.0.1:2000
npm run start:dev
```

- [ ] **Step 3: Smoke script**

```bash
#!/usr/bin/env bash
set -euo pipefail
BASE=${BASE:-http://127.0.0.1:3000}
KEY=${API_KEY:-dev-key-tutor}

echo "health"
curl -sf "$BASE/health" | grep ok

echo "execute judge"
curl -sf -X POST "$BASE/v1/execute" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "javascript",
    "files": [{"name":"main.js","content":"console.log(1+2)"}],
    "tests": [
      {"id":"t1","expectedStdout":"3","visibility":"public"},
      {"id":"t2","expectedStdout":"999","visibility":"hidden"}
    ]
  }'
echo
```

Expected JSON: `summary.passed === 1`, hidden test without `expectedStdout` in response.

- [ ] **Step 4: Unauthorized check**

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:3000/v1/execute \
  -H "Content-Type: application/json" -d '{}'
```

Expected: `401`

- [ ] **Step 5: Commit smoke script**

```bash
chmod +x scripts/smoke-execute.sh
git add scripts/smoke-execute.sh
git commit -m "chore: add execute smoke script"
```

---

### Task 8: Dockerfile for API (optional same day)

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

```dockerignore
node_modules
dist
.git
.env
coverage
```

- [ ] **Step 1: Build compose stack**

```bash
docker compose build api
docker compose up -d
```

- [ ] **Step 2: Re-run smoke against compose**

```bash
BASE=http://127.0.0.1:3000 API_KEY=dev-key-tutor ./scripts/smoke-execute.sh
```

- [ ] **Step 3: Commit**

```bash
git add Dockerfile .dockerignore docker-compose.yml
git commit -m "chore: containerize Nest judge API"
```

---

### Task 9: Client integration notes (ship doc only)

**Files:**
- Create: `docs/runbooks/client-integration.md`

Document for Tutor / Lab / LMS backends:

```markdown
# Client integration (product backends)

## Auth
Authorization: Bearer <API_KEY>

## Run only
POST /v1/execute
{ "language": "javascript", "mode": "run", "files": [...], "stdin": "" }

## Judge
POST /v1/execute
{ "language": "javascript", "files": [...], "tests": [
  { "id": "1", "stdin": "", "expectedStdout": "...", "visibility": "public" },
  { "id": "2", "stdin": "", "expectedStdout": "...", "visibility": "hidden" }
], "context": { "enrollmentId": "...", "lessonId": "..." } }

## Rules
- Call only from server-side product backends
- Never put API key in student browser
- Students never call Piston
```

- [ ] **Step 1: Write file and commit**

```bash
git add docs/runbooks/client-integration.md
git commit -m "docs: client integration for code execution API"
```

---

## Ship-fast checklist (definition of done)

- [ ] `docker compose up` starts Piston (JS installed)
- [ ] Nest serves `GET /health` → `{ status: "ok" }`
- [ ] `POST /v1/execute` with API key runs JS and returns judge results
- [ ] Hidden tests omit I/O fields
- [ ] No key → 401
- [ ] Unit tests for guard, judge, filter, execution pass
- [ ] Smoke script passes once

## Explicitly deferred (do not build in this plan)

- Stored labs / harness DB
- Redis rate limits (add when second instance)
- Extra languages
- Job queue
- Admin key management UI
- Student JWT on this service

## Spec coverage

| Spec item | Task |
|-----------|------|
| Private Piston Docker | 1, 8 |
| API keys | 2, 6 |
| JS only | 5 |
| Unified execute + multi-file | 5, 6 |
| Public/hidden filter | 3, 5 |
| Run + judge modes | 5 |
| Health | 6 |
| Client multi-product | 9 |
| Context logging | 5 |

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-19-piston-code-execution-ship.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — implement tasks in this session with checkpoints  

Which approach?
