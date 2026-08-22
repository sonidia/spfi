import { defineEventHandler, readBody } from "h3";
import { createApiErrorFromMessage } from "~~/server/utils/callShopifyApi";
import { runFulfillmentOrderAction } from "~~/server/utils/shopify-fulfillment-operations";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";
import type { FulfillmentOrderAction } from "~~/types/shopify-operations";

interface Body extends Record<string, unknown> {
  storeId?: string;
  token?: string;
  id?: unknown;
  action?: FulfillmentOrderAction;
}

const ACTIONS = new Set<FulfillmentOrderAction>([
  "fulfill",
  "hold",
  "releaseHold",
  "move",
  "updateTracking",
]);

export default defineEventHandler(async (event) => {
  const body = (await readBody<Body>(event)) || {};
  const auth = requireShopifyCredentials(body);
  if (!body.action || !ACTIONS.has(body.action)) {
    throw createApiErrorFromMessage("Invalid fulfillment action.", 400);
  }
  return runFulfillmentOrderAction({ event, ...auth }, body.action, body.id, body);
});
