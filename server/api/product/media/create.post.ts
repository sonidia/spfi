import { defineEventHandler, readBody } from "h3";
import {
  requireShopifyCredentials,
  requireShopifyPayload,
  requireShopifyResourceId,
} from "~~/server/utils/shopify-admin-request";
import { createProductMedia } from "~~/server/utils/shopify-product-management";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) || {};
  const productId = requireShopifyResourceId(body.productId, "Product");
  const input = requireShopifyPayload<Record<string, unknown>>(
    body.input,
    "Product media input",
  );
  return createProductMedia(
    { event, ...requireShopifyCredentials(body) },
    productId,
    input,
  );
});
