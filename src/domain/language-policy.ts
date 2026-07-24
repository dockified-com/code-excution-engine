/**
 * v1 language allowlist / alias map. Only JavaScript is supported.
 */
const CANONICAL_JAVASCRIPT = 'javascript';

/** Aliases (lowercase) → canonical language id for Piston / API. */
const ALIASES: Record<string, string> = {
  javascript: CANONICAL_JAVASCRIPT,
  js: CANONICAL_JAVASCRIPT,
  node: CANONICAL_JAVASCRIPT,
  'node.js': CANONICAL_JAVASCRIPT,
};

export class LanguagePolicy {
  /**
   * Resolve a client language string to the canonical runtime name.
   * Returns null if not allowed.
   */
  resolve(language: string): string | null {
    const key = language.trim().toLowerCase();
    return ALIASES[key] ?? null;
  }

  isAllowed(language: string): boolean {
    return this.resolve(language) !== null;
  }
}
