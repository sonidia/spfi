import type {
  ShopifyInventoryLevel,
  ShopifyInventoryQuantityStateName,
  ShopifyNumericId,
} from "./shopify";

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
export type ShopifyInventoryQuantityName = Extract<
  ShopifyInventoryQuantityStateName,
  "available" | "on_hand"
>;

export interface ShopifyInventoryBulkItemInput {
  inventory_item_id: ShopifyNumericId;
  change_from_quantity?: number | null;
  /** @deprecated Use change_from_quantity with Shopify API 2026-01 or newer. */
  compare_quantity?: number;
}

export interface ShopifyInventoryBulkResult {
  mode: ShopifyInventoryBulkMode;
  updatedCount: number;
  quantityName: ShopifyInventoryQuantityName;
  reason: string;
}

export type ShopifyInventoryReservationDirection = "RESERVE" | "RELEASE";

export interface ShopifyInventoryReservationItemInput {
  inventory_item_id: ShopifyNumericId;
  current_available: number;
  current_reserved: number;
}

export interface ShopifyInventoryReservationResult {
  direction: ShopifyInventoryReservationDirection;
  updatedCount: number;
  quantity: number;
}

export type ShopifyWeightUnit = "GRAMS" | "KILOGRAMS" | "OUNCES" | "POUNDS";

export interface ShopifyInventoryItemDetails {
  id: ShopifyNumericId;
  gid: string;
  sku: string;
  tracked: boolean;
  requiresShipping: boolean;
  harmonizedSystemCode: string;
  countryCodeOfOrigin: string;
  provinceCodeOfOrigin: string;
  weight: { value: number; unit: ShopifyWeightUnit } | null;
}

export interface ShopifyInventoryItemUpdateInput {
  sku: string;
  tracked: boolean;
  requires_shipping: boolean;
  harmonized_system_code: string;
  country_code_of_origin: string;
  province_code_of_origin: string;
  weight_value: number | null;
  weight_unit: ShopifyWeightUnit;
}
