import { LanguagePolicy } from './language-policy';

describe('LanguagePolicy', () => {
  const policy = new LanguagePolicy();

  describe('resolve', () => {
    it('resolves javascript to javascript', () => {
      expect(policy.resolve('javascript')).toBe('javascript');
    });

    it('resolves js alias to javascript', () => {
      expect(policy.resolve('js')).toBe('javascript');
    });

    it('resolves node alias to javascript', () => {
      expect(policy.resolve('node')).toBe('javascript');
    });

    it('resolves node.js alias to javascript', () => {
      expect(policy.resolve('node.js')).toBe('javascript');
    });

    it('is case-insensitive and trims whitespace', () => {
      expect(policy.resolve('  JavaScript  ')).toBe('javascript');
      expect(policy.resolve('JS')).toBe('javascript');
      expect(policy.resolve('Node')).toBe('javascript');
    });

    it('returns null for unsupported languages', () => {
      expect(policy.resolve('python')).toBeNull();
      expect(policy.resolve('python3')).toBeNull();
      expect(policy.resolve('c++')).toBeNull();
      expect(policy.resolve('')).toBeNull();
    });
  });

  describe('isAllowed', () => {
    it('allows javascript aliases', () => {
      expect(policy.isAllowed('javascript')).toBe(true);
      expect(policy.isAllowed('js')).toBe(true);
      expect(policy.isAllowed('node')).toBe(true);
    });

    it('rejects unsupported languages', () => {
      expect(policy.isAllowed('python')).toBe(false);
      expect(policy.isAllowed('ruby')).toBe(false);
    });
  });
});
