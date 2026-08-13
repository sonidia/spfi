import type { ShopifyInventoryLevel, ShopifyNumericId } from "./shopify";

export interface ShopifyInventorySetInput {
  location_id: ShopifyNumericId;
  inventory_item_id: ShopifyNumericId;
  available: number;
  disconnect_if_necessary?: boolean;
}

export interface ShopifyInventoryAdjustInput {
  location_id: ShopifyNumericId;
  inventory_item_id: ShopifyNumericId;
  available_adjustment: number;
}

export interface ShopifyInventoryLevelResponse {
  inventory_level: ShopifyInventoryLevel;
}

export type ShopifyInventoryBulkMode = "SET" | "ADJUST";

export interface ShopifyInventoryBulkItemInput {
  inventory_item_id: ShopifyNumericId;
  compare_quantity?: number;
}

export interface ShopifyInventoryBulkResult {
  mode: ShopifyInventoryBulkMode;
  updatedCount: number;
}
