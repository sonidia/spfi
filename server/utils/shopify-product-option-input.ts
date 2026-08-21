import { buildShopifyGid } from "./shopify-gid.ts";
import type { ShopifyNumericId } from "~~/types/shopify";
import type {
  ShopifyLinkedMetafieldInput,
  ShopifyProductOptionCreateVariantStrategy,
  ShopifyProductOptionUpdateVariantStrategy,
  ShopifyProductOptionValueInput,
} from "~~/types/shopify-product";

export interface ProductOptionUpdateOperation {
  option: {
    id: ShopifyNumericId;
    name?: string;
    position?: number;
    linkedMetafield?: ShopifyLinkedMetafieldInput;
  };
  optionValuesToAdd?: ShopifyProductOptionValueInput[];
  optionValuesToUpdate?: ShopifyProductOptionValueInput[];
  optionValuesToDelete?: ShopifyNumericId[];
}

export interface ProductOptionCreateOperation {
  name: string;
  position?: number;
  values: ShopifyProductOptionValueInput[];
  linkedMetafield?: ShopifyLinkedMetafieldInput;
}

export function buildProductOptionUpdateMutation(
  productId: ShopifyNumericId,
  operations: ProductOptionUpdateOperation[],
  variantStrategy: ShopifyProductOptionUpdateVariantStrategy = "LEAVE_AS_IS",
) {
  const definitions = [
    "$productId: ID!",
    "$variantStrategy: ProductOptionUpdateVariantStrategy!",
  ];
  const variables: Record<string, unknown> = {
    productId: buildShopifyGid("Product", productId),
    variantStrategy,
  };
  const fields = operations.map((operation, index) => {
    definitions.push(`$option${index}: OptionUpdateInput!`);
    definitions.push(`$option${index}ValuesToAdd: [OptionValueCreateInput!]`);
    definitions.push(`$option${index}ValuesToUpdate: [OptionValueUpdateInput!]`);
    definitions.push(`$option${index}ValuesToDelete: [ID!]`);
    variables[`option${index}`] = {
      ...operation.option,
      id: buildShopifyGid("ProductOption", operation.option.id),
    };
    variables[`option${index}ValuesToAdd`] = operation.optionValuesToAdd || [];
    variables[`option${index}ValuesToUpdate`] = (
      operation.optionValuesToUpdate || []
    ).map((value) => ({
      ...value,
      id: buildShopifyGid("ProductOptionValue", value.id || ""),
    }));
    variables[`option${index}ValuesToDelete`] = (
      operation.optionValuesToDelete || []
    ).map((id) => buildShopifyGid("ProductOptionValue", id));
    return `option${index}: productOptionUpdate(
      productId: $productId
      option: $option${index}
      optionValuesToAdd: $option${index}ValuesToAdd
      optionValuesToUpdate: $option${index}ValuesToUpdate
      optionValuesToDelete: $option${index}ValuesToDelete
      variantStrategy: $variantStrategy
    ) { userErrors { field message code } }`;
  });

  return {
    query: `mutation UpdateProductOptions(${definitions.join(", ")}) { ${fields.join("\n")} }`,
    variables,
  };
}

export function buildProductOptionsCreateMutation(
  productId: ShopifyNumericId,
  options: ProductOptionCreateOperation[],
  variantStrategy: ShopifyProductOptionCreateVariantStrategy = "LEAVE_AS_IS",
) {
  return {
    query: `#graphql
      mutation CreateProductOptions(
        $productId: ID!
        $options: [OptionCreateInput!]!
        $variantStrategy: ProductOptionCreateVariantStrategy!
      ) {
        productOptionsCreate(
          productId: $productId
          options: $options
          variantStrategy: $variantStrategy
        ) {
          userErrors { field message code }
        }
      }
    `,
    variables: {
      productId: buildShopifyGid("Product", productId),
      options,
      variantStrategy,
    },
  };
}
