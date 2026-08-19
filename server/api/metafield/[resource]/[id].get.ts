import { defineEventHandler, getQuery } from "h3";
import {
  callShopifyApi,
  createApiErrorFromMessage,
} from "~~/server/utils/callShopifyApi";
import { callShopifyPaginatedApi } from "~~/server/utils/callShopifyPaginatedApi";
import { getShopifyQueryCredentials } from "~~/server/utils/shopify-admin-request";
import { isShopifyNumericId } from "~~/server/utils/shopify-id";
import {
  buildMetafieldPath,
  resolveMetafieldResource,
} from "~~/server/utils/shopify-metafields";
import type { MetafieldsResponse, ShopifyMetafield } from "~~/types/shopify";

export default defineEventHandler(async (event) => {
  const resource = resolveMetafieldResource(event.context.params?.resource);
  const ownerId = String(event.context.params?.id || "").trim();
  const query = getQuery(event);
  const { storeId, token } = getShopifyQueryCredentials(event);
  const metafieldId = String(query.metafieldId || "").trim();

  if (!resource) {
    throw createApiErrorFromMessage(
      "Resource must be product, order, or customer.",
      400,
    );
  }

  if (
    !isShopifyNumericId(ownerId) ||
    (metafieldId && !isShopifyNumericId(metafieldId)) ||
    !storeId ||
    !token
  ) {
    throw createApiErrorFromMessage(
      "A numeric Resource ID, Store ID and Access Token are required.",
      400,
    );
  }

  if (metafieldId) {
    return callShopifyApi<MetafieldsResponse>({
      event,
      storeId,
      token,
      path: buildMetafieldPath(resource, ownerId, metafieldId),
      missingProxyMessage: "Missing sock proxy for this store.",
    });
  }

  const metafields = await callShopifyPaginatedApi<ShopifyMetafield>({
    event,
    storeId,
    token,
    path: buildMetafieldPath(resource, ownerId),
    resourceKey: "metafields",
    params: {
      ...(typeof query.namespace === "string" ? { namespace: query.namespace } : {}),
      ...(typeof query.key === "string" ? { key: query.key } : {}),
      ...(typeof query.fields === "string" ? { fields: query.fields } : {}),
    },
    missingProxyMessage: "Missing sock proxy for this store.",
  });

  return { metafields } satisfies MetafieldsResponse;
});
