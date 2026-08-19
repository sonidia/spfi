import { defineEventHandler, readBody, setResponseHeader } from "h3";
import {
  callShopifyApi,
  createApiErrorFromMessage,
} from "~~/server/utils/callShopifyApi";
import {
  requireShopifyCredentials,
  requireShopifyPayload,
  requireShopifyResourceId,
} from "~~/server/utils/shopify-admin-request";
import { normalizeShopifyProductUpdate } from "~~/server/utils/shopify-product-update";
import { setShopifyMetafields } from "~~/server/utils/shopify-metafields-set";
import { prepareShopifyMetafieldsSetInputs } from "~~/server/utils/shopify-metafields-set-input";
import type { ProductsResponse } from "~~/types/shopify";
import type { ShopifyProductUpdateInput } from "~~/types/shopify-product";

interface ProductUpdateBody {
  storeId?: string;
  token?: string;
  product?: ShopifyProductUpdateInput;
}

export default defineEventHandler(async (event) => {
  const productId = requireShopifyResourceId(event.context.params?.id, "Product");
  const body = (await readBody<ProductUpdateBody>(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);
  const product = requireShopifyPayload<ShopifyProductUpdateInput>(
    body.product,
    "Product",
  );
  let metafieldInputs;
  try {
    metafieldInputs = prepareShopifyMetafieldsSetInputs(
      "Product",
      productId,
      product.metafields || [],
    );
  } catch (error) {
    throw createApiErrorFromMessage(
      error instanceof Error ? error.message : "Invalid product metafields.",
      400,
    );
  }
  const requestBody = {
    product: {
      ...normalizeShopifyProductUpdate(product),
      id: productId,
    },
  };

  const response = await callShopifyApi<ProductsResponse, typeof requestBody>({
    event,
    storeId,
    token,
    method: "PUT",
    path: `/products/${productId}.json`,
    body: requestBody,
    missingProxyMessage: "Missing sock proxy for this store.",
  });
  await setShopifyMetafields({
    event,
    storeId,
    token,
    inputs: metafieldInputs,
  });
  setResponseHeader(event, "x-spf-field-convention", "shopify-rest");
  return response;
});
