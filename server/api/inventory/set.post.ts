import { defineEventHandler, readBody } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
import {
  requireShopifyCredentials,
  requireShopifyInteger,
  requireShopifyResourceId,
} from "~~/server/utils/shopify-admin-request";
import type {
  ShopifyInventoryLevelResponse,
  ShopifyInventorySetInput,
} from "~~/types/shopify-inventory";

interface InventorySetBody {
  storeId?: string;
  token?: string;
  location_id?: number | string;
  inventory_item_id?: number | string;
  available?: number | string;
  disconnect_if_necessary?: boolean;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<InventorySetBody>(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);
  const requestBody: ShopifyInventorySetInput = {
    location_id: Number(
      requireShopifyResourceId(body.location_id, "Location"),
    ),
    inventory_item_id: Number(
      requireShopifyResourceId(
        body.inventory_item_id,
        "Inventory item",
      ),
    ),
    available: requireShopifyInteger(body.available, "available"),
    ...(typeof body.disconnect_if_necessary === "boolean"
      ? { disconnect_if_necessary: body.disconnect_if_necessary }
      : {}),
  };

  return callShopifyApi<
    ShopifyInventoryLevelResponse,
    ShopifyInventorySetInput
  >({
    event,
    storeId,
    token,
    method: "POST",
    path: "/inventory_levels/set.json",
    body: requestBody,
    missingProxyMessage: "Missing sock proxy for this store.",
  });
});
