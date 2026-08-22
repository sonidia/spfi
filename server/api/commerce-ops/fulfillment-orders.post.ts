import { defineEventHandler, readBody } from "h3";
import { fetchFulfillmentOrders } from "~~/server/utils/shopify-fulfillment-operations";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";

interface Body {
  storeId?: string;
  token?: string;
  status?: unknown;
  after?: unknown;
  limit?: unknown;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<Body>(event)) || {};
  return fetchFulfillmentOrders({ event, ...requireShopifyCredentials(body) }, body);
});
