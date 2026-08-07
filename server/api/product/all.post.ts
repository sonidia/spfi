import { defineEventHandler, readBody } from "h3";
import { createApiErrorFromMessage } from "~~/server/utils/callShopifyApi";
import { callShopifyPaginatedApi } from "~~/server/utils/callShopifyPaginatedApi";
import type { ShopifyProduct } from "~~/types/shopify";

interface ProductAllBody extends Record<string, unknown> {
  storeId?: string;
  token?: string;
}

function toShopifyQueryParams(body: Record<string, unknown>) {
  const params: Record<string, string | number | boolean | null> = {};

  for (const [key, value] of Object.entries(body)) {
    if (["storeId", "token"].includes(key)) {
      continue;
    }

    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      params[key] = value;
    }
  }

  return params;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<ProductAllBody>(event)) || {};
  const storeId = String(body.storeId || "");
  const token = String(body.token || "");

  if (!storeId || !token) {
    throw createApiErrorFromMessage("Store ID and Access Token are required.", 400);
  }

  const products = await callShopifyPaginatedApi<ShopifyProduct>({
    event,
    storeId,
    token,
    path: "/products.json",
    resourceKey: "products",
    params: toShopifyQueryParams(body),
  });

  return { products };
});
