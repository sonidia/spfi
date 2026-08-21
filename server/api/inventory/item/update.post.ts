import { defineEventHandler, readBody } from "h3";
import { createApiErrorFromMessage } from "~~/server/utils/callShopifyApi";
import {
  requireShopifyCredentials,
  requireShopifyExactResourceId,
} from "~~/server/utils/shopify-admin-request";
import { updateShopifyInventoryItem } from "~~/server/utils/shopify-inventory-item";
import type {
  ShopifyInventoryItemUpdateInput,
  ShopifyWeightUnit,
} from "~~/types/shopify-inventory";

interface InventoryItemUpdateBody extends Partial<ShopifyInventoryItemUpdateInput> {
  storeId?: string;
  token?: string;
  inventory_item_id?: string | number;
}

const WEIGHT_UNITS: ShopifyWeightUnit[] = ["GRAMS", "KILOGRAMS", "OUNCES", "POUNDS"];

export default defineEventHandler(async (event) => {
  const body = (await readBody<InventoryItemUpdateBody>(event)) || {};
  const sku = String(body.sku || "").trim();
  const harmonizedSystemCode = String(body.harmonized_system_code || "").trim();
  const countryCodeOfOrigin = String(body.country_code_of_origin || "")
    .trim()
    .toUpperCase();
  const provinceCodeOfOrigin = String(body.province_code_of_origin || "")
    .trim()
    .toUpperCase();
  const weightUnit = String(body.weight_unit || "GRAMS") as ShopifyWeightUnit;
  const weightValue =
    body.weight_value === null || body.weight_value === undefined
      ? null
      : Number(body.weight_value);
  if (sku.length > 255) {
    throw createApiErrorFromMessage("SKU cannot exceed 255 characters.", 400);
  }
  if (harmonizedSystemCode && !/^\d{6,13}$/.test(harmonizedSystemCode)) {
    throw createApiErrorFromMessage("HS code must contain 6 to 13 digits.", 400);
  }
  if (countryCodeOfOrigin && !/^[A-Z]{2}$/.test(countryCodeOfOrigin)) {
    throw createApiErrorFromMessage(
      "Country of origin must be a two-letter ISO country code.",
      400,
    );
  }
  if (provinceCodeOfOrigin && !/^[A-Z0-9-]{1,12}$/.test(provinceCodeOfOrigin)) {
    throw createApiErrorFromMessage("Province of origin is invalid.", 400);
  }
  if (!WEIGHT_UNITS.includes(weightUnit)) {
    throw createApiErrorFromMessage("Weight unit is invalid.", 400);
  }
  if (weightValue !== null && (!Number.isFinite(weightValue) || weightValue < 0)) {
    throw createApiErrorFromMessage("Weight must be zero or greater.", 400);
  }
  if (
    typeof body.tracked !== "boolean" ||
    typeof body.requires_shipping !== "boolean"
  ) {
    throw createApiErrorFromMessage(
      "tracked and requires_shipping must be boolean values.",
      400,
    );
  }

  const inventoryItem = await updateShopifyInventoryItem(
    { event, ...requireShopifyCredentials(body) },
    requireShopifyExactResourceId(body.inventory_item_id, "Inventory item"),
    {
      sku,
      tracked: body.tracked,
      requires_shipping: body.requires_shipping,
      harmonized_system_code: harmonizedSystemCode,
      country_code_of_origin: countryCodeOfOrigin,
      province_code_of_origin: provinceCodeOfOrigin,
      weight_value: weightValue,
      weight_unit: weightUnit,
    },
  );
  if (!inventoryItem) {
    throw createApiErrorFromMessage("Inventory item was not returned.", 502);
  }
  return { inventoryItem };
});
