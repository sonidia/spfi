export function isShopifyNumericId(value: unknown): value is string | number {
  return /^\d+$/.test(String(value || "").trim());
}
