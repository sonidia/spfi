import { createError, defineEventHandler, readBody } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
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
    throw createError({
      statusCode: 400,
      statusMessage: "Store ID, Access Token, Product ID, and Payload are required.",
    });
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
