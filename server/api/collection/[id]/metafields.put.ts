import { defineEventHandler, readBody } from "h3";
import { setCollectionMetafields } from "~~/server/utils/shopify-collection-metafield";
import {
  requireCollectionGid,
  validateCollectionMetafieldInputs,
} from "~~/server/utils/shopify-collection-validation";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);
  return setCollectionMetafields({
    event,
    storeId,
    token,
    id: requireCollectionGid(event.context.params?.id),
    inputs: validateCollectionMetafieldInputs(body.metafields),
  });
});
