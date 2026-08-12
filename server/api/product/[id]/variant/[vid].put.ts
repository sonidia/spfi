import { defineEventHandler, readBody } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
import {
  requireShopifyCredentials,
  requireShopifyPayload,
  requireShopifyResourceId,
} from "~~/server/utils/shopify-admin-request";
import { assertVariantBelongsToProduct } from "~~/server/utils/shopify-product-ownership";
import type {
  ProductVariantsResponse,
  ShopifyVariantInput,
} from "~~/types/shopify-product";

interface ProductVariantUpdateBody {
  storeId?: string;
  token?: string;
  variant?: ShopifyVariantInput;
}

export default defineEventHandler(async (event) => {
  const productId = requireShopifyResourceId(event.context.params?.id, "Product");
  const variantId = requireShopifyResourceId(event.context.params?.vid, "Variant");
  const body = (await readBody<ProductVariantUpdateBody>(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);
  await assertVariantBelongsToProduct({
    event,
    storeId,
    token,
    productId,
    variantId,
  });
  const variant = requireShopifyPayload<ShopifyVariantInput>(body.variant, "Variant");
  const requestBody = {
    variant: {
      ...variant,
      id: variantId,
    },
  };

  return callShopifyApi<ProductVariantsResponse, typeof requestBody>({
    event,
    storeId,
    token,
    method: "PUT",
    path: `/variants/${variantId}.json`,
    body: requestBody,
    missingProxyMessage: "Missing sock proxy for this store.",
  });
});
