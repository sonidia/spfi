import { defineEventHandler, readBody } from "h3";
import { createApiErrorFromMessage } from "~~/server/utils/callShopifyApi";
import {
  requireShopifyCredentials,
  requireShopifyExactResourceId,
  requireShopifyInteger,
} from "~~/server/utils/shopify-admin-request";
import { updateShopifyInventoryBulk } from "~~/server/utils/shopify-inventory-bulk";
import type {
  ShopifyInventoryBulkItemInput,
  ShopifyInventoryBulkMode,
  ShopifyInventoryQuantityName,
} from "~~/types/shopify-inventory";

interface InventoryBulkBody {
  storeId?: string;
  token?: string;
  location_id?: string | number;
  items?: ShopifyInventoryBulkItemInput[];
  mode?: ShopifyInventoryBulkMode;
  amount?: string | number;
  quantity_name?: ShopifyInventoryQuantityName;
  reason?: string;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<InventoryBulkBody>(event)) || {};
  if (
    !Array.isArray(body.items) ||
    !body.items.length ||
    body.items.length > 250 ||
    (body.mode !== "SET" && body.mode !== "ADJUST")
  ) {
    throw createApiErrorFromMessage(
      "Provide a SET or ADJUST operation and 1 to 250 inventory items.",
      400,
    );
  }

  const seen = new Set<string>();
  const quantityName = body.quantity_name || "available";
  if (quantityName !== "available" && quantityName !== "on_hand") {
    throw createApiErrorFromMessage("quantity_name must be available or on_hand.", 400);
  }
  const reason = String(body.reason || "correction").trim();
  if (!/^[a-z][a-z0-9_]{0,63}$/.test(reason)) {
    throw createApiErrorFromMessage(
      "reason must be a Shopify inventory adjustment reason.",
      400,
    );
  }
  const items = body.items.map((item) => {
    const inventoryItemId = requireShopifyExactResourceId(
      item.inventory_item_id,
      "Inventory item",
    );
    if (seen.has(String(inventoryItemId))) {
      throw createApiErrorFromMessage(
        "Each inventory item can only appear once per bulk update.",
        400,
      );
    }
    seen.add(String(inventoryItemId));
    const changeFromQuantity =
      item.change_from_quantity === null
        ? null
        : (item.change_from_quantity ?? item.compare_quantity);
    return {
      inventoryItemId,
      changeFromQuantity:
        changeFromQuantity === undefined
          ? null
          : requireShopifyInteger(changeFromQuantity, "change_from_quantity"),
    };
  });

  return updateShopifyInventoryBulk(
    { event, ...requireShopifyCredentials(body) },
    {
      locationId: requireShopifyExactResourceId(body.location_id, "Location"),
      items,
      mode: body.mode,
      amount: requireShopifyInteger(body.amount, "amount"),
      quantityName,
      reason,
    },
  );
});
