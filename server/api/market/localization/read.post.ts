import { defineEventHandler, readBody } from "h3";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";
import { fetchMarketLocalization } from "~~/server/utils/shopify-market-management";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) || {};
  return fetchMarketLocalization(
    { event, ...requireShopifyCredentials(body) },
    body.marketId,
    body.resourceId,
    body.locale,
  );
});
