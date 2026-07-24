import type { LanguageDefinition } from '../types';

export const cpp: LanguageDefinition = {
  id: 'cpp',
  aliases: ['cpp', 'c++', 'cxx'],
  pistonLanguage: 'c++',
  defaultFileName: 'main.cpp',
  hasCompileStage: true,
};
