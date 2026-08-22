import { defineEventHandler, readBody } from "h3";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";
import { getShopifyCollectionDetail } from "~~/server/utils/shopify-collection-detail";
import { requireCollectionGid } from "~~/server/utils/shopify-collection-validation";

export default defineEventHandler(async (event) => {
  const body = (await readBody<{ storeId?: string; token?: string }>(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);
  const id = requireCollectionGid(event.context.params?.id);
  return getShopifyCollectionDetail({ event, storeId, token, id });
});
