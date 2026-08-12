import { defineEventHandler, readBody } from "h3";
import { createApiErrorFromMessage } from "~~/server/utils/callShopifyApi";
import { callShopifyPaginatedApi } from "~~/server/utils/callShopifyPaginatedApi";
import { buildCustomerQueryParams } from "~~/server/utils/shopify-customer-query";
import type { ShopifyCustomer } from "~~/types/shopify";

interface CustomerAllBody extends Record<string, unknown> {
  storeId?: string;
  token?: string;
  query?: string;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<CustomerAllBody>(event)) || {};
  const storeId = String(body.storeId || "").trim();
  const token = String(body.token || "").trim();
  const query = String(body.query || "").trim();

  if (!storeId || !token) {
    throw createApiErrorFromMessage("Store ID and Access Token are required.", 400);
  }

  const isSearch = query.length > 0;
  const params = buildCustomerQueryParams(
    { ...body, ...(isSearch ? { query } : {}) },
    isSearch,
  );

  const customers = await callShopifyPaginatedApi<ShopifyCustomer>({
    event,
    storeId,
    token,
    path: isSearch ? "/customers/search.json" : "/customers.json",
    resourceKey: "customers",
    params,
    missingProxyMessage: "Missing sock proxy for this store.",
  });

  return { customers };
});
