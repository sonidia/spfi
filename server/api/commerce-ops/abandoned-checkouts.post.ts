import { defineEventHandler, readBody } from "h3";
import { fetchAbandonedCheckouts } from "~~/server/utils/shopify-abandoned-checkouts";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) || {};
  const auth = requireShopifyCredentials(body);
  return fetchAbandonedCheckouts({ event, ...auth });
});
