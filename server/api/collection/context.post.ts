import { defineEventHandler, readBody } from "h3";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";
import { getShopifyCollectionContext } from "~~/server/utils/shopify-collection-detail";

export default defineEventHandler(async (event) => {
  const body = (await readBody<{ storeId?: string; token?: string }>(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);
  return getShopifyCollectionContext({ event, storeId, token });
});
