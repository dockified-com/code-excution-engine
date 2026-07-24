import type { LanguageDefinition } from '../types';

export const python: LanguageDefinition = {
  id: 'python',
  aliases: ['python', 'python3', 'py'],
  pistonLanguage: 'python',
  defaultFileName: 'main.py',
  hasCompileStage: false,
};
