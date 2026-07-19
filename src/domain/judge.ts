import {
  CaseStatus,
  ExecuteSummary,
  TestCaseResult,
} from './models/execute.models';

/**
 * Pure domain judge: normalize stdout, compare outputs, build execute summary.
 * No I/O, no Nest, no HTTP.
 */
export class Judge {
  /** Strip trailing newlines (not other whitespace). */
  normalizeStdout(s: string): string {
    return s.replace(/\n+$/g, '');
  }

  compare(actual: string, expected: string): boolean {
    return this.normalizeStdout(actual) === this.normalizeStdout(expected);
  }

  buildSummary(results: TestCaseResult[]): ExecuteSummary {
    const passed = results.filter((t) => t.passed).length;
    const failed = results.length - passed;

    let status: CaseStatus | 'ok' = 'ok';
    if (failed > 0) {
      const failedStatuses = results
        .filter((t) => !t.passed)
        .map((t) => t.status);
      if (failedStatuses.includes('internal_error')) {
        status = 'internal_error';
      } else if (failedStatuses.includes('timeout')) {
        status = 'timeout';
      } else if (failedStatuses.includes('runtime_error')) {
        status = 'runtime_error';
      } else {
        status = 'wrong_answer';
      }
    }

    return {
      passed,
      failed,
      total: results.length,
      success: failed === 0 && results.length > 0,
      status: results.length === 0 ? 'ok' : status,
    };
  }
}
