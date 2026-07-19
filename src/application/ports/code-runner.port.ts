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
  /** Piston status TO/RE/SG/… or null */
  engineStatus: string | null;
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
