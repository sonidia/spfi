import { defineEventHandler, readBody } from "h3";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";
import { updateShopifyCollectionSelections } from "~~/server/utils/shopify-collection-management";
import {
  requireCollectionGid,
  validateCollectionSelectionDelta,
} from "~~/server/utils/shopify-collection-validation";

export default defineEventHandler(async (event) => {
  const body =
    (await readBody<{ storeId?: string; token?: string; delta?: unknown }>(event)) ||
    {};
  const { storeId, token } = requireShopifyCredentials(body);
  const id = requireCollectionGid(event.context.params?.id);
  const delta = validateCollectionSelectionDelta(body.delta);
  return updateShopifyCollectionSelections({ event, storeId, token, id, delta });
});
