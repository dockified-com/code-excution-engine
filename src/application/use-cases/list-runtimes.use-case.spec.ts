import { LanguageRegistry } from '../../domain/languages';
import type { CodeRunnerPort, RunnerRuntime } from '../ports/code-runner.port';
import { ListRuntimesUseCase } from './list-runtimes.use-case';

describe('ListRuntimesUseCase', () => {
  it('filters runtimes to allowlisted languages via LanguageRegistry', async () => {
    const all: RunnerRuntime[] = [
      {
        language: 'javascript',
        version: '18.15.0',
        aliases: ['node-javascript', 'js', 'node'],
      },
      {
        language: 'ruby',
        version: '3.2.0',
        aliases: ['rb'],
      },
      {
        language: 'typescript',
        version: '5.0.0',
        aliases: ['ts'],
      },
    ];

    const listRuntimes = jest.fn().mockResolvedValue(all);
    const runner: CodeRunnerPort = {
      run: jest.fn(),
      listRuntimes,
    };

    const uc = new ListRuntimesUseCase(runner, new LanguageRegistry());
    const result = await uc.execute();

    expect(result).toEqual([
      {
        language: 'javascript',
        version: '18.15.0',
        aliases: ['node-javascript', 'js', 'node'],
      },
    ]);
    expect(listRuntimes).toHaveBeenCalledTimes(1);
  });

  it('includes runtime when only alias is allowlisted', async () => {
    const all: RunnerRuntime[] = [
      {
        language: 'node-javascript',
        version: '18.0.0',
        aliases: ['js'],
      },
      {
        language: 'ruby',
        version: '10',
        aliases: ['rb'],
      },
    ];

    const listRuntimes = jest.fn().mockResolvedValue(all);
    const runner: CodeRunnerPort = {
      run: jest.fn(),
      listRuntimes,
    };

    const uc = new ListRuntimesUseCase(runner, new LanguageRegistry());
    const result = await uc.execute();

    expect(result).toEqual([
      {
        language: 'node-javascript',
        version: '18.0.0',
        aliases: ['js'],
      },
    ]);
  });

  it('returns empty array when no allowlisted runtimes', async () => {
    const listRuntimes = jest
      .fn()
      .mockResolvedValue([{ language: 'ruby', version: '3', aliases: ['rb'] }]);
    const runner: CodeRunnerPort = {
      run: jest.fn(),
      listRuntimes,
    };

    const uc = new ListRuntimesUseCase(runner, new LanguageRegistry());
    await expect(uc.execute()).resolves.toEqual([]);
  });
});
