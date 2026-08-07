import { defineEventHandler, readBody } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
import {
  requireShopifyCredentials,
  requireShopifyResourceId,
} from "~~/server/utils/shopify-admin-request";
import { buildProductVariantListParams } from "~~/server/utils/shopify-product-query";
import type { ProductVariantsResponse } from "~~/types/shopify-product";

interface ProductVariantListBody extends Record<string, unknown> {
  storeId?: string;
  token?: string;
  query?: Record<string, unknown>;
}

export default defineEventHandler(async (event) => {
  const productId = requireShopifyResourceId(
    event.context.params?.id,
    "Product",
  );
  const body = (await readBody<ProductVariantListBody>(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);

  return callShopifyApi<ProductVariantsResponse>({
    event,
    storeId,
    token,
    path: `/products/${productId}/variants.json`,
    params: buildProductVariantListParams(body.query || body),
    missingProxyMessage: "Missing sock proxy for this store.",
  });
});
