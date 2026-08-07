import { defineEventHandler, readBody } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
import {
  requireShopifyCredentials,
  requireShopifyPayload,
  requireShopifyResourceId,
  requireShopifySafeResourceNumber,
} from "~~/server/utils/shopify-admin-request";
import type {
  ProductImagesResponse,
  ShopifyProductImageInput,
} from "~~/types/shopify-product";

interface ProductImageUpdateBody {
  storeId?: string;
  token?: string;
  image?: ShopifyProductImageInput;
}

export default defineEventHandler(async (event) => {
  const productId = requireShopifyResourceId(
    event.context.params?.id,
    "Product",
  );
  const imageId = requireShopifyResourceId(
    event.context.params?.iid,
    "Image",
  );
  const body = (await readBody<ProductImageUpdateBody>(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);
  const image = requireShopifyPayload<ShopifyProductImageInput>(
    body.image,
    "Image",
  );
  const requestBody = {
    image: {
      ...image,
      id: requireShopifySafeResourceNumber(imageId, "Image"),
    },
  };

  return callShopifyApi<ProductImagesResponse, typeof requestBody>({
    event,
    storeId,
    token,
    method: "PUT",
    path: `/products/${productId}/images/${imageId}.json`,
    body: requestBody,
    missingProxyMessage: "Missing sock proxy for this store.",
  });
});
