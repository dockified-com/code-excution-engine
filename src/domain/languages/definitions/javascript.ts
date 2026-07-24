import type { LanguageDefinition } from '../types';

export const javascript: LanguageDefinition = {
  id: 'javascript',
  aliases: ['javascript', 'js', 'node', 'node.js'],
  pistonLanguage: 'javascript',
  defaultFileName: 'main.js',
  hasCompileStage: false,
};
