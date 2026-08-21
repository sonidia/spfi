import { describe, expect, it } from "vitest";
import { getProductInventoryItemIds } from "~/composables/useLocations";
import type { ShopifyProduct } from "~~/types/shopify";

describe("product inventory item IDs", () => {
  it("keeps lossless string IDs and deduplicates number/string equivalents", () => {
    const product = {
      variants: [
        { id: 1, inventory_item_id: "9007199254740993" },
        { id: 2, inventory_item_id: 42 },
        { id: 3, inventory_item_id: "42" },
        { id: 4 },
      ],
    } as ShopifyProduct;

    expect(getProductInventoryItemIds(product)).toEqual(["9007199254740993", 42]);
  });

  it("ignores malformed inventory item IDs", () => {
    const product = {
      variants: [
        { id: 1, inventory_item_id: "gid://shopify/InventoryItem/1" },
        { id: 2, inventory_item_id: "" },
      ],
    } as ShopifyProduct;

    expect(getProductInventoryItemIds(product)).toEqual([]);
  });
});
