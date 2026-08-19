import { randomUUID } from "node:crypto";
import type { H3Event } from "h3";
import { assertNoGraphqlUserErrors, callShopifyGraphql } from "./callShopifyGraphql";
import { buildShopifyGid } from "./shopify-gid";
import type {
  ShopifyInventoryBulkMode,
  ShopifyInventoryQuantityName,
  ShopifyInventoryBulkResult,
} from "~~/types/shopify-inventory";
import type { ShopifyNumericId } from "~~/types/shopify";

interface InventoryBulkContext {
  event: H3Event;
  storeId: string;
  token: string;
}

interface InventoryBulkItem {
  inventoryItemId: ShopifyNumericId;
  changeFromQuantity: number | null;
}

interface GraphqlUserError {
  field?: string[] | null;
  message: string;
}

export async function updateShopifyInventoryBulk(
  context: InventoryBulkContext,
  options: {
    locationId: ShopifyNumericId;
    items: InventoryBulkItem[];
    mode: ShopifyInventoryBulkMode;
    amount: number;
    quantityName: ShopifyInventoryQuantityName;
    reason: string;
  },
): Promise<ShopifyInventoryBulkResult> {
  const locationId = buildShopifyGid("Location", options.locationId);
  const idempotencyKey = randomUUID();

  if (options.mode === "SET") {
    const data = await callShopifyGraphql<{
      inventorySetQuantities: {
        inventoryAdjustmentGroup: { createdAt: string } | null;
        userErrors: GraphqlUserError[];
      };
    }>({
      ...context,
      operationName: "InventorySetQuantities",
      retryTransport: false,
      query: `#graphql
        mutation InventorySetQuantities(
          $input: InventorySetQuantitiesInput!
          $idempotencyKey: String!
        ) {
          inventorySetQuantities(input: $input) @idempotent(key: $idempotencyKey) {
            inventoryAdjustmentGroup { createdAt }
            userErrors { field message }
          }
        }
      `,
      variables: {
        idempotencyKey,
        input: {
          name: options.quantityName,
          reason: options.reason,
          referenceDocumentUri: `spf://inventory/bulk-set/${idempotencyKey}`,
          quantities: options.items.map((item) => ({
            inventoryItemId: buildShopifyGid("InventoryItem", item.inventoryItemId),
            locationId,
            quantity: options.amount,
            changeFromQuantity: item.changeFromQuantity,
          })),
        },
      },
    });
    assertNoGraphqlUserErrors(
      data.inventorySetQuantities.userErrors,
      "Failed to set inventory quantities.",
    );
    return {
      mode: options.mode,
      updatedCount: options.items.length,
      quantityName: options.quantityName,
      reason: options.reason,
    };
  }

  const data = await callShopifyGraphql<{
    inventoryAdjustQuantities: {
      inventoryAdjustmentGroup: { createdAt: string } | null;
      userErrors: GraphqlUserError[];
    };
  }>({
    ...context,
    operationName: "InventoryAdjustQuantities",
    retryTransport: false,
    query: `#graphql
      mutation InventoryAdjustQuantities(
        $input: InventoryAdjustQuantitiesInput!
        $idempotencyKey: String!
      ) {
        inventoryAdjustQuantities(input: $input) @idempotent(key: $idempotencyKey) {
          inventoryAdjustmentGroup { createdAt }
          userErrors { field message }
        }
      }
    `,
    variables: {
      idempotencyKey,
      input: {
        name: options.quantityName,
        reason: options.reason,
        referenceDocumentUri: `spf://inventory/bulk-adjust/${idempotencyKey}`,
        changes: options.items.map((item) => ({
          inventoryItemId: buildShopifyGid("InventoryItem", item.inventoryItemId),
          locationId,
          delta: options.amount,
          changeFromQuantity: item.changeFromQuantity,
          ...(options.quantityName === "available"
            ? {}
            : {
                ledgerDocumentUri: `spf://inventory/ledger/${idempotencyKey}/${item.inventoryItemId}`,
              }),
        })),
      },
    },
  });
  assertNoGraphqlUserErrors(
    data.inventoryAdjustQuantities.userErrors,
    "Failed to adjust inventory quantities.",
  );
  return {
    mode: options.mode,
    updatedCount: options.items.length,
    quantityName: options.quantityName,
    reason: options.reason,
  };
}
