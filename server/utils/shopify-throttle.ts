const SHOPIFY_RECOMMENDED_BACKOFF_MS = 1_000;
const THROTTLE_STATE_TTL_MS = 5 * 60_000;

interface ShopifyThrottleGate {
  blockedUntil: number;
  touchedAt: number;
}

interface ShopifyGraphqlThrottleStatus {
  maximumAvailable?: unknown;
  currentlyAvailable?: unknown;
  restoreRate?: unknown;
}

interface ShopifyGraphqlCost {
  requestedQueryCost?: unknown;
  actualQueryCost?: unknown;
  throttleStatus?: ShopifyGraphqlThrottleStatus;
}

export interface ShopifyGraphqlExtensions {
  cost?: ShopifyGraphqlCost;
  [key: string]: unknown;
}

const throttleGates = new Map<string, ShopifyThrottleGate>();

export function buildShopifyThrottleKey(
  surface: "rest" | "graphql",
  domain: string,
  accessToken: string,
) {
  return `${surface}:${domain.toLowerCase()}:${accessToken}`;
}

export async function waitForShopifyThrottle(key: string) {
  while (true) {
    const gate = throttleGates.get(key);
    if (!gate) return;

    const delayMs = gate.blockedUntil - Date.now();
    if (delayMs <= 0) {
      throttleGates.delete(key);
      return;
    }

    await wait(delayMs);
  }
}

export function blockShopifyThrottle(key: string, delayMs: number) {
  if (!Number.isFinite(delayMs) || delayMs <= 0) return;

  const now = Date.now();
  cleanupThrottleGates(now);
  const blockedUntil = now + Math.ceil(delayMs);
  const current = throttleGates.get(key);

  throttleGates.set(key, {
    blockedUntil: Math.max(current?.blockedUntil || 0, blockedUntil),
    touchedAt: now,
  });
}

export function parseRetryAfterMs(value: unknown, now = Date.now()) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const normalized = String(rawValue ?? "").trim();
  if (!normalized) return null;

  const seconds = Number(normalized);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.max(1, Math.ceil(seconds * 1_000));
  }

  const retryAt = Date.parse(normalized);
  if (!Number.isFinite(retryAt)) return null;
  return Math.max(1, retryAt - now);
}

export function getGraphqlThrottleDelayMs(
  extensions?: ShopifyGraphqlExtensions,
  retryAfter?: unknown,
) {
  const headerDelay = parseRetryAfterMs(retryAfter);
  if (headerDelay !== null) return headerDelay;

  const cost = extensions?.cost;
  const status = cost?.throttleStatus;
  const requested = toFiniteNumber(cost?.requestedQueryCost);
  const available = toFiniteNumber(status?.currentlyAvailable);
  const restoreRate = toFiniteNumber(status?.restoreRate);

  if (restoreRate !== null && restoreRate > 0) {
    const deficit = Math.max(1, (requested ?? 1) - (available ?? 0));
    return Math.max(1, Math.ceil((deficit / restoreRate) * 1_000));
  }

  return SHOPIFY_RECOMMENDED_BACKOFF_MS;
}

export function isGraphqlThrottled(
  errors: Array<{ extensions?: Record<string, unknown> }> | undefined,
) {
  return Boolean(
    errors?.some(
      (error) =>
        String(error.extensions?.code || "").toUpperCase() === "THROTTLED",
    ),
  );
}

export function getGraphqlThrottleStatus(
  extensions?: ShopifyGraphqlExtensions,
) {
  const status = extensions?.cost?.throttleStatus;
  if (!status) return null;

  return {
    maximumAvailable: toFiniteNumber(status.maximumAvailable),
    currentlyAvailable: toFiniteNumber(status.currentlyAvailable),
    restoreRate: toFiniteNumber(status.restoreRate),
  };
}

function cleanupThrottleGates(now: number) {
  for (const [key, gate] of throttleGates) {
    if (gate.blockedUntil <= now && now - gate.touchedAt >= THROTTLE_STATE_TTL_MS) {
      throttleGates.delete(key);
    }
  }
}

function toFiniteNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function wait(delayMs: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, delayMs));
}
