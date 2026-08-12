import { defineEventHandler, getQuery } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
import {
  getShopifyQueryCredentials,
  pickPrimitiveQueryParams,
  requireShopifyResourceId,
} from "~~/server/utils/shopify-admin-request";
import type { ProductImagesResponse } from "~~/types/shopify-product";

export default defineEventHandler(async (event) => {
  const productId = requireShopifyResourceId(event.context.params?.id, "Product");
  const imageId = requireShopifyResourceId(event.context.params?.iid, "Image");
  const { storeId, token } = getShopifyQueryCredentials(event);

  return callShopifyApi<ProductImagesResponse>({
    event,
    storeId,
    token,
    path: `/products/${productId}/images/${imageId}.json`,
    params: pickPrimitiveQueryParams(getQuery(event), ["fields"]),
    missingProxyMessage: "Missing sock proxy for this store.",
  });
});
