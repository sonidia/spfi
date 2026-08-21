import { defineEventHandler, readBody } from "h3";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";
import { fetchProductManagementContext } from "~~/server/utils/shopify-product-management";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) || {};
  return fetchProductManagementContext({
    event,
    ...requireShopifyCredentials(body),
  });
});
