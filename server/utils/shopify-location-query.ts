const MAX_LOCATION_LIMIT = 250;
const MAX_INVENTORY_ITEM_IDS = 50;

export function getFirstQueryValue(value: unknown): string {
  if (Array.isArray(value)) {
    return getFirstQueryValue(value[0]);
  }

  return typeof value === "string" ? value.trim() : "";
}

export function normalizeLocationLimit(value: unknown, fallback = 250): number {
  const raw = Number(getFirstQueryValue(value) || fallback);

  if (!Number.isFinite(raw)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(raw), 1), MAX_LOCATION_LIMIT);
}

export function normalizeInventoryItemIds(value: unknown): string[] {
  const rawValues = Array.isArray(value) ? value : [value];
  const ids = rawValues
    .flatMap((entry) => String(entry || "").split(","))
    .map((entry) => entry.trim())
    .filter((entry) => /^\d+$/.test(entry));

  return Array.from(new Set(ids)).slice(0, MAX_INVENTORY_ITEM_IDS);
}
