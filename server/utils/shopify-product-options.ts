import type { H3Event } from "h3";
import { assertNoGraphqlUserErrors, callShopifyGraphql } from "./callShopifyGraphql";
import { buildProductOptionUpdateMutation } from "./shopify-product-option-input.ts";
import type { ShopifyNumericId, ShopifyProductOption } from "~~/types/shopify";

interface ProductOptionMutationPayload {
  userErrors?: Array<{ field?: string[] | null; message: string }>;
}

export async function updateShopifyProductOptions(options: {
  event: H3Event;
  storeId: string;
  token: string;
  productId: ShopifyNumericId;
  productOptions: ShopifyProductOption[];
}) {
  const { query, variables } = buildProductOptionUpdateMutation(
    options.productId,
    options.productOptions,
  );
  const data = await callShopifyGraphql<
    Record<string, ProductOptionMutationPayload>,
    typeof variables
  >({
    event: options.event,
    storeId: options.storeId,
    token: options.token,
    operationName: "UpdateProductOptions",
    query,
    variables,
  });

  const userErrors = options.productOptions.flatMap(
    (_, index) => data[`option${index}`]?.userErrors || [],
  );
  assertNoGraphqlUserErrors(userErrors, "Failed to update product options.");
  return options.productOptions;
}
