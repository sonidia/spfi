import type { H3Event } from "h3";
import { callShopifyGraphql } from "./callShopifyGraphql";
import { buildProductSearchQuery } from "./shopify-product-query";
import type { ProductListQuery } from "~~/types/shopify-product";

interface ProductCountData {
  productsCount: {
    count: number;
    precision: "AT_LEAST" | "EXACT";
  };
}

export async function countShopifyProducts(options: {
  event: H3Event;
  storeId: string;
  token: string;
  query?: ProductListQuery;
}) {
  const searchQuery = buildProductSearchQuery(options.query);
  const data = await callShopifyGraphql<ProductCountData, { query: string }>({
    event: options.event,
    storeId: options.storeId,
    token: options.token,
    query: `
      query ProductCount($query: String!) {
        productsCount(limit: null, query: $query) {
          count
          precision
        }
      }
    `,
    variables: { query: searchQuery },
    operationName: "ProductCount",
  });

  return data.productsCount;
}
