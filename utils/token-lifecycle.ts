import type { ShopifyAccessTokenResponse } from "~~/types/shopify";

export const DEFAULT_SHOPIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const MIN_TOKEN_TTL_SECONDS = 60;
const MAX_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export function resolveTokenExpiresAt(
  response: Pick<ShopifyAccessTokenResponse, "expires_in">,
  now = Date.now(),
) {
  const expiresInSeconds = Number(response.expires_in);
  const ttlMs =
    Number.isFinite(expiresInSeconds) &&
    expiresInSeconds >= MIN_TOKEN_TTL_SECONDS &&
    expiresInSeconds <= MAX_TOKEN_TTL_SECONDS
      ? Math.floor(expiresInSeconds * 1000)
      : DEFAULT_SHOPIFY_TOKEN_TTL_MS;

  return now + ttlMs;
}
