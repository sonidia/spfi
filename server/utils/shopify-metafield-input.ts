import type {
  ShopifyMetafieldInput,
  ShopifyMetafieldValueInput,
} from "~~/types/shopify-product";

export interface NormalizedShopifyMetafieldInput {
  id?: ShopifyMetafieldInput["id"];
  namespace: string;
  key: string;
  value: string;
  type: string;
  description?: string | null;
}

export function normalizeShopifyMetafieldInput(
  input?: ShopifyMetafieldInput,
): NormalizedShopifyMetafieldInput | null {
  if (!input || input.value === undefined) return null;

  const namespace = String(input.namespace || "").trim();
  const key = String(input.key || "").trim();
  const type = String(input.type || "").trim();
  if (!namespace || !key || !type) return null;

  return {
    ...(input.id !== undefined ? { id: input.id } : {}),
    namespace,
    key,
    value: serializeShopifyMetafieldValue(input.value),
    type,
    ...(typeof input.description === "string"
      ? { description: input.description.trim() || null }
      : input.description === null
        ? { description: null }
        : {}),
  };
}

/** Shopify REST stores every metafield value as a string, including JSON values. */
export function serializeShopifyMetafieldValue(
  value: ShopifyMetafieldValueInput,
): string {
  if (typeof value === "string") return value;
  if (value === null || typeof value === "object") return JSON.stringify(value);
  return String(value);
}
