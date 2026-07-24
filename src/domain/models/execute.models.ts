export type TestVisibility = 'public' | 'hidden';

export type CaseStatus =
  | 'ok'
  | 'wrong_answer'
  | 'runtime_error'
  | 'timeout'
  | 'compile_error'
  | 'internal_error';

export interface TestCaseResult {
  id: string;
  visibility: TestVisibility;
  passed: boolean;
  status: CaseStatus;
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
  status: CaseStatus | 'ok';
}
