import { defineEventHandler, readBody } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
import {
  requireShopifyCredentials,
  requireShopifyPayload,
} from "~~/server/utils/shopify-admin-request";
import type { ProductsResponse, ShopifyProductInput } from "~~/types/shopify";

interface ProductCreateBody {
  storeId?: string;
  token?: string;
  product?: ShopifyProductInput;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<ProductCreateBody>(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);
  const product = requireShopifyPayload<ShopifyProductInput>(
    body.product,
    "Product",
  );

  return callShopifyApi<ProductsResponse, { product: ShopifyProductInput }>({
    event,
    storeId,
    token,
    method: "POST",
    path: "/products.json",
    body: { product },
    missingProxyMessage: "Missing sock proxy for this store.",
  });
});
