import {
  SHOPIFY_PAYOUT_STATUSES,
} from "~~/types/shopify-payment";
import { createApiErrorFromMessage } from "./callShopifyApi";

type QueryParams = Record<string, string | boolean>;
type UnknownRecord = Record<string, unknown>;

const PAYOUT_STATUS_SET = new Set<string>(SHOPIFY_PAYOUT_STATUSES);
const BALANCE_PAYOUT_STATUS_SET = new Set<string>([
  ...SHOPIFY_PAYOUT_STATUSES,
  "pending",
]);

export function buildPayoutQueryParams(input: unknown): QueryParams {
  const filters = toRecord(input);
  const params: QueryParams = {};

  addDate(params, "date", filters.date);
  addDate(params, "date_min", filters.date_min);
  addDate(params, "date_max", filters.date_max);
  addId(params, "since_id", filters.since_id);
  addId(params, "last_id", filters.last_id);
  addStatus(params, "status", filters.status, PAYOUT_STATUS_SET);

  validateDateRange(params);
  return params;
}

export function buildBalanceTransactionQueryParams(input: unknown): QueryParams {
  const filters = toRecord(input);
  const params: QueryParams = {};

  addId(params, "payout_id", filters.payout_id);
  addId(params, "since_id", filters.since_id);
  addId(params, "last_id", filters.last_id);
  addStatus(
    params,
    "payout_status",
    filters.payout_status,
    BALANCE_PAYOUT_STATUS_SET,
  );

  if (filters.test !== undefined && filters.test !== "") {
    if (typeof filters.test !== "boolean") {
      throw createApiErrorFromMessage(
        'The "test" filter must be true or false.',
        400,
      );
    }
    params.test = filters.test;
  }

  return params;
}

export function groupTransactionsByPayout<
  T extends { payout_id: string | number | null },
>(
  transactions: T[],
): Record<string, T[]> {
  const grouped: Record<string, T[]> = {};

  for (const transaction of transactions) {
    if (transaction.payout_id === null) continue;
    const key = String(transaction.payout_id);
    (grouped[key] ||= []).push(transaction);
  }

  return grouped;
}

function toRecord(input: unknown): UnknownRecord {
  return input && typeof input === "object" ? (input as UnknownRecord) : {};
}

function addId(
  params: QueryParams,
  key: "payout_id" | "since_id" | "last_id",
  value: unknown,
) {
  if (value === undefined || value === null || value === "") return;
  const normalized = String(value).trim();

  if (!/^\d+$/.test(normalized) || normalized === "0") {
    throw createApiErrorFromMessage(
      `The "${key}" filter must be a positive numeric ID.`,
      400,
    );
  }
  params[key] = normalized;
}

function addDate(
  params: QueryParams,
  key: "date" | "date_min" | "date_max",
  value: unknown,
) {
  if (value === undefined || value === null || value === "") return;
  const normalized = String(value).trim();

  if (!isIsoDate(normalized)) {
    throw createApiErrorFromMessage(
      `The "${key}" filter must be a valid YYYY-MM-DD date.`,
      400,
    );
  }
  params[key] = normalized;
}

function addStatus(
  params: QueryParams,
  key: "status" | "payout_status",
  value: unknown,
  allowed: Set<string>,
) {
  if (value === undefined || value === null || value === "") return;
  const normalized = String(value).trim().toLowerCase();

  if (!allowed.has(normalized)) {
    throw createApiErrorFromMessage(
      `Unsupported Shopify ${key} filter: ${normalized}.`,
      400,
    );
  }
  params[key] = normalized;
}

function isIsoDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function validateDateRange(params: QueryParams) {
  const min = params.date_min;
  const max = params.date_max;
  if (typeof min === "string" && typeof max === "string" && min > max) {
    throw createApiErrorFromMessage(
      '"date_min" cannot be after "date_max".',
      400,
    );
  }
}
