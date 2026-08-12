import { createApiErrorFromMessage } from "./callShopifyApi";

type QueryParams = Record<string, string | boolean>;
type UnknownRecord = Record<string, unknown>;

export function buildOrderTransactionListParams(input: unknown): QueryParams {
  const query = toRecord(input);
  return {
    ...buildOrderTransactionDetailParams(query),
    ...(query.since_id !== undefined && query.since_id !== ""
      ? { since_id: normalizeId(query.since_id, "since_id") }
      : {}),
  };
}

export function buildOrderTransactionDetailParams(input: unknown): QueryParams {
  const query = toRecord(input);
  const params: QueryParams = {};

  if (query.fields !== undefined && query.fields !== "") {
    const fields = String(query.fields)
      .split(",")
      .map((field) => field.trim())
      .filter(Boolean);
    if (!fields.length || fields.some((field) => !/^[a-z][a-z0-9_]*$/i.test(field))) {
      throw createApiErrorFromMessage(
        'The "fields" query must be a comma-separated list of Shopify field names.',
        400,
      );
    }
    params.fields = Array.from(new Set(fields)).join(",");
  }

  if (query.in_shop_currency !== undefined && query.in_shop_currency !== "") {
    params.in_shop_currency = normalizeBoolean(
      query.in_shop_currency,
      "in_shop_currency",
    );
  }

  return params;
}

function normalizeId(value: unknown, field: string) {
  const normalized = String(value).trim();
  if (!/^\d+$/.test(normalized) || normalized === "0") {
    throw createApiErrorFromMessage(
      `The "${field}" query must be a positive numeric ID.`,
      400,
    );
  }
  return normalized;
}

function normalizeBoolean(value: unknown, field: string) {
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  throw createApiErrorFromMessage(`The "${field}" query must be true or false.`, 400);
}

function toRecord(input: unknown): UnknownRecord {
  return input && typeof input === "object" ? (input as UnknownRecord) : {};
}
