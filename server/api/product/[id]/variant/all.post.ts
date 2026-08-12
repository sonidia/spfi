import { defineEventHandler, readBody } from "h3";
import { callShopifyPaginatedApi } from "~~/server/utils/callShopifyPaginatedApi";
import {
  requireShopifyCredentials,
  requireShopifyResourceId,
} from "~~/server/utils/shopify-admin-request";
import { buildProductVariantListParams } from "~~/server/utils/shopify-product-query";
import type { ShopifyVariant } from "~~/types/shopify";

interface ProductVariantListBody extends Record<string, unknown> {
  storeId?: string;
  token?: string;
  query?: Record<string, unknown>;
}

export default defineEventHandler(async (event) => {
  const productId = requireShopifyResourceId(event.context.params?.id, "Product");
  const body = (await readBody<ProductVariantListBody>(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);

  const variants = await callShopifyPaginatedApi<ShopifyVariant>({
    event,
    storeId,
    token,
    path: `/products/${productId}/variants.json`,
    resourceKey: "variants",
    params: buildProductVariantListParams(body.query || body),
    missingProxyMessage: "Missing sock proxy for this store.",
  });

  return { variants };
});
