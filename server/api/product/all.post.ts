import { defineEventHandler, readBody } from "h3";
import { callShopifyPaginatedApi } from "~~/server/utils/callShopifyPaginatedApi";
import { createApiSuccessResponse } from "~~/server/utils/api-response";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";
import type { ProductsListResponse, ShopifyProduct } from "~~/types/shopify";

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
  const { storeId, token } = requireShopifyCredentials(body);

  const products = await callShopifyPaginatedApi<ShopifyProduct>({
    event,
    storeId,
    token,
    path: "/products.json",
    resourceKey: "products",
    params: toShopifyQueryParams(body),
  });

  return createApiSuccessResponse(
    { products },
    {
      resource: "products",
      strategy: "complete",
      fieldConvention: "shopify-rest",
    },
  ) satisfies ProductsListResponse;
});
