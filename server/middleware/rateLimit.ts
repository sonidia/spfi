import type { H3Event } from "h3";
import { useRuntimeConfig } from "#imports";
import { readRuntimeBoolean } from "../utils/runtime-config";

const WINDOW_MS = 60_000;
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

function resolveClientIp(event: H3Event, trustProxyHeaders: boolean): string {
  return (
    getRequestIP(event, { xForwardedFor: trustProxyHeaders }) ||
    event.node.req.socket.remoteAddress ||
    "unknown"
  );
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

  const config = useRuntimeConfig(event);
  const apiLimit = readConfiguredLimit(config.apiRateLimitPerMinute);
  const tokenLimit = readConfiguredLimit(config.tokenRateLimitPerMinute);
  const isTokenRequest = pathname === "/api/generate-token";
  if (apiLimit === 0 && (!isTokenRequest || tokenLimit === 0)) return;

  const now = Date.now();
  cleanupExpiredEntries(now);

  const ip = resolveClientIp(
    event,
    readRuntimeBoolean(config.trustProxyHeaders),
  );
  const results = [
    ...(apiLimit > 0 ? [consume(state.api, ip, apiLimit, now)] : []),
    ...(isTokenRequest && tokenLimit > 0
      ? [consume(state.token, ip, tokenLimit, now)]
      : []),
  ];
  const rejectedResult = results.find((result) => !result.allowed) || null;
  const headerResult = results.reduce((mostConstrained, result) =>
    result.remaining / result.limit <
    mostConstrained.remaining / mostConstrained.limit
      ? result
      : mostConstrained,
  );

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

function readConfiguredLimit(value: unknown) {
  const limit = Number(value);
  return Number.isSafeInteger(limit) && limit > 0 ? limit : 0;
}
