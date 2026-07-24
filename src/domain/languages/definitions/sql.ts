import type { LanguageDefinition } from '../types';

export const sql: LanguageDefinition = {
  id: 'sql',
  aliases: ['sql', 'sqlite', 'sqlite3'],
  pistonLanguage: 'sqlite3',
  defaultFileName: 'main.sql',
  hasCompileStage: false,
};
