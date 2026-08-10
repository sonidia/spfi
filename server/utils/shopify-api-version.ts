import { createError, type H3Event } from "h3";
import { useRuntimeConfig } from "#imports";

export function getShopifyAdminApiBase(event: H3Event) {
  const config = useRuntimeConfig(event);
  const version = normalizeShopifyAdminApiVersion(config.adminApiVersion);

  if (!version) {
    throw createError({
      statusCode: 500,
      statusMessage:
        "Shopify Admin API version must use YYYY-01, YYYY-04, YYYY-07, or YYYY-10.",
    });
  }

  return `admin/api/${version}`;
}

export function normalizeShopifyAdminApiVersion(value: unknown) {
  const version = String(value || "").trim();
  return /^\d{4}-(?:01|04|07|10)$/.test(version) ? version : null;
}
