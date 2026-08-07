import { getHeader, getQuery, type H3Event } from "h3";
import { createApiErrorFromMessage } from "./callShopifyApi";
import { isShopifyNumericId } from "./shopify-id";

export interface ShopifyApiCredentials {
  storeId: string;
  token: string;
}

interface CredentialInput {
  storeId?: unknown;
  token?: unknown;
}

export function requireShopifyCredentials(
  input: CredentialInput,
): ShopifyApiCredentials {
  const storeId = normalizeShopifyRequestValue(input.storeId);
  const token = normalizeShopifyRequestValue(input.token);

  if (!storeId || !token) {
    throw createApiErrorFromMessage(
      "Store ID and Access Token are required.",
      400,
    );
  }

  return { storeId, token };
}

export function getShopifyQueryCredentials(
  event: H3Event,
): ShopifyApiCredentials {
  const query = getQuery(event);

  return requireShopifyCredentials({
    storeId: query.storeId,
    token:
      getHeader(event, "x-shopify-access-token") ||
      normalizeShopifyRequestValue(query.token),
  });
}

export function requireShopifyResourceId(
  value: unknown,
  resourceName: string,
) {
  const id = normalizeShopifyRequestValue(value);

  if (!isShopifyNumericId(id)) {
    throw createApiErrorFromMessage(
      `A numeric ${resourceName} ID is required.`,
      400,
    );
  }

  return id;
}

export function requireShopifySafeResourceNumber(
  value: unknown,
  resourceName: string,
) {
  const id = requireShopifyResourceId(value, resourceName);
  const numberValue = Number(id);

  if (!Number.isSafeInteger(numberValue)) {
    throw createApiErrorFromMessage(
      `${resourceName} ID exceeds JavaScript's safe integer range.`,
      400,
    );
  }

  return numberValue;
}

export function requireShopifyPayload<T extends object>(
  value: unknown,
  payloadName: string,
): T {
  if (!isRecord(value)) {
    throw createApiErrorFromMessage(
      `${payloadName} payload is required.`,
      400,
    );
  }

  return value as T;
}

export function requireShopifyInteger(
  value: unknown,
  fieldName: string,
): number {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && !value.trim())
  ) {
    throw createApiErrorFromMessage(
      `${fieldName} must be a safe integer.`,
      400,
    );
  }

  const numberValue = Number(value);

  if (!Number.isSafeInteger(numberValue)) {
    throw createApiErrorFromMessage(
      `${fieldName} must be a safe integer.`,
      400,
    );
  }

  return numberValue;
}

export function normalizeShopifyRequestValue(value: unknown) {
  const firstValue = Array.isArray(value) ? value[0] : value;
  return String(firstValue || "").trim();
}

export function pickPrimitiveQueryParams(
  input: Record<string, unknown> | null | undefined,
  allowedKeys: readonly string[],
) {
  const params: Record<string, string | number | boolean> = {};

  for (const key of allowedKeys) {
    const value = input?.[key];

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      params[key] = value;
    }
  }

  return params;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
