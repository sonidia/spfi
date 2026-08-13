import { defineEventHandler, readBody } from "h3";
import {
  requireShopifyCredentials,
  requireShopifyPayload,
  requireShopifyResourceId,
} from "~~/server/utils/shopify-admin-request";
import { updateProductAdvancedDetails } from "~~/server/utils/shopify-product-management";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) || {};
  const productId = requireShopifyResourceId(body.productId, "Product");
  const input = requireShopifyPayload<Record<string, unknown>>(
    body.input,
    "Advanced product input",
  );
  return updateProductAdvancedDetails(
    { event, ...requireShopifyCredentials(body) },
    productId,
    input,
  );
});
