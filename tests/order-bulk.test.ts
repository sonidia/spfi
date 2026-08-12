import assert from "node:assert/strict";
import test from "node:test";
import type { ShopifyOrder } from "../types/shopify.ts";
import {
  getEligibleBulkOrderIds,
  isOrderEligibleForBulkAction,
} from "../utils/order-bulk.ts";

function order(
  id: string,
  financialStatus: string,
  fulfillmentStatus: string | null,
  overrides: Partial<ShopifyOrder> = {},
): ShopifyOrder {
  return {
    id,
    name: `#${id}`,
    order_number: Number(id),
    created_at: "2026-08-12T00:00:00Z",
    financial_status: financialStatus,
    fulfillment_status: fulfillmentStatus,
    total_price: "20.00",
    current_total_price: "20.00",
    currency: "USD",
    line_items: [],
    ...overrides,
  };
}

test("bulk eligibility keeps financial and fulfillment actions separate", () => {
  const authorized = order("1", "authorized", null);
  const paid = order("2", "paid", "unfulfilled");
  const fulfilled = order("3", "paid", "fulfilled");

  assert.equal(isOrderEligibleForBulkAction(authorized, "capture"), true);
  assert.equal(isOrderEligibleForBulkAction(authorized, "refund"), false);
  assert.equal(isOrderEligibleForBulkAction(paid, "fulfill"), true);
  assert.equal(isOrderEligibleForBulkAction(paid, "refund"), true);
  assert.equal(isOrderEligibleForBulkAction(fulfilled, "fulfill"), false);
});

test("cancelled and fully refunded orders are excluded", () => {
  const cancelled = order("1", "authorized", null, {
    cancelled_at: "2026-08-12T01:00:00Z",
  });
  const zeroBalance = order("2", "partially_refunded", "fulfilled", {
    current_total_price: "0.00",
  });

  assert.equal(isOrderEligibleForBulkAction(cancelled, "capture"), false);
  assert.equal(isOrderEligibleForBulkAction(cancelled, "fulfill"), false);
  assert.equal(isOrderEligibleForBulkAction(zeroBalance, "refund"), false);
});

test("eligible IDs only include selected orders", () => {
  const orders = [
    order("1", "authorized", null),
    order("2", "paid", null),
    order("3", "authorized", null),
  ];

  assert.deepEqual(getEligibleBulkOrderIds(orders, new Set(["1", "2"]), "capture"), [
    "1",
  ]);
});
