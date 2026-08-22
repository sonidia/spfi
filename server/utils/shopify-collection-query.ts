import type {
  CollectionListQuery,
  CollectionSortKey,
} from "~~/types/shopify-collection";

const COLLECTION_SORT_KEYS = new Set<CollectionSortKey>([
  "ID",
  "RELEVANCE",
  "TITLE",
  "UPDATED_AT",
]);

export function normalizeCollectionPageSize(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 50;
  return Math.min(100, Math.max(1, Math.trunc(parsed)));
}

export function buildCollectionSearchQuery(query?: CollectionListQuery) {
  if (!query) return "";
  const terms: string[] = [];
  const search = String(query.search || "").trim();
  if (search) terms.push(`title:${quoteSearchValue(`${search}*`)}`);
  addSearchTerm(terms, "handle", query.handle);
  addNumericSearchTerm(terms, "product_id", query.productId);
  addSearchTerm(terms, "published_status", query.publishedStatus);
  addDateTerm(terms, "updated_at", ">=", query.updatedAtMin);
  addDateTerm(terms, "updated_at", "<=", query.updatedAtMax);
  return terms.join(" AND ");
}

export function resolveCollectionSort(query?: CollectionListQuery) {
  const search = String(query?.search || "").trim();
  const candidate = String(query?.sortKey || "UPDATED_AT").toUpperCase();
  const requested = COLLECTION_SORT_KEYS.has(candidate as CollectionSortKey)
    ? (candidate as CollectionSortKey)
    : "UPDATED_AT";
  const sortKey = requested === "RELEVANCE" && !search ? "UPDATED_AT" : requested;
  return {
    sortKey,
    reverse: typeof query?.reverse === "boolean" ? query.reverse : true,
  };
}

function addSearchTerm(terms: string[], field: string, value: unknown) {
  const normalized = String(value ?? "").trim();
  if (normalized) terms.push(`${field}:${quoteSearchValue(normalized)}`);
}

function addNumericSearchTerm(terms: string[], field: string, value: unknown) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return;
  const numeric = normalized.startsWith("gid://shopify/Product/")
    ? normalized.slice(normalized.lastIndexOf("/") + 1)
    : normalized;
  if (/^\d+$/.test(numeric)) terms.push(`${field}:${numeric}`);
}

function addDateTerm(
  terms: string[],
  field: string,
  comparator: ">=" | "<=",
  value: unknown,
) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return;
  const timestamp = Date.parse(normalized);
  if (Number.isFinite(timestamp)) {
    terms.push(
      `${field}:${comparator}${quoteSearchValue(new Date(timestamp).toISOString())}`,
    );
  }
}

function quoteSearchValue(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
