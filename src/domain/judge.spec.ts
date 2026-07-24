import { Judge } from './judge';
import { TestCaseResult } from './models/execute.models';

describe('Judge', () => {
  const judge = new Judge();

  describe('normalizeStdout', () => {
    it('strips a single trailing newline', () => {
      expect(judge.normalizeStdout('hello\n')).toBe('hello');
    });

    it('strips multiple trailing newlines', () => {
      expect(judge.normalizeStdout('hello\n\n')).toBe('hello');
    });

    it('leaves internal newlines intact', () => {
      expect(judge.normalizeStdout('a\nb\n')).toBe('a\nb');
    });

    it('does not trim leading whitespace or non-newline trailing space', () => {
      expect(judge.normalizeStdout('  hello  ')).toBe('  hello  ');
    });

    it('returns empty string for only newlines', () => {
      expect(judge.normalizeStdout('\n\n')).toBe('');
    });
  });

  describe('compare', () => {
    it('treats equal normalized stdout as match', () => {
      expect(judge.compare('3\n', '3')).toBe(true);
      expect(judge.compare('3', '3\n\n')).toBe(true);
    });

    it('returns false when content differs', () => {
      expect(judge.compare('3', '4')).toBe(false);
    });
  });

  describe('buildSummary', () => {
    it('builds summary for mixed pass/fail', () => {
      const tests: TestCaseResult[] = [
        {
          id: '1',
          visibility: 'public',
          passed: true,
          status: 'ok',
        },
        {
          id: '2',
          visibility: 'hidden',
          passed: false,
          status: 'wrong_answer',
        },
      ];
      expect(judge.buildSummary(tests)).toEqual({
        passed: 1,
        failed: 1,
        total: 2,
        success: false,
        status: 'wrong_answer',
      });
    });

    it('returns success when all pass and total > 0', () => {
      const tests: TestCaseResult[] = [
        { id: 'a', visibility: 'public', passed: true, status: 'ok' },
        { id: 'b', visibility: 'hidden', passed: true, status: 'ok' },
      ];
      expect(judge.buildSummary(tests)).toEqual({
        passed: 2,
        failed: 0,
        total: 2,
        success: true,
        status: 'ok',
      });
    });

    it('returns success false and status ok for empty results', () => {
      expect(judge.buildSummary([])).toEqual({
        passed: 0,
        failed: 0,
        total: 0,
        success: false,
        status: 'ok',
      });
    });

    it('prefers internal_error over other failure statuses', () => {
      const tests: TestCaseResult[] = [
        {
          id: '1',
          visibility: 'public',
          passed: false,
          status: 'wrong_answer',
        },
        {
          id: '2',
          visibility: 'public',
          passed: false,
          status: 'timeout',
        },
        {
          id: '3',
          visibility: 'public',
          passed: false,
          status: 'internal_error',
        },
      ];
      expect(judge.buildSummary(tests).status).toBe('internal_error');
    });

    it('prefers timeout over runtime_error and wrong_answer', () => {
      const tests: TestCaseResult[] = [
        {
          id: '1',
          visibility: 'public',
          passed: false,
          status: 'runtime_error',
        },
        {
          id: '2',
          visibility: 'public',
          passed: false,
          status: 'timeout',
        },
      ];
      expect(judge.buildSummary(tests).status).toBe('timeout');
    });

    it('prefers runtime_error over wrong_answer', () => {
      const tests: TestCaseResult[] = [
        {
          id: '1',
          visibility: 'public',
          passed: false,
          status: 'wrong_answer',
        },
        {
          id: '2',
          visibility: 'public',
          passed: false,
          status: 'runtime_error',
        },
      ];
      expect(judge.buildSummary(tests).status).toBe('runtime_error');
    });

    it('prefers compile_error over runtime_error and wrong_answer', () => {
      const tests: TestCaseResult[] = [
        {
          id: '1',
          visibility: 'public',
          passed: false,
          status: 'wrong_answer',
        },
        {
          id: '2',
          visibility: 'public',
          passed: false,
          status: 'runtime_error',
        },
        {
          id: '3',
          visibility: 'public',
          passed: false,
          status: 'compile_error',
        },
      ];
      expect(judge.buildSummary(tests).status).toBe('compile_error');
    });

    it('prefers timeout over compile_error', () => {
      const tests: TestCaseResult[] = [
        {
          id: '1',
          visibility: 'public',
          passed: false,
          status: 'compile_error',
        },
        {
          id: '2',
          visibility: 'public',
          passed: false,
          status: 'timeout',
        },
      ];
      expect(judge.buildSummary(tests).status).toBe('timeout');
    });
  });
});
