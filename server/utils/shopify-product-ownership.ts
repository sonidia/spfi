import type { H3Event } from "h3";
import type { ProductVariantsResponse } from "~~/types/shopify-product";
import { callShopifyApi, createApiErrorFromMessage } from "./callShopifyApi";

interface VariantOwnershipContext {
  event: H3Event;
  storeId: string;
  token: string;
  productId: string;
  variantId: string;
}

export async function assertVariantBelongsToProduct({
  event,
  storeId,
  token,
  productId,
  variantId,
}: VariantOwnershipContext) {
  const response = await callShopifyApi<ProductVariantsResponse>({
    event,
    storeId,
    token,
    path: `/variants/${variantId}.json`,
    missingProxyMessage: "Missing sock proxy for this store.",
  });
  const actualProductId = response.variant?.product_id;

  if (!actualProductId) {
    throw createApiErrorFromMessage("Variant not found.", 404);
  }
  if (String(actualProductId) !== productId) {
    throw createApiErrorFromMessage(
      "The variant does not belong to the requested product.",
      409,
    );
  }
}
