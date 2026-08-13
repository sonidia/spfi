import { defineEventHandler, readBody } from "h3";
import { createApiErrorFromMessage } from "~~/server/utils/callShopifyApi";
import {
  requireShopifyCredentials,
  requireShopifyResourceId,
} from "~~/server/utils/shopify-admin-request";
import { isShopifyNumericId } from "~~/server/utils/shopify-id";
import { updateShopifyProductOptions } from "~~/server/utils/shopify-product-options";
import type { ShopifyProductOption } from "~~/types/shopify";

interface ProductOptionBulkBody {
  storeId?: string;
  token?: string;
  options?: ShopifyProductOption[];
}

export default defineEventHandler(async (event) => {
  const productId = requireShopifyResourceId(event.context.params?.id, "Product");
  const body = (await readBody<ProductOptionBulkBody>(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);
  const options = (Array.isArray(body.options) ? body.options : []).map(
    (option, index) => ({
      ...option,
      name: String(option.name || "").trim(),
      position: index + 1,
    }),
  );
  const uniqueNames = new Set(options.map((option) => option.name.toLowerCase()));

  if (
    !options.length ||
    options.length > 3 ||
    options.some((option) => !isShopifyNumericId(option.id) || !option.name) ||
    uniqueNames.size !== options.length
  ) {
    throw createApiErrorFromMessage(
      "Provide one to three existing options with unique, non-empty names.",
      400,
    );
  }

  return {
    options: await updateShopifyProductOptions({
      event,
      storeId,
      token,
      productId,
      productOptions: options,
    }),
  };
});
