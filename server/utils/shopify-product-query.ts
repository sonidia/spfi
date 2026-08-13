import { buildShopifyCursorPageParams } from "./shopify-pagination.ts";
import { pickPrimitiveQueryParams } from "./shopify-query-params.ts";
import type { ProductCountQuery, ProductListQuery } from "~~/types/shopify-product";

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

const PRODUCT_LIST_QUERY_KEYS = [
  ...PRODUCT_COUNT_QUERY_KEYS,
  "fields",
  "handle",
  "ids",
  "limit",
  "presentment_currencies",
  "since_id",
  "status",
  "title",
] as const;
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
  _query: Record<string, unknown> | null | undefined,
) {
  // The single-product REST endpoint does not accept `fields`. Keep this
  // helper temporarily so callers cannot accidentally forward arbitrary query
  // parameters while the product read path is migrated to GraphQL.
  return undefined;
}

export function buildProductListParams(query?: ProductListQuery) {
  const source = (query || {}) as Record<string, unknown>;
  const limit = normalizeProductPageSize(source.limit);
  const pageInfo = typeof source.page_info === "string" ? source.page_info.trim() : "";

  if (pageInfo) {
    return buildShopifyCursorPageParams(
      typeof source.fields === "string" ? { fields: source.fields } : {},
      pageInfo,
      limit,
    );
  }

  return {
    ...pickPrimitiveQueryParams(source, PRODUCT_LIST_QUERY_KEYS),
    limit,
  };
}

export function normalizeProductPageSize(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 50;
  return Math.min(100, Math.max(1, Math.trunc(parsed)));
}

export function buildProductSearchQuery(query?: ProductListQuery) {
  if (!query) return "";
  const terms: string[] = [];
  addSearchTerm(terms, "collection_id", query.collection_id);
  addSearchTerm(terms, "product_type", query.product_type);
  addSearchTerm(terms, "published_status", query.published_status);
  addSearchTerm(terms, "status", query.status);
  const title = String(query.title ?? "").trim();
  if (title) terms.push(quoteSearchValue(title));
  addSearchTerm(terms, "vendor", query.vendor);
  addRangeTerm(terms, "created_at", ">=", query.created_at_min);
  addRangeTerm(terms, "created_at", "<=", query.created_at_max);
  addRangeTerm(terms, "published_at", ">=", query.published_at_min);
  addRangeTerm(terms, "published_at", "<=", query.published_at_max);
  addRangeTerm(terms, "updated_at", ">=", query.updated_at_min);
  addRangeTerm(terms, "updated_at", "<=", query.updated_at_max);
  return terms.join(" AND ");
}

function addSearchTerm(terms: string[], field: string, value: unknown) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return;
  terms.push(`${field}:${quoteSearchValue(normalized)}`);
}

function addRangeTerm(
  terms: string[],
  field: string,
  comparator: ">=" | "<=",
  value: unknown,
) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return;
  terms.push(`${field}:${comparator}${quoteSearchValue(normalized)}`);
}

function quoteSearchValue(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
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
