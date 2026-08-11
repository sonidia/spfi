import { defineStore } from "pinia";
import { computed, ref } from "vue";

const API_RATE_LIMIT_HEADER_PREFIX = "x-ratelimit-api";
const FALLBACK_RATE_LIMIT_HEADER_PREFIX = "x-ratelimit";

interface HeaderReader {
  get(name: string): string | null;
}

interface RateLimitSnapshot {
  limit: number;
  remaining: number;
  resetAt: number;
}

export const useRateLimitStore = defineStore("rateLimit", () => {
  const limit = ref<number | null>(null);
  const remaining = ref<number | null>(null);
  const resetAt = ref<number | null>(null);
  const lastUpdatedAt = ref<number | null>(null);

  const isKnown = computed(
    () => limit.value !== null && remaining.value !== null && resetAt.value !== null,
  );

  function updateFromHeaders(headers: HeaderReader, observedAt = Date.now()) {
    const next =
      readSnapshot(headers, API_RATE_LIMIT_HEADER_PREFIX) ||
      readSnapshot(headers, FALLBACK_RATE_LIMIT_HEADER_PREFIX);
    if (!next || !shouldAcceptSnapshot(next)) return false;

    limit.value = next.limit;
    remaining.value = next.remaining;
    resetAt.value = next.resetAt;
    lastUpdatedAt.value = observedAt;
    return true;
  }

  function shouldAcceptSnapshot(next: RateLimitSnapshot) {
    if (resetAt.value === null || limit.value === null || remaining.value === null) {
      return true;
    }

    if (next.resetAt !== resetAt.value) {
      return next.resetAt > resetAt.value;
    }

    if (next.limit !== limit.value) {
      return next.remaining / next.limit <= remaining.value / limit.value;
    }

    // Concurrent responses can arrive out of order. Within one fixed window,
    // remaining quota can only stay level or decrease.
    return next.remaining <= remaining.value;
  }

  return {
    limit,
    remaining,
    resetAt,
    lastUpdatedAt,
    isKnown,
    updateFromHeaders,
  };
});

function readSnapshot(headers: HeaderReader, prefix: string): RateLimitSnapshot | null {
  const limit = readPositiveInteger(headers.get(`${prefix}-limit`));
  const remaining = readNonNegativeInteger(headers.get(`${prefix}-remaining`));
  const resetAtSeconds = readPositiveInteger(headers.get(`${prefix}-reset`));

  if (limit === null || remaining === null || resetAtSeconds === null) {
    return null;
  }

  return {
    limit,
    remaining: Math.min(remaining, limit),
    resetAt: resetAtSeconds * 1_000,
  };
}

function readPositiveInteger(value: string | null) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function readNonNegativeInteger(value: string | null) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}
