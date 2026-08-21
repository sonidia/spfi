import { defineEventHandler, readBody } from "h3";
import { createApiErrorFromMessage } from "~~/server/utils/callShopifyApi";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";
import { isShopifyNumericId } from "~~/server/utils/shopify-id";
import { setShopifyProductsPublished } from "~~/server/utils/shopify-product-publication";
import type { ShopifyNumericId } from "~~/types/shopify";

interface BulkPublicationBody {
  storeId?: string;
  token?: string;
  productIds?: ShopifyNumericId[];
  publish?: boolean;
  publicationIds?: string[];
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<BulkPublicationBody>(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);
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
    typeof body.publish !== "boolean"
  ) {
    throw createApiErrorFromMessage(
      "Provide a publish flag and between 1 and 250 numeric product IDs.",
      400,
    );
  }
  const publicationIds = Array.from(
    new Set(
      (Array.isArray(body.publicationIds) ? body.publicationIds : [])
        .map((id) => String(id).trim())
        .filter(Boolean),
    ),
  );
  if (
    publicationIds.length > 25 ||
    publicationIds.some(
      (id) => !id.startsWith("gid://shopify/Publication/") || id.includes("?"),
    )
  ) {
    throw createApiErrorFromMessage(
      "Provide no more than 25 valid Shopify Publication IDs.",
      400,
    );
  }

  return setShopifyProductsPublished({
    event,
    storeId,
    token,
    productIds,
    publish: body.publish,
    ...(publicationIds.length ? { publicationIds } : {}),
  });
});
