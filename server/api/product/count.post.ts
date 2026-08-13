import { defineEventHandler, readBody } from "h3";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";
import { countShopifyProducts } from "~~/server/utils/shopify-product-count";
import type { ProductListQuery, ProductCountResponse } from "~~/types/shopify-product";

interface ProductCountBody {
  storeId?: string;
  token?: string;
  query?: ProductListQuery;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<ProductCountBody>(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);

  const result = await countShopifyProducts({
    event,
    storeId,
    token,
    query: body.query,
  });

  return { count: result.count } satisfies ProductCountResponse;
});
