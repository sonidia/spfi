import { randomUUID } from "node:crypto";
import type { H3Event } from "h3";
import { assertNoGraphqlUserErrors, callShopifyGraphql } from "./callShopifyGraphql";
import { buildShopifyGid } from "./shopify-gid";
import type {
  ShopifyInventoryBulkMode,
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
  compareQuantity?: number;
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
          name: "available",
          reason: "correction",
          referenceDocumentUri: `spf://inventory/bulk-set/${idempotencyKey}`,
          quantities: options.items.map((item) => ({
            inventoryItemId: buildShopifyGid("InventoryItem", item.inventoryItemId),
            locationId,
            quantity: options.amount,
            compareQuantity: item.compareQuantity,
          })),
        },
      },
    });
    assertNoGraphqlUserErrors(
      data.inventorySetQuantities.userErrors,
      "Failed to set inventory quantities.",
    );
    return { mode: options.mode, updatedCount: options.items.length };
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
        name: "available",
        reason: "correction",
        referenceDocumentUri: `spf://inventory/bulk-adjust/${idempotencyKey}`,
        changes: options.items.map((item) => ({
          inventoryItemId: buildShopifyGid("InventoryItem", item.inventoryItemId),
          locationId,
          delta: options.amount,
        })),
      },
    },
  });
  assertNoGraphqlUserErrors(
    data.inventoryAdjustQuantities.userErrors,
    "Failed to adjust inventory quantities.",
  );
  return { mode: options.mode, updatedCount: options.items.length };
}
