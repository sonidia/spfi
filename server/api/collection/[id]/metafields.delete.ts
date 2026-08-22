import { defineEventHandler, readBody } from "h3";
import { deleteCollectionMetafields } from "~~/server/utils/shopify-collection-metafield";
import {
  requireCollectionGid,
  validateCollectionMetafieldIdentifiers,
} from "~~/server/utils/shopify-collection-validation";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);
  return deleteCollectionMetafields({
    event,
    storeId,
    token,
    id: requireCollectionGid(event.context.params?.id),
    identifiers: validateCollectionMetafieldIdentifiers(body.metafields),
  });
});
