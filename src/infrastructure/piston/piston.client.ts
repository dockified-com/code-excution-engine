import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  CodeRunInput,
  CodeRunOutput,
  CodeRunnerPort,
  RunnerRuntime,
} from '../../application/ports/code-runner.port';
import { getPistonHttpTimeoutMs, getPistonUrl } from '../../config/env';
import {
  PistonExecuteRequest,
  PistonExecuteResponse,
  PistonRuntime,
} from './piston.types';

@Injectable()
export class PistonClient implements CodeRunnerPort {
  private baseUrl(): string {
    return getPistonUrl().replace(/\/$/, '');
  }

  async run(input: CodeRunInput): Promise<CodeRunOutput> {
    const body: PistonExecuteRequest = {
      language: input.language,
      version: input.version,
      files: input.files.map((f) => ({
        ...(f.name !== undefined ? { name: f.name } : {}),
        content: f.content,
      })),
      stdin: input.stdin,
      run_timeout: input.runTimeoutMs,
    };

    const data = await this.postExecute(body);
    return this.mapExecuteResponse(data);
  }

  async listRuntimes(): Promise<RunnerRuntime[]> {
    const runtimes = await this.getRuntimes();
    return runtimes.map((r) => ({
      language: r.language,
      version: r.version,
      aliases: r.aliases ?? [],
    }));
  }

  private async postExecute(
    body: PistonExecuteRequest,
  ): Promise<PistonExecuteResponse> {
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

      let data: PistonExecuteResponse;
      try {
        data = (await res.json()) as PistonExecuteResponse;
      } catch {
        throw new ServiceUnavailableException(
          `Piston execute failed: ${res.status}`,
        );
      }

      if (!res.ok) {
        throw new ServiceUnavailableException(
          data.message ?? `Piston execute failed: ${res.status}`,
        );
      }

      if (!data.run) {
        throw new ServiceUnavailableException(
          'Piston execute response missing run stage',
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

  private async getRuntimes(): Promise<PistonRuntime[]> {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      getPistonHttpTimeoutMs(),
    );
    try {
      const res = await fetch(`${this.baseUrl()}/api/v2/runtimes`, {
        method: 'GET',
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new ServiceUnavailableException('Piston runtimes unavailable');
      }
      return (await res.json()) as PistonRuntime[];
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      throw new ServiceUnavailableException(
        err instanceof Error ? err.message : 'Piston unreachable',
      );
    } finally {
      clearTimeout(timer);
    }
  }

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
}
