import { defineEventHandler, readBody } from "h3";
import { createApiErrorFromMessage } from "~~/server/utils/callShopifyApi";
import {
  requireShopifyCredentials,
  requireShopifyResourceId,
} from "~~/server/utils/shopify-admin-request";
import { isShopifyNumericId } from "~~/server/utils/shopify-id";
import { updateShopifyProductOptions } from "~~/server/utils/shopify-product-options";
import type {
  ShopifyProductOptionCreateVariantStrategy,
  ShopifyProductOptionMutationInput,
  ShopifyProductOptionUpdateVariantStrategy,
} from "~~/types/shopify-product";

interface ProductOptionBulkBody {
  storeId?: string;
  token?: string;
  options?: ShopifyProductOptionMutationInput[];
  updateVariantStrategy?: ShopifyProductOptionUpdateVariantStrategy;
  createVariantStrategy?: ShopifyProductOptionCreateVariantStrategy;
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
    options.some(
      (option) =>
        (option.id !== undefined && !isShopifyNumericId(option.id)) || !option.name,
    ) ||
    uniqueNames.size !== options.length
  ) {
    throw createApiErrorFromMessage(
      "Provide one to three options with valid IDs and unique, non-empty names.",
      400,
    );
  }
  if (
    body.updateVariantStrategy !== undefined &&
    !["LEAVE_AS_IS", "MANAGE"].includes(body.updateVariantStrategy)
  ) {
    throw createApiErrorFromMessage("Invalid option update variant strategy.", 400);
  }
  if (
    body.createVariantStrategy !== undefined &&
    !["LEAVE_AS_IS", "CREATE"].includes(body.createVariantStrategy)
  ) {
    throw createApiErrorFromMessage("Invalid option create variant strategy.", 400);
  }

  return {
    options: await updateShopifyProductOptions({
      event,
      storeId,
      token,
      productId,
      productOptions: options,
      updateVariantStrategy: body.updateVariantStrategy,
      createVariantStrategy: body.createVariantStrategy,
    }),
  };
});
