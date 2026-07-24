import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Judge } from '../../domain/judge';
import { LanguageRegistry } from '../../domain/languages';
import { VisibilityFilter } from '../../domain/visibility-filter';
import type { CodeRunnerPort } from '../ports/code-runner.port';
import { ExecuteCodeUseCase } from './execute-code.use-case';

function okRun(
  stdout: string,
  overrides: Partial<{
    language: string;
    version: string;
    stderr: string;
    code: number | null;
    signal: string | null;
    engineStatus: string | null;
  }> = {},
) {
  return {
    language: overrides.language ?? 'javascript',
    version: overrides.version ?? '18.0.0',
    stdout,
    stderr: overrides.stderr ?? '',
    code: overrides.code ?? 0,
    signal: overrides.signal ?? null,
    engineStatus: overrides.engineStatus ?? null,
  };
}

describe('ExecuteCodeUseCase', () => {
  const originalMaxFiles = process.env.MAX_FILES;
  const originalMaxFileBytes = process.env.MAX_FILE_BYTES;
  const originalMaxTests = process.env.MAX_TESTS;
  const originalMaxTimeout = process.env.MAX_RUN_TIMEOUT_MS;

  beforeEach(() => {
    process.env.MAX_FILES = '20';
    process.env.MAX_FILE_BYTES = '100000';
    process.env.MAX_TESTS = '50';
    process.env.MAX_RUN_TIMEOUT_MS = '3000';
  });

  afterAll(() => {
    process.env.MAX_FILES = originalMaxFiles;
    process.env.MAX_FILE_BYTES = originalMaxFileBytes;
    process.env.MAX_TESTS = originalMaxTests;
    process.env.MAX_RUN_TIMEOUT_MS = originalMaxTimeout;
  });

  function createUseCase(runner: CodeRunnerPort): ExecuteCodeUseCase {
    return new ExecuteCodeUseCase(
      runner,
      new Judge(),
      new VisibilityFilter(),
      new LanguageRegistry(),
    );
  }

  it('throws BadRequest for unknown language', async () => {
    const run = jest.fn();
    const runner: CodeRunnerPort = {
      run,
      listRuntimes: jest.fn(),
    };
    const uc = createUseCase(runner);

    await expect(
      uc.execute({
        language: 'ruby',
        files: [{ content: 'puts 1' }],
      }),
    ).rejects.toThrow(BadRequestException);

    expect(run).not.toHaveBeenCalled();
  });

  it('error message lists supported language ids', async () => {
    const uc = createUseCase({ run: jest.fn(), listRuntimes: jest.fn() });
    await expect(
      uc.execute({ language: 'ruby', files: [{ content: '1' }] }),
    ).rejects.toThrow(/javascript/);
  });

  it('sends pistonLanguage and applies default file name', async () => {
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
    ).rejects.toThrow(/Multiple files missing name/);

    expect(run).not.toHaveBeenCalled();
  });

  it('maps compile failure to compile_error in run mode', async () => {
    const run = jest.fn().mockResolvedValue({
      language: 'javascript',
      version: '18.0.0',
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

  it('maps compile failure to compile_error in judge mode and strips hidden I/O', async () => {
    const compileFail = {
      language: 'javascript',
      version: '18.0.0',
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
    };
    const run = jest
      .fn()
      .mockResolvedValueOnce(compileFail)
      .mockResolvedValueOnce(compileFail);
    const uc = createUseCase({ run, listRuntimes: jest.fn() });
    const res = await uc.execute({
      language: 'javascript',
      files: [{ name: 'main.js', content: 'x' }],
      tests: [
        { id: 't1', expectedStdout: '0', visibility: 'public' },
        { id: 't2', expectedStdout: '0', visibility: 'hidden' },
      ],
    });
    expect(res.summary.status).toBe('compile_error');
    expect(res.tests[0].status).toBe('compile_error');
    expect(res.tests[0].stderr).toContain('error: syntax');
    expect(res.tests[1].status).toBe('compile_error');
    expect(res.tests[1].stderr).toBeUndefined();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('judges public and strips hidden fields', async () => {
    const run = jest
      .fn()
      .mockResolvedValueOnce(okRun('3\n'))
      .mockResolvedValueOnce(okRun('0\n'));
    const runner: CodeRunnerPort = {
      run,
      listRuntimes: jest.fn(),
    };
    const uc = createUseCase(runner);

    const res = await uc.execute({
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
      context: { lessonId: 'L1', enrollmentId: 'E1' },
    });

    expect(res.summary.passed).toBe(1);
    expect(res.summary.failed).toBe(1);
    expect(res.summary.total).toBe(2);
    expect(res.summary.success).toBe(false);
    expect(res.summary.status).toBe('wrong_answer');
    expect(res.runId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(res.language).toBe('javascript');
    expect(res.version).toBe('18.0.0');
    expect(res.run).toBeNull();

    expect(res.tests[0].id).toBe('pub');
    expect(res.tests[0].passed).toBe(true);
    expect(res.tests[0].actualStdout).toBe('3\n');
    expect(res.tests[0].expectedStdout).toBe('3');

    expect(res.tests[1].id).toBe('hid');
    expect(res.tests[1].passed).toBe(false);
    expect(res.tests[1].status).toBe('wrong_answer');
    expect(res.tests[1].actualStdout).toBeUndefined();
    expect(res.tests[1].expectedStdout).toBeUndefined();
    expect(res.tests[1].stdin).toBeUndefined();
    expect(res.tests[1].stderr).toBeUndefined();

    expect(run).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({
        language: 'javascript',
        version: '*',
        stdin: '',
        runTimeoutMs: 3000,
      }),
    );
  });

  it('run mode returns run payload and summary from exit code', async () => {
    const run = jest.fn().mockResolvedValue(okRun('hello\n', { code: 0 }));
    const runner: CodeRunnerPort = {
      run,
      listRuntimes: jest.fn(),
    };
    const uc = createUseCase(runner);

    const res = await uc.execute({
      language: 'js',
      files: [{ content: 'console.log("hello")' }],
      stdin: '',
      mode: 'run',
    });

    expect(res.summary).toEqual({
      passed: 0,
      failed: 0,
      total: 0,
      success: true,
      status: 'ok',
    });
    expect(res.tests).toEqual([]);
    expect(res.run).toEqual({
      stdout: 'hello\n',
      stderr: '',
      code: 0,
      signal: null,
    });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('defaults mode to run when tests empty', async () => {
    const run = jest.fn().mockResolvedValue(okRun(''));
    const runner: CodeRunnerPort = {
      run,
      listRuntimes: jest.fn(),
    };
    const uc = createUseCase(runner);

    const res = await uc.execute({
      language: 'node',
      files: [{ content: '' }],
      tests: [],
    });

    expect(res.run).not.toBeNull();
    expect(res.tests).toEqual([]);
  });

  it('maps engine timeout status in judge mode', async () => {
    const run = jest.fn().mockResolvedValue(
      okRun('', {
        code: null,
        signal: 'SIGKILL',
        engineStatus: 'TO',
        stderr: 'Time limit exceeded',
      }),
    );
    const runner: CodeRunnerPort = {
      run,
      listRuntimes: jest.fn(),
    };
    const uc = createUseCase(runner);

    const res = await uc.execute({
      language: 'javascript',
      files: [{ content: 'while(true){}' }],
      tests: [
        {
          id: 't1',
          expectedStdout: '',
          visibility: 'public',
        },
      ],
    });

    expect(res.tests[0].passed).toBe(false);
    expect(res.tests[0].status).toBe('timeout');
    expect(res.summary.status).toBe('timeout');
  });

  it('records internal_error when runner throws an unexpected error for a test', async () => {
    const run = jest.fn().mockRejectedValue(new Error('unexpected mapper bug'));
    const runner: CodeRunnerPort = {
      run,
      listRuntimes: jest.fn(),
    };
    const uc = createUseCase(runner);

    const res = await uc.execute({
      language: 'javascript',
      files: [{ content: 'x' }],
      tests: [{ id: 't1', expectedStdout: '1', visibility: 'public' }],
    });

    expect(res.tests[0]).toMatchObject({
      id: 't1',
      passed: false,
      status: 'internal_error',
    });
    expect(res.summary.status).toBe('internal_error');
  });

  it('propagates ServiceUnavailableException in judge mode (fail closed)', async () => {
    const run = jest
      .fn()
      .mockRejectedValue(new ServiceUnavailableException('Piston unreachable'));
    const runner: CodeRunnerPort = {
      run,
      listRuntimes: jest.fn(),
    };
    const uc = createUseCase(runner);

    await expect(
      uc.execute({
        language: 'javascript',
        files: [{ content: 'x' }],
        tests: [
          { id: 't1', expectedStdout: '1', visibility: 'public' },
          { id: 't2', expectedStdout: '2', visibility: 'hidden' },
        ],
      }),
    ).rejects.toThrow(ServiceUnavailableException);

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('rejects too many files', async () => {
    process.env.MAX_FILES = '1';
    const run = jest.fn();
    const runner: CodeRunnerPort = {
      run,
      listRuntimes: jest.fn(),
    };
    const uc = createUseCase(runner);

    await expect(
      uc.execute({
        language: 'javascript',
        files: [{ content: 'a' }, { content: 'b' }],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects missing expectedStdout in judge mode', async () => {
    const run = jest.fn();
    const runner: CodeRunnerPort = {
      run,
      listRuntimes: jest.fn(),
    };
    const uc = createUseCase(runner);

    await expect(
      uc.execute({
        language: 'javascript',
        files: [{ content: 'x' }],
        mode: 'judge',
        tests: [{ id: 't1', visibility: 'public' } as never],
      }),
    ).rejects.toThrow(/expectedStdout/);
  });

  it('caps runTimeoutMs to server max', async () => {
    process.env.MAX_RUN_TIMEOUT_MS = '2000';
    const run = jest.fn().mockResolvedValue(okRun(''));
    const runner: CodeRunnerPort = {
      run,
      listRuntimes: jest.fn(),
    };
    const uc = createUseCase(runner);

    await uc.execute({
      language: 'javascript',
      files: [{ content: '' }],
      mode: 'run',
      limits: { runTimeoutMs: 99999 },
    });

    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({ runTimeoutMs: 2000 }),
    );
  });

<<<<<<< HEAD
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


  it('runs c via piston language c with default main.c', async () => {
    const run = jest.fn().mockResolvedValue({
      language: 'c',
      version: '10.2.0',
      stdout: '0\n',
      stderr: '',
      code: 0,
      signal: null,
      engineStatus: null,
    });
    const uc = createUseCase({ run, listRuntimes: jest.fn() });
    await uc.execute({
      language: 'c',
      mode: 'run',
      files: [{ content: 'int main(){return 0;}' }],
    });
    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({
        language: 'c',
        files: [{ name: 'main.c', content: 'int main(){return 0;}' }],
      }),
    );
  });

  it('judge mode records compile_error for c and strips hidden I/O', async () => {
    const compileFail = {
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
    };
    const run = jest
      .fn()
      .mockResolvedValueOnce(compileFail)
      .mockResolvedValueOnce(compileFail);
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
    expect(res.tests[1].stderr).toBeUndefined();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('resolves cpp alias c++ to piston c++', async () => {
    const run = jest.fn().mockResolvedValue({
      language: 'c++',
      version: '10.2.0',
      stdout: '',
      stderr: '',
      code: 0,
      signal: null,
      engineStatus: null,
    });
    const uc = createUseCase({ run, listRuntimes: jest.fn() });
    await uc.execute({
      language: 'c++',
      mode: 'run',
      files: [{ content: 'int main(){return 0;}' }],
    });
    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({
        language: 'c++',
        files: [{ name: 'main.cpp', content: 'int main(){return 0;}' }],
      }),
    );
  });


=======
>>>>>>> feature/lang-sql
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

});

