import { defineEventHandler, readBody } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
import {
  requireShopifyCredentials,
  requireShopifyPayload,
  requireShopifyResourceId,
} from "~~/server/utils/shopify-admin-request";
import { normalizeShopifyProductUpdate } from "~~/server/utils/shopify-product-update";
import type { ProductsResponse } from "~~/types/shopify";
import type { ShopifyProductUpdateInput } from "~~/types/shopify-product";

interface ProductUpdateBody {
  storeId?: string;
  token?: string;
  product?: ShopifyProductUpdateInput;
}

export default defineEventHandler(async (event) => {
  const productId = requireShopifyResourceId(event.context.params?.id, "Product");
  const body = (await readBody<ProductUpdateBody>(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);
  const product = requireShopifyPayload<ShopifyProductUpdateInput>(
    body.product,
    "Product",
  );
  const requestBody = {
    product: {
      ...normalizeShopifyProductUpdate(product),
      id: productId,
    },
  };

  return callShopifyApi<ProductsResponse, typeof requestBody>({
    event,
    storeId,
    token,
    method: "PUT",
    path: `/products/${productId}.json`,
    body: requestBody,
    missingProxyMessage: "Missing sock proxy for this store.",
  });
});
