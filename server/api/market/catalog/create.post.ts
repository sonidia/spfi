import { defineEventHandler, readBody } from "h3";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";
import { createMarketCatalog } from "~~/server/utils/shopify-market-management";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) || {};
  return createMarketCatalog(
    { event, ...requireShopifyCredentials(body) },
    body.marketId,
    body.input,
  );
});
