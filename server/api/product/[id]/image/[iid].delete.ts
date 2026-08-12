import { defineEventHandler, readBody } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
import {
  requireShopifyCredentials,
  requireShopifyResourceId,
} from "~~/server/utils/shopify-admin-request";

interface ProductImageDeleteBody {
  storeId?: string;
  token?: string;
}

export default defineEventHandler(async (event) => {
  const productId = requireShopifyResourceId(
    event.context.params?.id,
    "Product",
  );
  const imageId = requireShopifyResourceId(
    event.context.params?.iid,
    "Image",
  );
  const body = (await readBody<ProductImageDeleteBody>(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);

  return callShopifyApi<Record<string, never>>({
    event,
    storeId,
    token,
    method: "DELETE",
    path: `/products/${productId}/images/${imageId}.json`,
    missingProxyMessage: "Missing sock proxy for this store.",
  });
});
