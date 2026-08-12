import { defineEventHandler, readBody } from "h3";
import { createApiErrorFromMessage } from "~~/server/utils/callShopifyApi";
import { runDraftOrderAction } from "~~/server/utils/shopify-draft-orders";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";
import type { DraftOrderAction } from "~~/types/shopify-operations";

interface Body {
  storeId?: string;
  token?: string;
  id?: string;
  action?: DraftOrderAction;
}

const ACTIONS = new Set<DraftOrderAction>(["complete", "invoice", "delete"]);

export default defineEventHandler(async (event) => {
  const body = (await readBody<Body>(event)) || {};
  const auth = requireShopifyCredentials(body);
  if (!body.action || !ACTIONS.has(body.action)) {
    throw createApiErrorFromMessage("Invalid draft order action.", 400);
  }
  return runDraftOrderAction({ event, ...auth }, body.id, body.action);
});
