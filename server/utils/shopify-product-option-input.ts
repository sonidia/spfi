import { buildShopifyGid } from "./shopify-gid.ts";
import type { ShopifyNumericId, ShopifyProductOption } from "~~/types/shopify";

export function buildProductOptionUpdateMutation(
  productId: ShopifyNumericId,
  options: ShopifyProductOption[],
) {
  const definitions = ["$productId: ID!"];
  const variables: Record<string, unknown> = {
    productId: buildShopifyGid("Product", productId),
  };
  const fields = options.map((option, index) => {
    definitions.push(`$option${index}: OptionUpdateInput!`);
    variables[`option${index}`] = {
      id: buildShopifyGid("ProductOption", option.id || ""),
      name: option.name,
      position: option.position || index + 1,
    };
    return `option${index}: productOptionUpdate(productId: $productId, option: $option${index}) { userErrors { field message } }`;
  });

  return {
    query: `mutation UpdateProductOptions(${definitions.join(", ")}) { ${fields.join("\n")} }`,
    variables,
  };
}
