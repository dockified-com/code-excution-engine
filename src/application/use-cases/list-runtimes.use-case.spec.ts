import { LanguagePolicy } from '../../domain/language-policy';
import type { CodeRunnerPort, RunnerRuntime } from '../ports/code-runner.port';
import { ListRuntimesUseCase } from './list-runtimes.use-case';

describe('ListRuntimesUseCase', () => {
  it('filters runtimes to JavaScript via LanguagePolicy', async () => {
    const all: RunnerRuntime[] = [
      {
        language: 'javascript',
        version: '18.15.0',
        aliases: ['node-javascript', 'js', 'node'],
      },
      {
        language: 'python',
        version: '3.12.0',
        aliases: ['py'],
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

    const uc = new ListRuntimesUseCase(runner, new LanguagePolicy());
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
        language: 'c',
        version: '10',
        aliases: ['gcc'],
      },
    ];

    const listRuntimes = jest.fn().mockResolvedValue(all);
    const runner: CodeRunnerPort = {
      run: jest.fn(),
      listRuntimes,
    };

    const uc = new ListRuntimesUseCase(runner, new LanguagePolicy());
    const result = await uc.execute();

    expect(result).toEqual([
      {
        language: 'node-javascript',
        version: '18.0.0',
        aliases: ['js'],
      },
    ]);
  });

  it('returns empty array when no JS runtimes', async () => {
    const listRuntimes = jest
      .fn()
      .mockResolvedValue([
        { language: 'python', version: '3', aliases: ['py'] },
      ]);
    const runner: CodeRunnerPort = {
      run: jest.fn(),
      listRuntimes,
    };

    const uc = new ListRuntimesUseCase(runner, new LanguagePolicy());
    await expect(uc.execute()).resolves.toEqual([]);
  });
});
