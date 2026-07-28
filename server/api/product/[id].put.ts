import { defineEventHandler, readBody } from "h3";
import {
  callShopifyApi,
  createApiErrorFromMessage,
} from "~~/server/utils/callShopifyApi";
import type { ProductsResponse, ShopifyProductInput } from "~~/types/shopify";

interface ProductUpdateBody {
  storeId?: string;
  token?: string;
  product?: ShopifyProductInput;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<ProductUpdateBody>(event)) || {};
  const storeId = String(body.storeId || "");
  const token = String(body.token || "");
  const product = body.product;
  const productId = event.context.params?.id;

  if (!storeId || !token || !product || !productId) {
    throw createApiErrorFromMessage("Store ID, Access Token, Product ID, and Payload are required.", 400);
  }

  return callShopifyApi<ProductsResponse, { product: ShopifyProductInput }>({
    event,
    storeId,
    token,
    method: "PUT",
    path: `/products/${productId}.json`,
    body: { product },
  });
});
