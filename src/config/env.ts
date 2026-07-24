export function getApiKeys(): string[] {
  return (process.env.API_KEYS ?? '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

export function getPistonUrl(): string {
  return process.env.PISTON_URL ?? 'http://127.0.0.1:2000';
}

export function getMaxRunTimeoutMs(): number {
  return Number(process.env.MAX_RUN_TIMEOUT_MS ?? 3000);
}

export function getMaxFiles(): number {
  return Number(process.env.MAX_FILES ?? 20);
}

export function getMaxFileBytes(): number {
  return Number(process.env.MAX_FILE_BYTES ?? 100_000);
}

export function getMaxTests(): number {
  return Number(process.env.MAX_TESTS ?? 50);
}

export function getPistonHttpTimeoutMs(): number {
  return Number(process.env.PISTON_HTTP_TIMEOUT_MS ?? 15_000);
}
