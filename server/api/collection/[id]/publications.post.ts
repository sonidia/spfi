import { createError, defineEventHandler, readBody } from "h3";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";
import { getShopifyCollectionDetail } from "~~/server/utils/shopify-collection-detail";
import {
  requireCollectionGid,
  requirePublicationGids,
} from "~~/server/utils/shopify-collection-validation";
import { setShopifyPublishablePublications } from "~~/server/utils/shopify-publishable";

export default defineEventHandler(async (event) => {
  const body =
    (await readBody<{
      storeId?: string;
      token?: string;
      publicationIds?: unknown;
      publish?: unknown;
    }>(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);
  const id = requireCollectionGid(event.context.params?.id);
  if (typeof body.publish !== "boolean") {
    throw createError({ statusCode: 400, statusMessage: "publish must be a boolean." });
  }
  const publicationIds = requirePublicationGids(body.publicationIds);
  await setShopifyPublishablePublications({
    event,
    storeId,
    token,
    publishableId: id,
    publicationIds,
    publish: body.publish,
  });
  return getShopifyCollectionDetail({ event, storeId, token, id });
});
