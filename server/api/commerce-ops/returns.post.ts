import { defineEventHandler, readBody } from "h3";
import { fetchReturns } from "~~/server/utils/shopify-returns";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) || {};
  const auth = requireShopifyCredentials(body);
  return fetchReturns({ event, ...auth });
});
