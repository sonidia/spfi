import { defineEventHandler, readBody } from "h3";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";
import { deleteShopifyMarket } from "~~/server/utils/shopify-market-management";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) || {};
  return deleteShopifyMarket({ event, ...requireShopifyCredentials(body) }, body.id);
});
