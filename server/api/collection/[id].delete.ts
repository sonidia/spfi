import { defineEventHandler, readBody } from "h3";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";
import { deleteShopifyCollection } from "~~/server/utils/shopify-collection-management";
import { requireCollectionGid } from "~~/server/utils/shopify-collection-validation";

export default defineEventHandler(async (event) => {
  const body = (await readBody<{ storeId?: string; token?: string }>(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);
  const id = requireCollectionGid(event.context.params?.id);
  return deleteShopifyCollection({ event, storeId, token, id });
});
