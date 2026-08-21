import { defineEventHandler, readBody } from "h3";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";
import { saveMarketLocalization } from "~~/server/utils/shopify-market-management";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) || {};
  return saveMarketLocalization(
    { event, ...requireShopifyCredentials(body) },
    body.marketId,
    body.resourceId,
    body.fields,
    body.locale,
  );
});
