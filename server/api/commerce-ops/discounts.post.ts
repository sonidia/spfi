import { defineEventHandler, readBody } from "h3";
import { fetchDiscounts } from "~~/server/utils/shopify-discounts";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) || {};
  const auth = requireShopifyCredentials(body);
  return fetchDiscounts({ event, ...auth });
});
