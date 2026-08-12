export const PINIA_RETENTION_PRESETS = [
  { key: "none", ttlMs: 0 },
  { key: "1m", ttlMs: 60_000 },
  { key: "5m", ttlMs: 5 * 60_000 },
  { key: "15m", ttlMs: 15 * 60_000 },
  { key: "30m", ttlMs: 30 * 60_000 },
  { key: "1h", ttlMs: 60 * 60_000 },
  { key: "4h", ttlMs: 4 * 60 * 60_000 },
  { key: "12h", ttlMs: 12 * 60 * 60_000 },
  { key: "1d", ttlMs: 24 * 60 * 60_000 },
  { key: "session", ttlMs: null },
] as const;

export const DEFAULT_PINIA_RETENTION_INDEX = PINIA_RETENTION_PRESETS.length - 1;

export function normalizePiniaRetentionIndex(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return DEFAULT_PINIA_RETENTION_INDEX;
  }

  const index = Number(value);
  if (!Number.isInteger(index)) return DEFAULT_PINIA_RETENTION_INDEX;
  return Math.min(PINIA_RETENTION_PRESETS.length - 1, Math.max(0, index));
}

export function isPiniaCacheAlive(
  cachedAt: number | undefined,
  ttlMs: number | null,
  now = Date.now(),
) {
  if (ttlMs === null) return true;
  if (!cachedAt || ttlMs <= 0) return false;
  return now - cachedAt < ttlMs;
}
