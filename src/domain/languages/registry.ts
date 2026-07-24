import { Injectable } from '@nestjs/common';
import { ALL_DEFINITIONS } from './definitions';
import type { LanguageDefinition } from './types';

@Injectable()
export class LanguageRegistry {
  private readonly byAlias = new Map<string, LanguageDefinition>();
  private readonly byId = new Map<string, LanguageDefinition>();

  constructor() {
    for (const def of ALL_DEFINITIONS) {
      this.byId.set(def.id, def);
      for (const alias of def.aliases) {
        this.byAlias.set(alias.toLowerCase(), def);
      }
    }
  }

  resolve(language: string): LanguageDefinition | null {
    const key = language.trim().toLowerCase();
    if (!key) return null;
    return this.byAlias.get(key) ?? null;
  }

  isAllowed(language: string): boolean {
    return this.resolve(language) !== null;
  }

  listIds(): string[] {
    return [...this.byId.keys()];
  }

  getById(id: string): LanguageDefinition | null {
    return this.byId.get(id) ?? null;
  }
}
