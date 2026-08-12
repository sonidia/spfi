import { defineEventHandler, readBody } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
import {
  requireShopifyCredentials,
  requireShopifyResourceId,
} from "~~/server/utils/shopify-admin-request";

interface ProductVariantDeleteBody {
  storeId?: string;
  token?: string;
}

export default defineEventHandler(async (event) => {
  const productId = requireShopifyResourceId(event.context.params?.id, "Product");
  const variantId = requireShopifyResourceId(event.context.params?.vid, "Variant");
  const body = (await readBody<ProductVariantDeleteBody>(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);

  return callShopifyApi<Record<string, never>>({
    event,
    storeId,
    token,
    method: "DELETE",
    path: `/products/${productId}/variants/${variantId}.json`,
    missingProxyMessage: "Missing sock proxy for this store.",
  });
});
