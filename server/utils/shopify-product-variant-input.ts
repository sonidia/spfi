import { buildShopifyGid } from "./shopify-gid.ts";
import type { ShopifyVariantInput } from "~~/types/shopify-product";

export function toBulkVariantInput(
  variant: ShopifyVariantInput,
  optionNames: string[],
  requireId: boolean,
) {
  const id = variant.id;
  if (requireId && !id) throw new Error("Every bulk variant update requires an ID.");
  const input: Record<string, unknown> = {
    ...(id ? { id: buildShopifyGid("ProductVariant", id) } : {}),
  };
  copyDefined(input, "price", variant.price);
  copyDefined(input, "compareAtPrice", variant.compare_at_price);
  copyDefined(input, "barcode", variant.barcode);
  copyDefined(input, "taxable", variant.taxable);
  if (variant.inventory_policy) {
    input.inventoryPolicy = variant.inventory_policy.toUpperCase();
  }

  const inventoryItem = Object.fromEntries(
    [
      ["sku", variant.sku],
      ["requiresShipping", variant.requires_shipping],
      [
        "tracked",
        variant.inventory_management === undefined
          ? undefined
          : variant.inventory_management === "shopify",
      ],
    ].filter((entry) => entry[1] !== undefined),
  );
  if (Object.keys(inventoryItem).length) input.inventoryItem = inventoryItem;

  const optionValues = [variant.option1, variant.option2, variant.option3].flatMap(
    (value, index) => {
      const name = optionNames[index]?.trim();
      const normalizedValue = typeof value === "string" ? value.trim() : "";
      return name && normalizedValue
        ? [{ optionName: name, name: normalizedValue }]
        : [];
    },
  );
  if (optionValues.length) input.optionValues = optionValues;
  if (variant.metafields?.length) input.metafields = variant.metafields;
  return input;
}

function copyDefined(target: Record<string, unknown>, key: string, value: unknown) {
  if (value !== undefined) target[key] = value;
}
