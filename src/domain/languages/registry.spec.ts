import { LanguageRegistry } from './registry';

describe('LanguageRegistry', () => {
  const registry = new LanguageRegistry();

  describe('resolve', () => {
    it('resolves javascript aliases to definition id javascript', () => {
      expect(registry.resolve('javascript')?.id).toBe('javascript');
      expect(registry.resolve('js')?.id).toBe('javascript');
      expect(registry.resolve('node')?.id).toBe('javascript');
      expect(registry.resolve('node.js')?.id).toBe('javascript');
    });

    it('is case-insensitive and trims', () => {
      expect(registry.resolve('  JS  ')?.id).toBe('javascript');
    });

    it('returns null for unknown languages', () => {
      expect(registry.resolve('ruby')).toBeNull();
      expect(registry.resolve('')).toBeNull();
    });

    it('exposes pistonLanguage and defaultFileName for javascript', () => {
      const def = registry.resolve('js');
      expect(def?.pistonLanguage).toBe('javascript');
      expect(def?.defaultFileName).toBe('main.js');
      expect(def?.hasCompileStage).toBe(false);
    });
  });

  describe('isAllowed', () => {
    it('allows javascript aliases', () => {
      expect(registry.isAllowed('javascript')).toBe(true);
      expect(registry.isAllowed('js')).toBe(true);
    });

    it('rejects unsupported languages', () => {
      expect(registry.isAllowed('ruby')).toBe(false);
    });
  });

  describe('listIds', () => {
    it('includes all registered languages', () => {
      const ids = registry.listIds();
      expect(ids).toEqual(
        expect.arrayContaining(['javascript', 'python', 'c', 'cpp', 'sql']),
      );
    });
  });

  describe('python pack', () => {
    it('resolves python aliases', () => {
      expect(registry.resolve('python')?.id).toBe('python');
      expect(registry.resolve('python3')?.pistonLanguage).toBe('python');
      expect(registry.resolve('py')?.defaultFileName).toBe('main.py');
      expect(registry.resolve('py')?.hasCompileStage).toBe(false);
    });
  });

  describe('c-cpp pack', () => {
    it('resolves c and cpp', () => {
      expect(registry.resolve('c')?.pistonLanguage).toBe('c');
      expect(registry.resolve('c')?.defaultFileName).toBe('main.c');
      expect(registry.resolve('c')?.hasCompileStage).toBe(true);
      expect(registry.resolve('c++')?.id).toBe('cpp');
      expect(registry.resolve('cxx')?.defaultFileName).toBe('main.cpp');
      expect(registry.resolve('cpp')?.pistonLanguage).toBe('c++');
      expect(registry.resolve('cpp')?.hasCompileStage).toBe(true);
    });
  });

  describe('sql pack', () => {
    it('resolves sql to sqlite3 piston language', () => {
      expect(registry.resolve('sql')?.pistonLanguage).toBe('sqlite3');
      expect(registry.resolve('sqlite3')?.id).toBe('sql');
      expect(registry.resolve('sqlite')?.defaultFileName).toBe('main.sql');
      expect(registry.resolve('sql')?.hasCompileStage).toBe(false);
    });
  });

  describe('sql pack', () => {
    it('resolves sql to sqlite3 piston language', () => {
      expect(registry.resolve('sql')?.pistonLanguage).toBe('sqlite3');
      expect(registry.resolve('sqlite3')?.id).toBe('sql');
      expect(registry.resolve('sqlite')?.defaultFileName).toBe('main.sql');
      expect(registry.resolve('sql')?.hasCompileStage).toBe(false);
    });
  });

});
