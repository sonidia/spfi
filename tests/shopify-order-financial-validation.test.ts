import assert from "node:assert/strict";
import test from "node:test";
import type { ShopifyOrder, ShopifyOrderTransaction } from "../types/shopify.ts";
import {
  assertCaptureAllowed,
  assertManualPaymentAllowed,
  assertRefundAllowed,
  assertVoidAllowed,
  compareMoney,
} from "../server/utils/shopify-order-financial-validation.ts";

const order: ShopifyOrder = {
  id: "1",
  order_number: 1,
  created_at: "2026-08-12T00:00:00Z",
  financial_status: "partially_paid",
  fulfillment_status: null,
  total_price: "100.00",
  current_total_price: "100.00",
  total_outstanding: "40.00",
  currency: "USD",
  line_items: [{ id: "line-1", quantity: 3 }],
};
const transactions: ShopifyOrderTransaction[] = [
  transaction("auth-1", "authorization", "100.00"),
  transaction("capture-1", "capture", "60.00", "auth-1"),
  transaction("sale-1", "sale", "50.00"),
  transaction("refund-1", "refund", "10.00", "sale-1"),
];

test("money comparisons remain exact beyond floating-point precision", () => {
  assert.equal(compareMoney("9007199254740993.01", "9007199254740993.00"), 1);
  assert.equal(compareMoney("1.2", "1.20"), 0);
});

test("capture and void validation use the selected order transaction balance", () => {
  assert.equal(
    assertCaptureAllowed(order, transactions, {
      parentTransactionId: "auth-1",
      amount: "40.00",
      currency: "USD",
    }).amount,
    "40.00",
  );
  assert.throws(
    () =>
      assertCaptureAllowed(order, transactions, {
        parentTransactionId: "auth-1",
        amount: "40.01",
        currency: "USD",
      }),
    /exceeds the remaining/i,
  );
  assert.equal(assertVoidAllowed(order, transactions, "auth-1").id, "auth-1");
});

test("manual payments cannot exceed the current Shopify outstanding balance", () => {
  assert.equal(
    assertManualPaymentAllowed(order, { amount: "40", currency: "USD" }).amount,
    "40",
  );
  assert.throws(
    () =>
      assertManualPaymentAllowed(order, {
        amount: "40.001",
        currency: "USD",
      }),
    /exceeds the remaining/i,
  );
});

test("refund validation checks transaction, gateway, and refundable quantities", () => {
  const input = {
    parentTransactionId: "sale-1",
    amount: "40.00",
    currency: "USD",
    gateway: "shopify_payments",
    lineItems: [
      { lineItemId: "line-1", quantity: 2, restockType: "NO_RESTOCK" as const },
    ],
  };
  assert.equal(assertRefundAllowed(order, transactions, [], input).amount, "40.00");
  assert.throws(
    () =>
      assertRefundAllowed(
        order,
        transactions,
        [
          {
            id: "refund",
            refund_line_items: [{ line_item_id: "line-1", quantity: 2 }],
          },
        ],
        input,
      ),
    /refundable quantity/i,
  );
  assert.throws(
    () =>
      assertRefundAllowed(order, transactions, [], {
        ...input,
        gateway: "manual",
      }),
    /gateway must match/i,
  );
});

function transaction(
  id: string,
  kind: string,
  amount: string,
  parentId?: string,
): ShopifyOrderTransaction {
  return {
    id,
    kind,
    amount,
    parent_id: parentId,
    currency: "USD",
    gateway: "shopify_payments",
    status: "success",
    created_at: "2026-08-12T00:00:00Z",
  };
}
