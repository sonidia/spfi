import type { H3Event } from "h3";

const WINDOW_MS = 60_000;
const API_LIMIT = 100;
const TOKEN_LIMIT = 10;
const CLEANUP_INTERVAL_MS = 5 * WINDOW_MS;

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitState {
  api: Map<string, RateLimitEntry>;
  token: Map<string, RateLimitEntry>;
  lastCleanupAt: number;
}

const state: RateLimitState = {
  api: new Map(),
  token: new Map(),
  lastCleanupAt: Date.now(),
};

function resolveClientIp(event: H3Event): string {
  return getRequestIP(event, { xForwardedFor: true }) || "unknown";
}

function cleanupExpiredEntries(now: number) {
  if (now - state.lastCleanupAt < CLEANUP_INTERVAL_MS) return;

  for (const bucket of [state.api, state.token]) {
    for (const [key, entry] of bucket) {
      if (entry.resetAt <= now) {
        bucket.delete(key);
      }
    }
  }

  state.lastCleanupAt = now;
}

function consume(
  bucket: Map<string, RateLimitEntry>,
  key: string,
  limit: number,
  now: number,
) {
  let entry = bucket.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    bucket.set(key, entry);
  }

  entry.count += 1;
  return {
    allowed: entry.count <= limit,
    limit,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
  };
}

export default defineEventHandler((event) => {
  const pathname = getRequestURL(event).pathname;
  if (!pathname.startsWith("/api/")) return;

  const now = Date.now();
  cleanupExpiredEntries(now);

  const ip = resolveClientIp(event);
  const generalResult = consume(state.api, ip, API_LIMIT, now);
  const result =
    pathname === "/api/generate-token"
      ? consume(state.token, ip, TOKEN_LIMIT, now)
      : generalResult;

  const rejectedResult = !generalResult.allowed
    ? generalResult
    : !result.allowed
      ? result
      : null;
  const headerResult =
    result.limit < generalResult.limit ? result : generalResult;

  setResponseHeader(event, "X-RateLimit-Limit", headerResult.limit);
  setResponseHeader(event, "X-RateLimit-Remaining", headerResult.remaining);
  setResponseHeader(
    event,
    "X-RateLimit-Reset",
    Math.ceil(headerResult.resetAt / 1000),
  );

  if (!rejectedResult) return;

  const retryAfter = Math.max(
    1,
    Math.ceil((rejectedResult.resetAt - now) / 1000),
  );
  setResponseHeader(event, "Retry-After", retryAfter);

  throw createError({
    statusCode: 429,
    statusMessage: "Too Many Requests",
    message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
  });
});
