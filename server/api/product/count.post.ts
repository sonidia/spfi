import { defineEventHandler, readBody } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";
import { buildProductCountParams } from "~~/server/utils/shopify-product-query";
import type {
  ProductCountQuery,
  ProductCountResponse,
} from "~~/types/shopify-product";

interface ProductCountBody {
  storeId?: string;
  token?: string;
  query?: ProductCountQuery;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<ProductCountBody>(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);

  return callShopifyApi<ProductCountResponse>({
    event,
    storeId,
    token,
    path: "/products/count.json",
    params: buildProductCountParams(body.query),
    missingProxyMessage: "Missing sock proxy for this store.",
  });
});
