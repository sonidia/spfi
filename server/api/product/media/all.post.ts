import { defineEventHandler, readBody } from "h3";
import {
  requireShopifyCredentials,
  requireShopifyResourceId,
} from "~~/server/utils/shopify-admin-request";
import { listProductMedia } from "~~/server/utils/shopify-product-management";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) || {};
  const productId = requireShopifyResourceId(body.productId, "Product");
  return listProductMedia({ event, ...requireShopifyCredentials(body) }, productId);
});
