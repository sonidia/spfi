import type {
  OrderCountQuery,
  OrderListQuery,
} from "~~/types/shopify-order";

const ORDER_LIST_PARAMS = new Set<keyof OrderListQuery>([
  "attribution_app_id",
  "created_at_max",
  "created_at_min",
  "fields",
  "financial_status",
  "fulfillment_status",
  "ids",
  "limit",
  "name",
  "processed_at_max",
  "processed_at_min",
  "since_id",
  "status",
  "updated_at_max",
  "updated_at_min",
]);

const ORDER_COUNT_PARAMS = new Set<keyof OrderCountQuery>([
  "created_at_max",
  "created_at_min",
  "financial_status",
  "fulfillment_status",
  "status",
  "updated_at_max",
  "updated_at_min",
]);

export function buildOrderListParams(input: unknown) {
  const params = pickOrderParams(input, ORDER_LIST_PARAMS);
  const limit = Number(params.limit ?? 250);

  params.limit = Number.isFinite(limit)
    ? Math.min(250, Math.max(1, Math.floor(limit)))
    : 250;
  params.status ??= "any";

  return params;
}

export function buildOrderCountParams(input: unknown) {
  return pickOrderParams(input, ORDER_COUNT_PARAMS);
}

function pickOrderParams(
  input: unknown,
  allowed: ReadonlySet<string>,
): Record<string, string | number | boolean> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};

  const params: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!allowed.has(key) || value === undefined || value === null || value === "") {
      continue;
    }
    if (["string", "number", "boolean"].includes(typeof value)) {
      params[key] = value as string | number | boolean;
    }
  }

  return params;
}
