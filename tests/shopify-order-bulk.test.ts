import assert from "node:assert/strict";
import test from "node:test";
import { buildRefundTransactionPlan } from "../server/utils/shopify-order-refund-plan.ts";
import type { ShopifyOrderTransaction } from "../types/shopify.ts";

function transaction(
  overrides: Partial<ShopifyOrderTransaction>,
): ShopifyOrderTransaction {
  return {
    id: "1",
    kind: "sale",
    gateway: "card",
    status: "success",
    created_at: "2026-08-18T00:00:00Z",
    amount: "10",
    currency: "EUR",
    ...overrides,
  };
}

test("bulk refund derives its amount and currency from refundable transactions", () => {
  const plan = buildRefundTransactionPlan("42", [
    transaction({ id: "10", amount: "12.50", currency: "EUR" }),
    transaction({
      id: "11",
      kind: "refund",
      parent_id: "10",
      amount: "2.50",
      currency: "EUR",
    }),
  ]);

  assert.equal(plan.amount, "10");
  assert.equal(plan.currency, "EUR");
  assert.deepEqual(plan.transactions, [
    {
      orderId: "gid://shopify/Order/42",
      parentId: "gid://shopify/OrderTransaction/10",
      kind: "REFUND",
      gateway: "card",
      amount: "10",
    },
  ]);
});

test("bulk refund rejects mixed transaction currencies", () => {
  assert.throws(
    () =>
      buildRefundTransactionPlan("42", [
        transaction({ id: "10", currency: "USD" }),
        transaction({ id: "20", currency: "EUR" }),
      ]),
    /different currencies/i,
  );
});
