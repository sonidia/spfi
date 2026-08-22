import { defineEventHandler, readBody } from "h3";
import { duplicateShopifyCollection } from "~~/server/utils/shopify-collection-management";
import {
  requireCollectionGid,
  validateCollectionDuplicateDto,
} from "~~/server/utils/shopify-collection-validation";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);
  return duplicateShopifyCollection({
    event,
    storeId,
    token,
    id: requireCollectionGid(event.context.params?.id),
    input: validateCollectionDuplicateDto(body.duplicate),
  });
});
