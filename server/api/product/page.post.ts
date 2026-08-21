import { defineEventHandler, readBody } from "h3";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";
import { listShopifyProducts } from "~~/server/utils/shopify-product-list";
import type { ProductListQuery, ProductPageResponse } from "~~/types/shopify-product";

interface ProductPageBody {
  storeId?: string;
  token?: string;
  query?: ProductListQuery;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<ProductPageBody>(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);
  const query = body.query || {};

  return (await listShopifyProducts({
    event,
    storeId,
    token,
    query,
  })) satisfies ProductPageResponse;
});
