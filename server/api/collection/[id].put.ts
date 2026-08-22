import { defineEventHandler, readBody } from "h3";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";
import { updateShopifyCollection } from "~~/server/utils/shopify-collection-management";
import {
  requireCollectionGid,
  validateCollectionUpdateDto,
} from "~~/server/utils/shopify-collection-validation";

export default defineEventHandler(async (event) => {
  const body =
    (await readBody<{ storeId?: string; token?: string; collection?: unknown }>(
      event,
    )) || {};
  const { storeId, token } = requireShopifyCredentials(body);
  const id = requireCollectionGid(event.context.params?.id);
  const input = validateCollectionUpdateDto(body.collection);
  return updateShopifyCollection({ event, storeId, token, id, input });
});
