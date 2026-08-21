import { defineEventHandler, readBody } from "h3";
import { createApiErrorFromMessage } from "~~/server/utils/callShopifyApi";
import {
  requireShopifyCredentials,
  requireShopifyResourceId,
} from "~~/server/utils/shopify-admin-request";
import { isShopifyNumericId } from "~~/server/utils/shopify-id";
import {
  createShopifyProductVariantsBulk,
  deleteShopifyProductVariantsBulk,
  updateShopifyProductVariantsBulk,
} from "~~/server/utils/shopify-product-variants-bulk";
import type { ShopifyNumericId } from "~~/types/shopify";
import type {
  ProductVariantBulkResult,
  ShopifyVariantInput,
} from "~~/types/shopify-product";

interface ProductVariantBulkBody {
  storeId?: string;
  token?: string;
  action?: "create" | "delete" | "update";
  variants?: ShopifyVariantInput[];
  variantIds?: ShopifyNumericId[];
  optionNames?: string[];
}

export default defineEventHandler(async (event) => {
  const productId = requireShopifyResourceId(event.context.params?.id, "Product");
  const body = (await readBody<ProductVariantBulkBody>(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);
  const optionNames = (body.optionNames || [])
    .slice(0, 3)
    .map((name) => String(name).trim());

  if (body.action === "delete") {
    const variantIds = Array.from(
      new Map(
        (body.variantIds || [])
          .filter(isShopifyNumericId)
          .map((id) => [String(id), id] as const),
      ).values(),
    );
    if (!variantIds.length || variantIds.length > 250) {
      throw createApiErrorFromMessage(
        "Provide between 1 and 250 numeric variant IDs.",
        400,
      );
    }
    const deletedIds = await deleteShopifyProductVariantsBulk({
      event,
      storeId,
      token,
      productId,
      variantIds,
    });
    return { deletedIds } satisfies ProductVariantBulkResult;
  }

  const variants = Array.isArray(body.variants) ? body.variants : [];
  if (!variants.length || variants.length > 250) {
    throw createApiErrorFromMessage("Provide between 1 and 250 variants.", 400);
  }
  if (body.action === "create") {
    return {
      variants: await createShopifyProductVariantsBulk({
        event,
        storeId,
        token,
        productId,
        variants,
        optionNames,
      }),
    } satisfies ProductVariantBulkResult;
  }
  if (body.action === "update") {
    if (variants.some((variant) => !isShopifyNumericId(variant.id))) {
      throw createApiErrorFromMessage(
        "Every bulk variant update requires a numeric variant ID.",
        400,
      );
    }
    return {
      variants: await updateShopifyProductVariantsBulk({
        event,
        storeId,
        token,
        productId,
        variants,
        optionNames,
      }),
    } satisfies ProductVariantBulkResult;
  }

  throw createApiErrorFromMessage("Variant bulk action is invalid.", 400);
});
