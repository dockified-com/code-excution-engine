import { TestCaseResult } from './models/execute.models';

/**
 * Strips I/O fields from hidden tests so clients only see id, visibility, passed, status.
 */
export class VisibilityFilter {
  filter(results: TestCaseResult[]): TestCaseResult[] {
    return results.map((r) => {
      if (r.visibility === 'public') {
        return { ...r };
      }
      return {
        id: r.id,
        visibility: r.visibility,
        passed: r.passed,
        status: r.status,
      };
    });
  }
}
