import { defineEventHandler, readBody } from "h3";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";
import { fetchShopifyMarket } from "~~/server/utils/shopify-markets";
import { createApiErrorFromMessage } from "~~/server/utils/callShopifyApi";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) || {};
  const auth = requireShopifyCredentials(body);
  const market = await fetchShopifyMarket({ event, ...auth }, String(body.id || ""));
  if (!market) {
    throw createApiErrorFromMessage("Shopify did not return this market.", 404);
  }
  return market;
});
