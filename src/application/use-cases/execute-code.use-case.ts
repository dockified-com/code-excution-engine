import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  CaseStatus,
  ExecuteSummary,
  TestCaseResult,
  TestVisibility,
} from '../../domain/models/execute.models';
import { Judge } from '../../domain/judge';
import {
  LanguageRegistry,
  type LanguageDefinition,
} from '../../domain/languages';
import { VisibilityFilter } from '../../domain/visibility-filter';
import {
  getMaxFileBytes,
  getMaxFiles,
  getMaxRunTimeoutMs,
  getMaxTests,
} from '../../config/env';
import { CODE_RUNNER } from '../ports/code-runner.port';
import type { CodeRunOutput, CodeRunnerPort } from '../ports/code-runner.port';

export interface ExecuteCodeInput {
  language: string;
  version?: string;
  files: { name?: string; content: string }[];
  tests?: {
    id: string;
    stdin?: string;
    expectedStdout?: string;
    visibility: TestVisibility;
  }[];
  mode?: 'judge' | 'run';
  stdin?: string;
  limits?: { runTimeoutMs?: number };
  context?: { enrollmentId?: string; lessonId?: string; labType?: string };
}

export interface ExecuteRunPayload {
  stdout: string;
  stderr: string;
  code: number | null;
  signal: string | null;
}

export interface ExecuteResult {
  runId: string;
  language: string;
  version: string;
  summary: ExecuteSummary;
  tests: TestCaseResult[];
  run: ExecuteRunPayload | null;
}

function isCompileFailure(out: CodeRunOutput): boolean {
  if (!out.compile) return false;
  if (out.compile.code !== null && out.compile.code !== 0) return true;
  const st = out.compile.engineStatus;
  if (st && st !== 'OK' && st !== 'ok') return true;
  return false;
}

function compileStderr(out: CodeRunOutput): string {
  const c = out.compile!;
  return c.stderr || c.stdout || '';
}

@Injectable()
export class ExecuteCodeUseCase {
  private readonly logger = new Logger(ExecuteCodeUseCase.name);

  constructor(
    @Inject(CODE_RUNNER) private readonly runner: CodeRunnerPort,
    private readonly judge: Judge,
    private readonly visibility: VisibilityFilter,
    private readonly languages: LanguageRegistry,
  ) {}

  async execute(input: ExecuteCodeInput): Promise<ExecuteResult> {
    const def = this.languages.resolve(input.language);
    if (!def) {
      throw new BadRequestException(
        `Language not allowed. Supported: ${this.languages.listIds().join(', ')}`,
      );
    }

    if (!input.files?.length) {
      throw new BadRequestException('files required');
    }
    if (input.files.length > getMaxFiles()) {
      throw new BadRequestException(`Too many files (max ${getMaxFiles()})`);
    }
    for (const f of input.files) {
      if (Buffer.byteLength(f.content, 'utf8') > getMaxFileBytes()) {
        throw new BadRequestException('File content too large');
      }
    }

    const files = this.applyDefaultFileNames(input.files, def);

    const mode =
      input.mode ?? (input.tests && input.tests.length > 0 ? 'judge' : 'run');
    const version = input.version ?? '*';
    const runTimeoutMs = Math.min(
      input.limits?.runTimeoutMs ?? getMaxRunTimeoutMs(),
      getMaxRunTimeoutMs(),
    );
    const runId = randomUUID();

    if (mode === 'run') {
      const out = await this.runner.run({
        language: def.pistonLanguage,
        version,
        files,
        stdin: input.stdin ?? '',
        runTimeoutMs,
      });

      if (isCompileFailure(out)) {
        const stderr = compileStderr(out);
        const summary: ExecuteSummary = {
          passed: 0,
          failed: 0,
          total: 0,
          success: false,
          status: 'compile_error',
        };

        this.logger.log(
          JSON.stringify({
            runId,
            mode: 'run',
            language: out.language,
            summary,
            lessonId: input.context?.lessonId,
            enrollmentId: input.context?.enrollmentId,
          }),
        );

        return {
          runId,
          language: out.language,
          version: out.version,
          summary,
          tests: [],
          run: {
            stdout: '',
            stderr,
            code: out.compile?.code ?? null,
            signal: out.compile?.signal ?? null,
          },
        };
      }

      const success = out.code === 0;
      const summary: ExecuteSummary = {
        passed: 0,
        failed: 0,
        total: 0,
        success,
        status: success ? 'ok' : 'runtime_error',
      };

      this.logger.log(
        JSON.stringify({
          runId,
          mode: 'run',
          language: out.language,
          summary,
          lessonId: input.context?.lessonId,
          enrollmentId: input.context?.enrollmentId,
        }),
      );

      return {
        runId,
        language: out.language,
        version: out.version,
        summary,
        tests: [],
        run: {
          stdout: out.stdout,
          stderr: out.stderr,
          code: out.code,
          signal: out.signal,
        },
      };
    }

    const tests = input.tests ?? [];
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
    let resolvedLanguage = def.pistonLanguage;

    for (const t of tests) {
      try {
        const out = await this.runner.run({
          language: def.pistonLanguage,
          version,
          files,
          stdin: t.stdin ?? '',
          runTimeoutMs,
        });
        resolvedVersion = out.version;
        resolvedLanguage = out.language;

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

        const engineStatus = this.mapEngineStatus(out);
        const actual = out.stdout ?? '';
        const passed =
          engineStatus === 'ok' &&
          this.judge.compare(actual, t.expectedStdout ?? '');

        rawResults.push({
          id: t.id,
          visibility: t.visibility,
          passed,
          status: passed
            ? 'ok'
            : engineStatus === 'ok'
              ? 'wrong_answer'
              : engineStatus,
          stdin: t.stdin ?? '',
          expectedStdout: t.expectedStdout,
          actualStdout: actual,
          stderr: out.stderr ?? '',
          exitCode: out.code,
        });
      } catch (err) {
        // Fail closed: Piston down / overloaded must surface as 503, not a graded 200.
        if (err instanceof ServiceUnavailableException) {
          throw err;
        }
        rawResults.push({
          id: t.id,
          visibility: t.visibility,
          passed: false,
          status: 'internal_error',
        });
      }
    }

    const summary = this.judge.buildSummary(rawResults);
    const filtered = this.visibility.filter(rawResults);

    this.logger.log(
      JSON.stringify({
        runId,
        mode: 'judge',
        language: resolvedLanguage,
        summary,
        lessonId: input.context?.lessonId,
        enrollmentId: input.context?.enrollmentId,
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

  private mapEngineStatus(output: CodeRunOutput): CaseStatus {
    const st = output.engineStatus;
    if (st === 'TO') return 'timeout';
    if (st === 'RE' || st === 'SG') return 'runtime_error';
    if (st === 'XX') return 'internal_error';
    if (output.code !== 0 && output.code !== null) {
      return 'runtime_error';
    }
    return 'ok';
  }
}
