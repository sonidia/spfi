import { defineEventHandler, readBody } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
import {
  requireShopifyCredentials,
  requireShopifyResourceId,
} from "~~/server/utils/shopify-admin-request";
import { buildProductImageListParams } from "~~/server/utils/shopify-product-query";
import type { ProductImagesResponse } from "~~/types/shopify-product";

interface ProductImageListBody extends Record<string, unknown> {
  storeId?: string;
  token?: string;
  query?: Record<string, unknown>;
}

export default defineEventHandler(async (event) => {
  const productId = requireShopifyResourceId(
    event.context.params?.id,
    "Product",
  );
  const body = (await readBody<ProductImageListBody>(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);

  return callShopifyApi<ProductImagesResponse>({
    event,
    storeId,
    token,
    path: `/products/${productId}/images.json`,
    params: buildProductImageListParams(body.query || body),
    missingProxyMessage: "Missing sock proxy for this store.",
  });
});
