import { randomUUID } from "node:crypto";
import type { H3Event } from "h3";
import { assertNoGraphqlUserErrors, callShopifyGraphql } from "./callShopifyGraphql";
import { buildShopifyGid } from "./shopify-gid";
import type { ShopifyNumericId } from "~~/types/shopify";
import type {
  ShopifyInventoryReservationDirection,
  ShopifyInventoryReservationResult,
} from "~~/types/shopify-inventory";

interface ReservationItem {
  inventoryItemId: ShopifyNumericId;
  currentAvailable: number;
  currentReserved: number;
}

export async function moveShopifyInventoryReservations(
  context: { event: H3Event; storeId: string; token: string },
  options: {
    locationId: ShopifyNumericId;
    items: ReservationItem[];
    direction: ShopifyInventoryReservationDirection;
    quantity: number;
    reason: string;
  },
): Promise<ShopifyInventoryReservationResult> {
  const idempotencyKey = randomUUID();
  const locationId = buildShopifyGid("Location", options.locationId);
  const isReserve = options.direction === "RESERVE";
  const data = await callShopifyGraphql<{
    inventoryMoveQuantities: {
      inventoryAdjustmentGroup: { createdAt: string } | null;
      userErrors: Array<{ field?: string[] | null; message: string }>;
    };
  }>({
    ...context,
    operationName: "InventoryMoveReservations",
    retryTransport: false,
    query: `#graphql
      mutation InventoryMoveReservations(
        $input: InventoryMoveQuantitiesInput!
        $idempotencyKey: String!
      ) {
        inventoryMoveQuantities(input: $input) @idempotent(key: $idempotencyKey) {
          inventoryAdjustmentGroup { createdAt }
          userErrors { field message }
        }
      }
    `,
    variables: {
      idempotencyKey,
      input: {
        reason: options.reason,
        referenceDocumentUri: `spf://inventory/reservation/${idempotencyKey}`,
        changes: options.items.map((item) => {
          const reservedLedgerUri = `spf://inventory/reservation/${idempotencyKey}/${item.inventoryItemId}`;
          const available = {
            locationId,
            name: "available",
            ledgerDocumentUri: null,
            changeFromQuantity: item.currentAvailable,
          };
          const reserved = {
            locationId,
            name: "reserved",
            ledgerDocumentUri: reservedLedgerUri,
            changeFromQuantity: item.currentReserved,
          };
          return {
            inventoryItemId: buildShopifyGid("InventoryItem", item.inventoryItemId),
            quantity: options.quantity,
            from: isReserve ? available : reserved,
            to: isReserve ? reserved : available,
          };
        }),
      },
    },
  });
  assertNoGraphqlUserErrors(
    data.inventoryMoveQuantities.userErrors,
    "Failed to move reserved inventory quantities.",
  );
  return {
    direction: options.direction,
    updatedCount: options.items.length,
    quantity: options.quantity,
  };
}
