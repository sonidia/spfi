import { defineEventHandler, readBody } from "h3";
import { runBulkFulfillment } from "~~/server/utils/shopify-fulfillment-operations";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";

interface Body {
  storeId?: string;
  token?: string;
  ids?: unknown;
  notifyCustomer?: unknown;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<Body>(event)) || {};
  return runBulkFulfillment(
    { event, ...requireShopifyCredentials(body) },
    body.ids,
    body.notifyCustomer,
  );
});
