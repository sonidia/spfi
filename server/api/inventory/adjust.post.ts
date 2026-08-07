import { defineEventHandler, readBody } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
import {
  requireShopifyCredentials,
  requireShopifyInteger,
  requireShopifyResourceId,
} from "~~/server/utils/shopify-admin-request";
import type {
  ShopifyInventoryAdjustInput,
  ShopifyInventoryLevelResponse,
} from "~~/types/shopify-inventory";

interface InventoryAdjustBody {
  storeId?: string;
  token?: string;
  location_id?: number | string;
  inventory_item_id?: number | string;
  available_adjustment?: number | string;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<InventoryAdjustBody>(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);
  const requestBody: ShopifyInventoryAdjustInput = {
    location_id: Number(
      requireShopifyResourceId(body.location_id, "Location"),
    ),
    inventory_item_id: Number(
      requireShopifyResourceId(
        body.inventory_item_id,
        "Inventory item",
      ),
    ),
    available_adjustment: requireShopifyInteger(
      body.available_adjustment,
      "available_adjustment",
    ),
  };

  return callShopifyApi<
    ShopifyInventoryLevelResponse,
    ShopifyInventoryAdjustInput
  >({
    event,
    storeId,
    token,
    method: "POST",
    path: "/inventory_levels/adjust.json",
    body: requestBody,
    missingProxyMessage: "Missing sock proxy for this store.",
  });
});
