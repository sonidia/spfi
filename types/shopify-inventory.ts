import type { ShopifyInventoryLevel } from "./shopify";

export interface ShopifyInventorySetInput {
  location_id: number;
  inventory_item_id: number;
  available: number;
  disconnect_if_necessary?: boolean;
}

export interface ShopifyInventoryAdjustInput {
  location_id: number;
  inventory_item_id: number;
  available_adjustment: number;
}

export interface ShopifyInventoryLevelResponse {
  inventory_level: ShopifyInventoryLevel;
}
