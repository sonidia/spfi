import type { H3Event } from "h3";
import { assertNoGraphqlUserErrors, callShopifyGraphql } from "./callShopifyGraphql";
import { buildShopifyGid } from "./shopify-gid";
import type { ShopifyNumericId } from "~~/types/shopify";
import type {
  ShopifyInventoryItemDetails,
  ShopifyInventoryItemUpdateInput,
} from "~~/types/shopify-inventory";

interface InventoryItemNode {
  id: string;
  legacyResourceId: ShopifyNumericId;
  sku: string | null;
  tracked: boolean;
  requiresShipping: boolean;
  harmonizedSystemCode: string | null;
  countryCodeOfOrigin: string | null;
  provinceCodeOfOrigin: string | null;
  measurement: {
    weight: { value: number; unit: string } | null;
  };
}

const INVENTORY_ITEM_FIELDS = `#graphql
  fragment SpfiInventoryItemFields on InventoryItem {
    id
    legacyResourceId
    sku
    tracked
    requiresShipping
    harmonizedSystemCode
    countryCodeOfOrigin
    provinceCodeOfOrigin
    measurement { weight { value unit } }
  }
`;

export async function getShopifyInventoryItem(
  context: { event: H3Event; storeId: string; token: string },
  inventoryItemId: ShopifyNumericId,
) {
  const data = await callShopifyGraphql<{
    inventoryItem: InventoryItemNode | null;
  }>({
    ...context,
    operationName: "InventoryItemDetails",
    query: `#graphql
      ${INVENTORY_ITEM_FIELDS}
      query InventoryItemDetails($id: ID!) {
        inventoryItem(id: $id) { ...SpfiInventoryItemFields }
      }
    `,
    variables: { id: buildShopifyGid("InventoryItem", inventoryItemId) },
  });
  return data.inventoryItem ? normalizeInventoryItem(data.inventoryItem) : null;
}

export async function updateShopifyInventoryItem(
  context: { event: H3Event; storeId: string; token: string },
  inventoryItemId: ShopifyNumericId,
  input: ShopifyInventoryItemUpdateInput,
) {
  const graphqlInput = {
    sku: input.sku,
    tracked: input.tracked,
    requiresShipping: input.requires_shipping,
    harmonizedSystemCode: input.harmonized_system_code || null,
    countryCodeOfOrigin: input.country_code_of_origin || null,
    provinceCodeOfOrigin: input.province_code_of_origin || null,
    ...(input.weight_value === null
      ? {}
      : {
          measurement: {
            weight: { value: input.weight_value, unit: input.weight_unit },
          },
        }),
  };
  const data = await callShopifyGraphql<{
    inventoryItemUpdate: {
      inventoryItem: InventoryItemNode | null;
      userErrors: Array<{ field?: string[] | null; message: string }>;
    };
  }>({
    ...context,
    operationName: "InventoryItemUpdate",
    retryTransport: false,
    query: `#graphql
      ${INVENTORY_ITEM_FIELDS}
      mutation InventoryItemUpdate($id: ID!, $input: InventoryItemInput!) {
        inventoryItemUpdate(id: $id, input: $input) {
          inventoryItem { ...SpfiInventoryItemFields }
          userErrors { field message }
        }
      }
    `,
    variables: {
      id: buildShopifyGid("InventoryItem", inventoryItemId),
      input: graphqlInput,
    },
  });
  assertNoGraphqlUserErrors(
    data.inventoryItemUpdate.userErrors,
    "Failed to update inventory item.",
  );
  return data.inventoryItemUpdate.inventoryItem
    ? normalizeInventoryItem(data.inventoryItemUpdate.inventoryItem)
    : null;
}

function normalizeInventoryItem(node: InventoryItemNode): ShopifyInventoryItemDetails {
  const unit = String(node.measurement?.weight?.unit || "");
  const validUnit = ["GRAMS", "KILOGRAMS", "OUNCES", "POUNDS"].includes(unit);
  return {
    id: node.legacyResourceId,
    gid: node.id,
    sku: node.sku || "",
    tracked: node.tracked,
    requiresShipping: node.requiresShipping,
    harmonizedSystemCode: node.harmonizedSystemCode || "",
    countryCodeOfOrigin: node.countryCodeOfOrigin || "",
    provinceCodeOfOrigin: node.provinceCodeOfOrigin || "",
    weight:
      node.measurement?.weight && validUnit
        ? {
            value: node.measurement.weight.value,
            unit: unit as NonNullable<ShopifyInventoryItemDetails["weight"]>["unit"],
          }
        : null,
  };
}
