import { defineEventHandler, readBody } from "h3";
import { fetchFulfillmentMoveLocations } from "~~/server/utils/shopify-fulfillment-operations";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";

interface Body {
  storeId?: string;
  token?: string;
  id?: unknown;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<Body>(event)) || {};
  return fetchFulfillmentMoveLocations(
    { event, ...requireShopifyCredentials(body) },
    body.id,
  );
});
