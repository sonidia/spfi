import { pickPrimitiveQueryParams } from "./shopify-admin-request";
import type { ProductCountQuery } from "~~/types/shopify-product";

const PRODUCT_COUNT_QUERY_KEYS = [
  "collection_id",
  "created_at_max",
  "created_at_min",
  "product_type",
  "published_at_max",
  "published_at_min",
  "published_status",
  "updated_at_max",
  "updated_at_min",
  "vendor",
] as const;

const PRODUCT_DETAIL_QUERY_KEYS = ["fields"] as const;
const PRODUCT_VARIANT_LIST_QUERY_KEYS = [
  "fields",
  "limit",
  "presentment_currencies",
  "since_id",
] as const;
const PRODUCT_IMAGE_LIST_QUERY_KEYS = ["fields", "limit", "since_id"] as const;

export function buildProductCountParams(query?: ProductCountQuery) {
  return pickPrimitiveQueryParams(
    query as Record<string, unknown> | undefined,
    PRODUCT_COUNT_QUERY_KEYS,
  );
}

export function buildProductDetailParams(
  query: Record<string, unknown> | null | undefined,
) {
  return pickPrimitiveQueryParams(query, PRODUCT_DETAIL_QUERY_KEYS);
}

export function buildProductVariantListParams(
  query: Record<string, unknown> | null | undefined,
) {
  return pickPrimitiveQueryParams(query, PRODUCT_VARIANT_LIST_QUERY_KEYS);
}

export function buildProductImageListParams(
  query: Record<string, unknown> | null | undefined,
) {
  return pickPrimitiveQueryParams(query, PRODUCT_IMAGE_LIST_QUERY_KEYS);
}
