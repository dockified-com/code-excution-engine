import { VisibilityFilter } from './visibility-filter';
import { TestCaseResult } from './models/execute.models';

describe('VisibilityFilter', () => {
  const filter = new VisibilityFilter();

  it('keeps I/O for public tests', () => {
    const input: TestCaseResult[] = [
      {
        id: 'p',
        visibility: 'public',
        passed: false,
        status: 'wrong_answer',
        stdin: '1',
        expectedStdout: '2',
        actualStdout: '3',
        stderr: '',
        exitCode: 0,
      },
    ];
    const out = filter.filter(input);
    expect(out[0].stdin).toBe('1');
    expect(out[0].expectedStdout).toBe('2');
    expect(out[0].actualStdout).toBe('3');
    expect(out[0].stderr).toBe('');
    expect(out[0].exitCode).toBe(0);
  });

  it('strips I/O for hidden tests', () => {
    const input: TestCaseResult[] = [
      {
        id: 'h',
        visibility: 'hidden',
        passed: false,
        status: 'wrong_answer',
        stdin: 'secret',
        expectedStdout: 'x',
        actualStdout: 'y',
        stderr: 'err',
        exitCode: 1,
      },
    ];
    const out = filter.filter(input);
    expect(out[0]).toEqual({
      id: 'h',
      visibility: 'hidden',
      passed: false,
      status: 'wrong_answer',
    });
    expect(out[0].stdin).toBeUndefined();
    expect(out[0].expectedStdout).toBeUndefined();
    expect(out[0].actualStdout).toBeUndefined();
    expect(out[0].stderr).toBeUndefined();
    expect(out[0].exitCode).toBeUndefined();
  });

  it('handles mixed public and hidden results', () => {
    const input: TestCaseResult[] = [
      {
        id: 'public-1',
        visibility: 'public',
        passed: true,
        status: 'ok',
        stdin: 'in',
        expectedStdout: 'out',
        actualStdout: 'out',
      },
      {
        id: 'hidden-1',
        visibility: 'hidden',
        passed: true,
        status: 'ok',
        stdin: 'secret-in',
        expectedStdout: 'secret-out',
        actualStdout: 'secret-out',
        stderr: 'noise',
        exitCode: 0,
      },
    ];
    const out = filter.filter(input);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      id: 'public-1',
      stdin: 'in',
      expectedStdout: 'out',
      actualStdout: 'out',
    });
    expect(out[1]).toEqual({
      id: 'hidden-1',
      visibility: 'hidden',
      passed: true,
      status: 'ok',
    });
  });

  it('does not mutate the original results', () => {
    const input: TestCaseResult[] = [
      {
        id: 'h',
        visibility: 'hidden',
        passed: true,
        status: 'ok',
        stdin: 'keep-me',
      },
    ];
    filter.filter(input);
    expect(input[0].stdin).toBe('keep-me');
  });
});
