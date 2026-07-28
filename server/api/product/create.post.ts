import { createError, defineEventHandler, readBody } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
import type { ProductsResponse, ShopifyProductInput } from "~~/types/shopify";

interface ProductCreateBody {
  storeId?: string;
  token?: string;
  product?: ShopifyProductInput;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<ProductCreateBody>(event)) || {};
  const storeId = String(body.storeId || "");
  const token = String(body.token || "");
  const product = body.product;

  if (!storeId || !token || !product) {
    throw createError({
      statusCode: 400,
      statusMessage: "Store ID, Access Token, and Product payload are required.",
    });
  }

  return callShopifyApi<ProductsResponse, { product: ShopifyProductInput }>({
    event,
    storeId,
    token,
    method: "POST",
    path: "/products.json",
    body: { product },
  });
});
