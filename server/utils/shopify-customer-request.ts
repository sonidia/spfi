import { getHeader, getQuery, type H3Event } from "h3";
import { createApiErrorFromMessage } from "./callShopifyApi";
import { isShopifyNumericId } from "./shopify-id";

export interface CustomerApiCredentials {
  storeId: string;
  token: string;
}

type CustomerCredentialInput = {
  storeId?: unknown;
  token?: unknown;
};

export function requireCustomerCredentials(
  input: CustomerCredentialInput,
): CustomerApiCredentials {
  const storeId = normalizeRequestValue(input.storeId);
  const token = normalizeRequestValue(input.token);

  if (!storeId || !token) {
    throw createApiErrorFromMessage(
      "Store ID and Access Token are required.",
      400,
    );
  }

  return { storeId, token };
}

export function getCustomerQueryCredentials(
  event: H3Event,
): CustomerApiCredentials {
  const query = getQuery(event);

  if (normalizeRequestValue(query.token)) {
    throw createApiErrorFromMessage(
      "Access Token must be sent in the X-Shopify-Access-Token header, not the query string.",
      400,
    );
  }

  return requireCustomerCredentials({
    storeId: query.storeId,
    token: getHeader(event, "x-shopify-access-token"),
  });
}

export function requireCustomerResourceId(
  value: unknown,
  resourceName: "Customer" | "Address",
) {
  const id = normalizeRequestValue(value);

  if (!isShopifyNumericId(id)) {
    throw createApiErrorFromMessage(
      `A numeric ${resourceName} ID is required.`,
      400,
    );
  }

  return id;
}

export function requireCustomerPayload<T extends Record<string, unknown>>(
  value: unknown,
  payloadName: "Customer" | "Address",
): T {
  if (!isRecord(value)) {
    throw createApiErrorFromMessage(
      `${payloadName} payload is required.`,
      400,
    );
  }

  return value as T;
}

export function normalizeRequestValue(value: unknown) {
  const firstValue = Array.isArray(value) ? value[0] : value;
  return String(firstValue || "").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
