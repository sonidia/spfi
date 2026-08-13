import { defineEventHandler, readBody } from "h3";
import { createApiErrorFromMessage } from "~~/server/utils/callShopifyApi";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";
import { isShopifyNumericId } from "~~/server/utils/shopify-id";
import { runBulkProductAction } from "~~/server/utils/shopify-product-management";
import type { ShopifyNumericId } from "~~/types/shopify";

interface BulkActionBody {
  storeId?: string;
  token?: string;
  productIds?: ShopifyNumericId[];
  action?: "ARCHIVE" | "DELETE";
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<BulkActionBody>(event)) || {};
  const productIds = Array.from(
    new Map(
      (Array.isArray(body.productIds) ? body.productIds : [])
        .filter(isShopifyNumericId)
        .map((id) => [String(id), id] as const),
    ).values(),
  );
  if (
    !productIds.length ||
    productIds.length > 250 ||
    (body.action !== "ARCHIVE" && body.action !== "DELETE")
  ) {
    throw createApiErrorFromMessage(
      "Provide an ARCHIVE or DELETE action and 1 to 250 product IDs.",
      400,
    );
  }
  return runBulkProductAction(
    { event, ...requireShopifyCredentials(body) },
    productIds,
    body.action,
  );
});
