export type LanguageDefinition = {
  /** Canonical API language id */
  id: string;
  /** Lowercase aliases including id */
  aliases: string[];
  /** Language string sent to Piston /api/v2/execute */
  pistonLanguage: string;
  /** Applied when a single file has no name */
  defaultFileName: string;
  /** Metadata: language normally has a compile stage (C/C++) */
  hasCompileStage: boolean;
};
