import { defineEventHandler, readBody } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
import {
  requireShopifyCredentials,
  requireShopifyPayload,
  requireShopifyResourceId,
} from "~~/server/utils/shopify-admin-request";
import type {
  ProductImagesResponse,
  ShopifyProductImageInput,
} from "~~/types/shopify-product";

interface ProductImageCreateBody {
  storeId?: string;
  token?: string;
  image?: ShopifyProductImageInput;
}

export default defineEventHandler(async (event) => {
  const productId = requireShopifyResourceId(
    event.context.params?.id,
    "Product",
  );
  const body = (await readBody<ProductImageCreateBody>(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);
  const image = requireShopifyPayload<ShopifyProductImageInput>(
    body.image,
    "Image",
  );

  return callShopifyApi<
    ProductImagesResponse,
    { image: ShopifyProductImageInput }
  >({
    event,
    storeId,
    token,
    method: "POST",
    path: `/products/${productId}/images.json`,
    body: { image },
    missingProxyMessage: "Missing sock proxy for this store.",
  });
});
