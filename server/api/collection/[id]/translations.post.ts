import { defineEventHandler, readBody } from "h3";
import { getCollectionTranslations } from "~~/server/utils/shopify-collection-localization";
import { requireCollectionGid } from "~~/server/utils/shopify-collection-validation";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);
  return getCollectionTranslations({
    event,
    storeId,
    token,
    id: requireCollectionGid(event.context.params?.id),
    locale: body.locale,
  });
});
