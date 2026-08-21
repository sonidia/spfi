import { defineEventHandler, readBody } from "h3";
import {
  requireShopifyCredentials,
  requireShopifyPayload,
  requireShopifyResourceId,
} from "~~/server/utils/shopify-admin-request";
import { duplicateProduct } from "~~/server/utils/shopify-product-management";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) || {};
  const productId = requireShopifyResourceId(body.productId, "Product");
  const input = requireShopifyPayload<Record<string, unknown>>(
    body.input,
    "Product duplicate input",
  );
  return duplicateProduct(
    { event, ...requireShopifyCredentials(body) },
    productId,
    input,
  );
});
