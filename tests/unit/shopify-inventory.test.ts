import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateShopifyInventoryBulk } from "~~/server/utils/shopify-inventory-bulk";
import { updateShopifyInventoryItem } from "~~/server/utils/shopify-inventory-item";
import { enrichShopifyInventoryQuantities } from "~~/server/utils/shopify-inventory-quantities";
import { moveShopifyInventoryReservations } from "~~/server/utils/shopify-inventory-reservations";

const graphql = vi.hoisted(() => vi.fn());

vi.mock("~~/server/utils/callShopifyGraphql", () => ({
  callShopifyGraphql: graphql,
  assertNoGraphqlUserErrors: (errors: Array<{ message: string }>, fallback: string) => {
    if (errors.length) throw new Error(errors[0]?.message || fallback);
  },
}));

const context = {
  event: {} as never,
  storeId: "inventory-shop",
  token: "token",
};

describe("Shopify inventory GraphQL operations", () => {
  beforeEach(() => graphql.mockReset());

  it("uses changeFromQuantity and caller-provided quantity metadata", async () => {
    graphql.mockResolvedValue({
      inventorySetQuantities: {
        inventoryAdjustmentGroup: { createdAt: "2026-08-19T00:00:00Z" },
        userErrors: [],
      },
    });

    await updateShopifyInventoryBulk(context, {
      locationId: 11,
      items: [{ inventoryItemId: 22, changeFromQuantity: 7 }],
      mode: "SET",
      amount: 9,
      quantityName: "on_hand",
      reason: "correction",
    });

    expect(graphql.mock.calls[0]?.[0].variables.input).toMatchObject({
      name: "on_hand",
      reason: "correction",
      quantities: [
        {
          inventoryItemId: "gid://shopify/InventoryItem/22",
          locationId: "gid://shopify/Location/11",
          quantity: 9,
          changeFromQuantity: 7,
        },
      ],
    });
    expect(graphql.mock.calls[0]?.[0].variables).toHaveProperty("idempotencyKey");
  });

  it("moves available inventory into reserved with CAS on both states", async () => {
    graphql.mockResolvedValue({
      inventoryMoveQuantities: {
        inventoryAdjustmentGroup: { createdAt: "2026-08-19T00:00:00Z" },
        userErrors: [],
      },
    });

    await moveShopifyInventoryReservations(context, {
      locationId: 11,
      items: [{ inventoryItemId: 22, currentAvailable: 8, currentReserved: 3 }],
      direction: "RESERVE",
      quantity: 2,
      reason: "correction",
    });

    const change = graphql.mock.calls[0]?.[0].variables.input.changes[0];
    expect(change).toMatchObject({
      quantity: 2,
      from: { name: "available", changeFromQuantity: 8 },
      to: { name: "reserved", changeFromQuantity: 3 },
    });
    expect(change.to.ledgerDocumentUri).toMatch(/^spf:\/\/inventory\/reservation\//);
  });

  it("enriches REST inventory levels with all GraphQL quantity states", async () => {
    const gid = "gid://shopify/InventoryLevel/11?inventory_item_id=22";
    graphql.mockResolvedValue({
      nodes: [
        {
          id: gid,
          quantities: [
            { name: "available", quantity: 5 },
            { name: "committed", quantity: 2 },
            { name: "reserved", quantity: 1 },
          ],
        },
      ],
    });

    const levels = await enrichShopifyInventoryQuantities(context, [
      {
        inventory_item_id: 22,
        location_id: 11,
        available: 4,
        admin_graphql_api_id: gid,
      },
    ]);

    expect(levels[0]).toMatchObject({
      available: 5,
      quantities: { available: 5, committed: 2, reserved: 1 },
    });
  });

  it("maps customs and measurement fields into inventoryItemUpdate", async () => {
    graphql.mockResolvedValue({
      inventoryItemUpdate: {
        inventoryItem: {
          id: "gid://shopify/InventoryItem/22",
          legacyResourceId: 22,
          sku: "SKU-22",
          tracked: true,
          requiresShipping: true,
          harmonizedSystemCode: "621710",
          countryCodeOfOrigin: "US",
          provinceCodeOfOrigin: "OR",
          measurement: { weight: { value: 2.5, unit: "KILOGRAMS" } },
        },
        userErrors: [],
      },
    });

    const updated = await updateShopifyInventoryItem(context, 22, {
      sku: "SKU-22",
      tracked: true,
      requires_shipping: true,
      harmonized_system_code: "621710",
      country_code_of_origin: "US",
      province_code_of_origin: "OR",
      weight_value: 2.5,
      weight_unit: "KILOGRAMS",
    });

    expect(graphql.mock.calls[0]?.[0].variables.input).toMatchObject({
      sku: "SKU-22",
      tracked: true,
      requiresShipping: true,
      harmonizedSystemCode: "621710",
      countryCodeOfOrigin: "US",
      measurement: { weight: { value: 2.5, unit: "KILOGRAMS" } },
    });
    expect(updated?.weight).toEqual({ value: 2.5, unit: "KILOGRAMS" });
  });
});
