import { defineEventHandler, readBody } from "h3";
import { createApiErrorFromMessage } from "~~/server/utils/callShopifyApi";
import { runDiscountAction } from "~~/server/utils/shopify-discounts";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";
import type { DiscountAction } from "~~/types/shopify-operations";

interface Body {
  storeId?: string;
  token?: string;
  id?: string;
  action?: DiscountAction;
}

const ACTIONS = new Set<DiscountAction>(["activate", "deactivate"]);

export default defineEventHandler(async (event) => {
  const body = (await readBody<Body>(event)) || {};
  const auth = requireShopifyCredentials(body);
  if (!body.action || !ACTIONS.has(body.action)) {
    throw createApiErrorFromMessage("Invalid discount action.", 400);
  }
  return runDiscountAction({ event, ...auth }, body.id, body.action);
});
