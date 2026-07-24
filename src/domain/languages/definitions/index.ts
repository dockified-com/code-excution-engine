import type { LanguageDefinition } from '../types';
import { javascript } from './javascript';
import { c } from './c';
import { cpp } from './cpp';

/**
 * Append new language definitions here (one import + one array entry per pack).
 * Parallel language-pack PRs should only touch this file with a single-line add.
 */
export const ALL_DEFINITIONS: LanguageDefinition[] = [javascript, c, cpp];
