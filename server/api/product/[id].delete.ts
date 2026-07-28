import { createError, defineEventHandler, readBody } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
import type { ProductsResponse } from "~~/types/shopify";

interface ProductDeleteBody {
  storeId?: string;
  token?: string;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<ProductDeleteBody>(event)) || {};
  const storeId = String(body.storeId || "");
  const token = String(body.token || "");
  const productId = event.context.params?.id;

  if (!storeId || !token || !productId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Store ID, Access Token, and Product ID are required.",
    });
  }

  return callShopifyApi<ProductsResponse>({
    event,
    storeId,
    token,
    method: "DELETE",
    path: `/products/${productId}.json`,
  });
});
