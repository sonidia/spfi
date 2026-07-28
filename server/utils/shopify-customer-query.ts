const CUSTOMER_LIST_PARAMS = new Set([
  "created_at_max",
  "created_at_min",
  "fields",
  "ids",
  "limit",
  "order",
  "since_id",
  "updated_at_max",
  "updated_at_min",
]);

const CUSTOMER_SEARCH_PARAMS = new Set([
  "fields",
  "limit",
  "order",
  "query",
]);

type CustomerRequestBody = Record<string, unknown>;
type ShopifyQueryValue = string | number | boolean;

export function buildCustomerQueryParams(
  body: CustomerRequestBody,
  isSearch: boolean,
) {
  const allowedParams = isSearch
    ? CUSTOMER_SEARCH_PARAMS
    : CUSTOMER_LIST_PARAMS;
  const params: Record<string, ShopifyQueryValue> = {};

  for (const [key, value] of Object.entries(body)) {
    if (!allowedParams.has(key) || !isQueryValue(value)) {
      continue;
    }

    if (key === "limit") {
      params.limit = normalizeLimit(value);
      continue;
    }

    params[key] = value;
  }

  if (!("limit" in params)) {
    params.limit = 250;
  }

  return params;
}

function isQueryValue(value: unknown): value is ShopifyQueryValue {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function normalizeLimit(value: ShopifyQueryValue) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 250;
  }

  return Math.min(250, Math.max(1, Math.trunc(parsed)));
}
