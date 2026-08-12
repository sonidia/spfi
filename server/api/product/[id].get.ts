import { defineEventHandler, getQuery } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
import {
  getShopifyQueryCredentials,
  requireShopifyResourceId,
} from "~~/server/utils/shopify-admin-request";
import { buildProductDetailParams } from "~~/server/utils/shopify-product-query";
import type { ProductResponse } from "~~/types/shopify-product";

export default defineEventHandler(async (event) => {
  const productId = requireShopifyResourceId(event.context.params?.id, "Product");
  const { storeId, token } = getShopifyQueryCredentials(event);

  return callShopifyApi<ProductResponse>({
    event,
    storeId,
    token,
    path: `/products/${productId}.json`,
    params: buildProductDetailParams(getQuery(event)),
    missingProxyMessage: "Missing sock proxy for this store.",
  });
});
