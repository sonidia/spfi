import type { StoreLocalData } from "~~/types/shopify";

export type StoreTokenState = "missing" | "expired" | "valid";

export function getStoreTokenState(
  data: StoreLocalData | null | undefined,
  now = Date.now(),
): StoreTokenState {
  if (!String(data?.accessToken || "").trim()) return "missing";
  if (data?.expiresTime && now >= data.expiresTime) return "expired";
  return "valid";
}

export function resolveStoreAccessToken(
  data: StoreLocalData | null | undefined,
  now = Date.now(),
): string {
  return getStoreTokenState(data, now) === "valid"
    ? String(data?.accessToken || "").trim()
    : "";
}
