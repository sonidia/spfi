import type {
  OrderCountQuery,
  OrderFulfillmentListQuery,
  OrderListQuery,
  OrderRefundListQuery,
} from "~~/types/shopify-order";
import { createError } from "h3";

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
  "page_info",
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

const ORDER_REFUND_LIST_PARAMS = new Set<keyof OrderRefundListQuery>([
  "fields",
  "in_shop_currency",
  "limit",
]);

const ORDER_FULFILLMENT_LIST_PARAMS = new Set<keyof OrderFulfillmentListQuery>([
  "created_at_max",
  "created_at_min",
  "fields",
  "limit",
  "since_id",
  "updated_at_max",
  "updated_at_min",
]);

export function buildOrderListParams(input: unknown) {
  const params = pickOrderParams(input, ORDER_LIST_PARAMS);
  params.limit = normalizeOrderListLimit(params.limit, 250);

  const cursor = normalizeOrderCursor(params.page_info);
  if (cursor) {
    return {
      page_info: cursor,
      limit: params.limit,
      ...(params.fields ? { fields: params.fields } : {}),
    };
  }

  params.status ??= "any";

  return params;
}

function normalizeOrderCursor(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const cursor = String(value).trim();
  if (!cursor || cursor.length > 4096 || /[\u0000-\u001f\u007f\s]/.test(cursor)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid Shopify pagination cursor.",
    });
  }
  return cursor;
}

export function buildOrderCountParams(input: unknown) {
  return pickOrderParams(input, ORDER_COUNT_PARAMS);
}

export function buildOrderRefundListParams(input: unknown) {
  return normalizeOptionalOrderListLimit(
    pickOrderParams(input, ORDER_REFUND_LIST_PARAMS),
  );
}

export function buildOrderFulfillmentListParams(input: unknown) {
  return normalizeOptionalOrderListLimit(
    pickOrderParams(input, ORDER_FULFILLMENT_LIST_PARAMS),
  );
}

function normalizeOptionalOrderListLimit(
  params: Record<string, string | number | boolean>,
) {
  if (params.limit !== undefined) {
    params.limit = normalizeOrderListLimit(params.limit, 50);
  }

  return params;
}

function normalizeOrderListLimit(
  value: string | number | boolean | undefined,
  fallback: number,
) {
  const limit = Number(value ?? fallback);

  return Number.isFinite(limit)
    ? Math.min(250, Math.max(1, Math.floor(limit)))
    : fallback;
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
