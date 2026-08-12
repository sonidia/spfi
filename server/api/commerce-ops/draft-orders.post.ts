import { defineEventHandler, readBody } from "h3";
import { fetchDraftOrders } from "~~/server/utils/shopify-draft-orders";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) || {};
  const auth = requireShopifyCredentials(body);
  return fetchDraftOrders({ event, ...auth });
});
