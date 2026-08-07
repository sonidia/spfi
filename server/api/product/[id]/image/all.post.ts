import { defineEventHandler, readBody } from "h3";
import { callShopifyPaginatedApi } from "~~/server/utils/callShopifyPaginatedApi";
import {
  requireShopifyCredentials,
  requireShopifyResourceId,
} from "~~/server/utils/shopify-admin-request";
import { buildProductImageListParams } from "~~/server/utils/shopify-product-query";
import type { ShopifyProductImage } from "~~/types/shopify";

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

  const images = await callShopifyPaginatedApi<ShopifyProductImage>({
    event,
    storeId,
    token,
    path: `/products/${productId}/images.json`,
    resourceKey: "images",
    params: buildProductImageListParams(body.query || body),
    missingProxyMessage: "Missing sock proxy for this store.",
  });

  return { images };
});
