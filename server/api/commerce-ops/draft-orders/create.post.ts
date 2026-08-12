import { defineEventHandler, readBody } from "h3";
import { createDraftOrder } from "~~/server/utils/shopify-draft-orders";
import {
  requireShopifyCredentials,
  requireShopifyPayload,
} from "~~/server/utils/shopify-admin-request";
import type { DraftOrderCreateInput } from "~~/types/shopify-operations";

interface Body {
  storeId?: string;
  token?: string;
  input?: DraftOrderCreateInput;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<Body>(event)) || {};
  const auth = requireShopifyCredentials(body);
  const input = requireShopifyPayload<DraftOrderCreateInput>(body.input, "Draft order");
  return { draftOrder: await createDraftOrder({ event, ...auth }, input) };
});
