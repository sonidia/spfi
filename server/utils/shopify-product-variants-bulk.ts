import type { H3Event } from "h3";
import {
  assertNoGraphqlUserErrors,
  callShopifyGraphql,
  toShopifyGid,
} from "./callShopifyGraphql";
import { toBulkVariantInput } from "./shopify-product-variant-input.ts";
import type { ShopifyNumericId, ShopifyVariant } from "~~/types/shopify";
import type { ShopifyVariantInput } from "~~/types/shopify-product";

interface VariantNode {
  legacyResourceId: ShopifyNumericId;
  title: string;
  price: string;
  compareAtPrice: string | null;
  barcode: string | null;
  position: number;
  selectedOptions: Array<{ name: string; value: string }>;
  inventoryQuantity: number | null;
  inventoryPolicy: "CONTINUE" | "DENY";
  taxable: boolean;
  inventoryItem: {
    legacyResourceId: ShopifyNumericId;
    sku: string | null;
    tracked: boolean;
    requiresShipping: boolean;
  };
}

interface VariantMutationResult {
  productVariants?: VariantNode[];
  userErrors?: Array<{ field?: string[] | null; message: string }>;
}

const VARIANT_FIELDS = `
  legacyResourceId
  title
  price
  compareAtPrice
  barcode
  position
  selectedOptions { name value }
  inventoryQuantity
  inventoryPolicy
  taxable
  inventoryItem {
    legacyResourceId
    sku
    tracked
    requiresShipping
  }
`;

export async function createShopifyProductVariantsBulk(options: {
  event: H3Event;
  storeId: string;
  token: string;
  productId: ShopifyNumericId;
  variants: ShopifyVariantInput[];
  optionNames: string[];
}) {
  const variables = {
    productId: toShopifyGid("Product", options.productId),
    variants: options.variants.map((variant) =>
      toBulkVariantInput(variant, options.optionNames, false),
    ),
  };
  const data = await callShopifyGraphql<
    { productVariantsBulkCreate: VariantMutationResult },
    typeof variables
  >({
    event: options.event,
    storeId: options.storeId,
    token: options.token,
    operationName: "ProductVariantsBulkCreate",
    query: `
      mutation ProductVariantsBulkCreate(
        $productId: ID!
        $variants: [ProductVariantsBulkInput!]!
      ) {
        productVariantsBulkCreate(
          productId: $productId
          variants: $variants
          strategy: REMOVE_STANDALONE_VARIANT
        ) {
          productVariants { ${VARIANT_FIELDS} }
          userErrors { field message }
        }
      }
    `,
    variables,
  });
  const result = data.productVariantsBulkCreate;
  assertNoGraphqlUserErrors(result.userErrors, "Failed to create product variants.");
  return (result.productVariants || []).map((variant) =>
    mapVariant(variant, options.productId),
  );
}

export async function updateShopifyProductVariantsBulk(options: {
  event: H3Event;
  storeId: string;
  token: string;
  productId: ShopifyNumericId;
  variants: ShopifyVariantInput[];
  optionNames: string[];
}) {
  const variables = {
    productId: toShopifyGid("Product", options.productId),
    variants: options.variants.map((variant) =>
      toBulkVariantInput(variant, options.optionNames, true),
    ),
  };
  const data = await callShopifyGraphql<
    { productVariantsBulkUpdate: VariantMutationResult },
    typeof variables
  >({
    event: options.event,
    storeId: options.storeId,
    token: options.token,
    operationName: "ProductVariantsBulkUpdate",
    query: `
      mutation ProductVariantsBulkUpdate(
        $productId: ID!
        $variants: [ProductVariantsBulkInput!]!
      ) {
        productVariantsBulkUpdate(
          productId: $productId
          variants: $variants
          allowPartialUpdates: false
        ) {
          productVariants { ${VARIANT_FIELDS} }
          userErrors { field message }
        }
      }
    `,
    variables,
  });
  const result = data.productVariantsBulkUpdate;
  assertNoGraphqlUserErrors(result.userErrors, "Failed to update product variants.");
  return (result.productVariants || []).map((variant) =>
    mapVariant(variant, options.productId),
  );
}

export async function deleteShopifyProductVariantsBulk(options: {
  event: H3Event;
  storeId: string;
  token: string;
  productId: ShopifyNumericId;
  variantIds: ShopifyNumericId[];
}) {
  const variables = {
    productId: toShopifyGid("Product", options.productId),
    variantIds: options.variantIds.map((id) => toShopifyGid("ProductVariant", id)),
  };
  const data = await callShopifyGraphql<
    {
      productVariantsBulkDelete: {
        userErrors?: Array<{ field?: string[] | null; message: string }>;
      };
    },
    typeof variables
  >({
    event: options.event,
    storeId: options.storeId,
    token: options.token,
    operationName: "ProductVariantsBulkDelete",
    query: `
      mutation ProductVariantsBulkDelete($productId: ID!, $variantIds: [ID!]!) {
        productVariantsBulkDelete(productId: $productId, variantsIds: $variantIds) {
          userErrors { field message }
        }
      }
    `,
    variables,
  });
  assertNoGraphqlUserErrors(
    data.productVariantsBulkDelete.userErrors,
    "Failed to delete product variants.",
  );
  return options.variantIds;
}

function mapVariant(node: VariantNode, productId: ShopifyNumericId): ShopifyVariant {
  return {
    id: node.legacyResourceId,
    product_id: productId,
    title: node.title,
    price: node.price,
    compare_at_price: node.compareAtPrice,
    barcode: node.barcode,
    position: node.position,
    option1: node.selectedOptions[0]?.value || null,
    option2: node.selectedOptions[1]?.value || null,
    option3: node.selectedOptions[2]?.value || null,
    inventory_quantity: node.inventoryQuantity ?? undefined,
    inventory_policy: node.inventoryPolicy.toLowerCase(),
    taxable: node.taxable,
    inventory_item_id: node.inventoryItem.legacyResourceId,
    inventory_management: node.inventoryItem.tracked ? "shopify" : null,
    requires_shipping: node.inventoryItem.requiresShipping,
    sku: node.inventoryItem.sku,
  };
}
