import { defineEventHandler, readBody, setResponseStatus } from "h3";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";
import { createShopifyCollection } from "~~/server/utils/shopify-collection-management";
import { validateCollectionCreateDto } from "~~/server/utils/shopify-collection-validation";

export default defineEventHandler(async (event) => {
  const body =
    (await readBody<{ storeId?: string; token?: string; collection?: unknown }>(
      event,
    )) || {};
  const { storeId, token } = requireShopifyCredentials(body);
  const input = validateCollectionCreateDto(body.collection);
  const result = await createShopifyCollection({ event, storeId, token, input });
  setResponseStatus(event, 201);
  return result;
});
