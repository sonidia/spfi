export const DEFAULT_API_RATE_LIMIT_PER_MINUTE = 600;
export const DEFAULT_TOKEN_RATE_LIMIT_PER_MINUTE = 10;

export function resolveRateLimit(value: unknown, fallback: number) {
  const limit = Number(value);
  return Number.isSafeInteger(limit) && limit > 0 ? limit : fallback;
}
