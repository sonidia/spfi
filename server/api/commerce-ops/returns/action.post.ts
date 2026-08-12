import { defineEventHandler, readBody } from "h3";
import { createApiErrorFromMessage } from "~~/server/utils/callShopifyApi";
import { runReturnAction } from "~~/server/utils/shopify-returns";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";
import type { ReturnAction, ReturnActionInput } from "~~/types/shopify-operations";

interface Body extends ReturnActionInput {
  storeId?: string;
  token?: string;
  id?: string;
  action?: ReturnAction;
}

const ACTIONS = new Set<ReturnAction>(["approve", "decline", "close", "cancel"]);

export default defineEventHandler(async (event) => {
  const body = (await readBody<Body>(event)) || {};
  const auth = requireShopifyCredentials(body);
  if (!body.action || !ACTIONS.has(body.action)) {
    throw createApiErrorFromMessage("Invalid return action.", 400);
  }
  return runReturnAction({ event, ...auth }, body.id, body.action, body);
});
