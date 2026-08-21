import { defineEventHandler, readBody } from "h3";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";
import { updateMarketAssignments } from "~~/server/utils/shopify-market-management";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) || {};
  return updateMarketAssignments(
    { event, ...requireShopifyCredentials(body) },
    body.id,
    body.input,
  );
});
