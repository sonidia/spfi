import { readBrowserJson } from "./browser-storage";

export const KNOWN_STORES_STORAGE_KEY = "shopify_known_stores";

export function readKnownStores(): string[] {
  return normalizeKnownStores(readBrowserJson(KNOWN_STORES_STORAGE_KEY));
}

export function normalizeKnownStores(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export function writeKnownStores(storeIds: Iterable<string>) {
  if (typeof window === "undefined") return;

  const normalized = normalizeKnownStores(Array.from(storeIds));
  localStorage.setItem(KNOWN_STORES_STORAGE_KEY, JSON.stringify(normalized));
}
