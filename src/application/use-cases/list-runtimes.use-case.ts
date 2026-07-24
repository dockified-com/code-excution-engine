import { Inject, Injectable } from '@nestjs/common';
import { LanguageRegistry } from '../../domain/languages';
import { CODE_RUNNER } from '../ports/code-runner.port';
import type { CodeRunnerPort, RunnerRuntime } from '../ports/code-runner.port';

@Injectable()
export class ListRuntimesUseCase {
  constructor(
    @Inject(CODE_RUNNER) private readonly runner: CodeRunnerPort,
    private readonly languages: LanguageRegistry,
  ) {}

  async execute(): Promise<RunnerRuntime[]> {
    const all = await this.runner.listRuntimes();
    return all.filter(
      (r) =>
        this.languages.isAllowed(r.language) ||
        (r.aliases ?? []).some((alias) => this.languages.isAllowed(alias)),
    );
  }
}
