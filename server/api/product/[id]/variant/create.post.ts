import { defineEventHandler, readBody } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
import {
  requireShopifyCredentials,
  requireShopifyPayload,
  requireShopifyResourceId,
} from "~~/server/utils/shopify-admin-request";
import type {
  ProductVariantsResponse,
  ShopifyVariantInput,
} from "~~/types/shopify-product";

interface ProductVariantCreateBody {
  storeId?: string;
  token?: string;
  variant?: ShopifyVariantInput;
}

export default defineEventHandler(async (event) => {
  const productId = requireShopifyResourceId(
    event.context.params?.id,
    "Product",
  );
  const body = (await readBody<ProductVariantCreateBody>(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);
  const variant = requireShopifyPayload<ShopifyVariantInput>(
    body.variant,
    "Variant",
  );

  return callShopifyApi<
    ProductVariantsResponse,
    { variant: ShopifyVariantInput }
  >({
    event,
    storeId,
    token,
    method: "POST",
    path: `/products/${productId}/variants.json`,
    body: { variant },
    missingProxyMessage: "Missing sock proxy for this store.",
  });
});
