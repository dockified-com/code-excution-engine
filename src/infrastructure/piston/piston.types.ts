/** Wire types for Piston HTTP API v2 (not domain). */

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
  message?: string;
}

export interface PistonRuntime {
  language: string;
  version: string;
  aliases: string[];
  runtime?: string;
}
