import { defineEventHandler, readBody } from "h3";
import { createApiErrorFromMessage } from "~~/server/utils/callShopifyApi";
import {
  requireShopifyCredentials,
  requireShopifyExactResourceId,
} from "~~/server/utils/shopify-admin-request";
import { getShopifyInventoryItem } from "~~/server/utils/shopify-inventory-item";

interface InventoryItemBody {
  storeId?: string;
  token?: string;
  inventory_item_id?: string | number;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<InventoryItemBody>(event)) || {};
  const inventoryItem = await getShopifyInventoryItem(
    { event, ...requireShopifyCredentials(body) },
    requireShopifyExactResourceId(body.inventory_item_id, "Inventory item"),
  );
  if (!inventoryItem) {
    throw createApiErrorFromMessage("Inventory item not found.", 404);
  }
  return { inventoryItem };
});
