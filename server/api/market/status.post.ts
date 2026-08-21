import { defineEventHandler, readBody } from "h3";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";
import { updateShopifyMarketStatus } from "~~/server/utils/shopify-markets";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) || {};
  const auth = requireShopifyCredentials(body);
  return updateShopifyMarketStatus({ event, ...auth }, body.id, body.status);
});
