import { defineEventHandler, readBody } from "h3";
import { createApiErrorFromMessage } from "~~/server/utils/callShopifyApi";
import {
  requireShopifyCredentials,
  requireShopifyExactResourceId,
  requireShopifyInteger,
} from "~~/server/utils/shopify-admin-request";
import { moveShopifyInventoryReservations } from "~~/server/utils/shopify-inventory-reservations";
import type {
  ShopifyInventoryReservationDirection,
  ShopifyInventoryReservationItemInput,
} from "~~/types/shopify-inventory";

interface InventoryReservationBody {
  storeId?: string;
  token?: string;
  location_id?: string | number;
  items?: ShopifyInventoryReservationItemInput[];
  direction?: ShopifyInventoryReservationDirection;
  quantity?: string | number;
  reason?: string;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<InventoryReservationBody>(event)) || {};
  if (
    !Array.isArray(body.items) ||
    !body.items.length ||
    body.items.length > 250 ||
    (body.direction !== "RESERVE" && body.direction !== "RELEASE")
  ) {
    throw createApiErrorFromMessage(
      "Provide a RESERVE or RELEASE operation and 1 to 250 inventory items.",
      400,
    );
  }

  const quantity = requireShopifyInteger(body.quantity, "quantity");
  if (quantity <= 0) {
    throw createApiErrorFromMessage("quantity must be greater than zero.", 400);
  }
  const reason = String(body.reason || "correction").trim();
  if (!/^[a-z][a-z0-9_]{0,63}$/.test(reason)) {
    throw createApiErrorFromMessage(
      "reason must be a Shopify inventory adjustment reason.",
      400,
    );
  }

  const seen = new Set<string>();
  const items = body.items.map((item) => {
    const inventoryItemId = requireShopifyExactResourceId(
      item.inventory_item_id,
      "Inventory item",
    );
    if (seen.has(String(inventoryItemId))) {
      throw createApiErrorFromMessage(
        "Each inventory item can only appear once per reservation move.",
        400,
      );
    }
    seen.add(String(inventoryItemId));
    return {
      inventoryItemId,
      currentAvailable: requireShopifyInteger(
        item.current_available,
        "current_available",
      ),
      currentReserved: requireShopifyInteger(item.current_reserved, "current_reserved"),
    };
  });

  return moveShopifyInventoryReservations(
    { event, ...requireShopifyCredentials(body) },
    {
      locationId: requireShopifyExactResourceId(body.location_id, "Location"),
      items,
      direction: body.direction,
      quantity,
      reason,
    },
  );
});
