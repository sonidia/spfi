import type {
  ShopifyOrder,
  ShopifyOrderTransaction,
  ShopifyRefund,
} from "~~/types/shopify";
import type { OrderRefundLineItemInput } from "~~/types/shopify-order";
import { createStandardApiErrorFromMessage } from "./api-error.ts";

const BIGINT_ZERO = BigInt(0);
const BIGINT_ONE = BigInt(1);
const BIGINT_TEN = BigInt(10);

export function assertCaptureAllowed(
  order: ShopifyOrder,
  transactions: ShopifyOrderTransaction[],
  input: { parentTransactionId: unknown; amount: unknown; currency?: unknown },
) {
  assertOrderNotCancelled(order);
  const parent = requireSuccessfulParent(transactions, input.parentTransactionId, [
    "authorization",
  ]);
  const amount = requirePositiveMoney(input.amount, "Capture amount");
  const remaining = remainingTransactionAmount(parent, transactions, [
    "capture",
    "sale",
  ]);
  assertAmountWithin(amount, remaining, "Capture amount");
  assertCurrencyMatches(input.currency, parent.currency, "Capture currency");
  return { parent, amount, currency: parent.currency };
}

export function assertVoidAllowed(
  order: ShopifyOrder,
  transactions: ShopifyOrderTransaction[],
  parentTransactionId: unknown,
) {
  assertOrderNotCancelled(order);
  const parent = requireSuccessfulParent(transactions, parentTransactionId, [
    "authorization",
  ]);
  const remaining = remainingTransactionAmount(parent, transactions, [
    "capture",
    "sale",
    "void",
  ]);
  if (compareMoney(remaining, "0") <= 0) {
    throw createStandardApiErrorFromMessage(
      "The selected authorization has already been fully captured or voided.",
      422,
    );
  }
  return parent;
}

export function assertManualPaymentAllowed(
  order: ShopifyOrder,
  input: { amount: unknown; currency: unknown },
) {
  assertOrderNotCancelled(order);
  const amount = requirePositiveMoney(input.amount, "Manual payment amount");
  const outstanding = requireMoney(
    order.total_outstanding,
    "Shopify order outstanding amount",
    502,
  );
  if (compareMoney(outstanding, "0") <= 0) {
    throw createStandardApiErrorFromMessage(
      "This order has no outstanding balance to record.",
      422,
    );
  }
  assertAmountWithin(amount, outstanding, "Manual payment amount");
  assertCurrencyMatches(input.currency, order.currency, "Manual payment currency");
  return { amount, currency: order.currency };
}

export function assertRefundAllowed(
  order: ShopifyOrder,
  transactions: ShopifyOrderTransaction[],
  refunds: ShopifyRefund[],
  input: {
    parentTransactionId: unknown;
    amount: unknown;
    currency?: unknown;
    gateway: unknown;
    lineItems: OrderRefundLineItemInput[];
  },
) {
  const parent = requireSuccessfulParent(transactions, input.parentTransactionId, [
    "capture",
    "sale",
  ]);
  const amount = requirePositiveMoney(input.amount, "Refund amount");
  const remaining = remainingTransactionAmount(parent, transactions, ["refund"]);
  assertAmountWithin(amount, remaining, "Refund amount");
  assertCurrencyMatches(input.currency, parent.currency, "Refund currency");

  const requestedGateway = String(input.gateway || "").trim();
  const parentGateway = String(parent.gateway || "").trim();
  if (!requestedGateway || (parentGateway && requestedGateway !== parentGateway)) {
    throw createStandardApiErrorFromMessage(
      "Refund gateway must match the selected Shopify transaction.",
      422,
    );
  }

  assertRefundLineQuantities(order, refunds, input.lineItems);
  return {
    parent,
    amount,
    currency: parent.currency,
    gateway: parentGateway || requestedGateway,
  };
}

export function compareMoney(left: string, right: string): number {
  const a = parseDecimal(left);
  const b = parseDecimal(right);
  const scale = Math.max(a.scale, b.scale);
  const aValue = a.value * BIGINT_TEN ** BigInt(scale - a.scale);
  const bValue = b.value * BIGINT_TEN ** BigInt(scale - b.scale);
  return aValue === bValue ? 0 : aValue > bValue ? 1 : -1;
}

function remainingTransactionAmount(
  parent: ShopifyOrderTransaction,
  transactions: ShopifyOrderTransaction[],
  childKinds: string[],
): string {
  const consumed = transactions
    .filter(
      (transaction) =>
        isSuccessful(transaction) &&
        childKinds.includes(String(transaction.kind || "").toLowerCase()) &&
        String(transaction.parent_id || "") === String(parent.id),
    )
    .reduce((total, transaction) => addMoney(total, transaction.amount), "0");
  return subtractMoney(parent.amount, consumed);
}

function requireSuccessfulParent(
  transactions: ShopifyOrderTransaction[],
  idValue: unknown,
  allowedKinds: string[],
) {
  const id = String(idValue || "").trim();
  const parent = transactions.find((transaction) => String(transaction.id) === id);
  if (
    !parent ||
    !isSuccessful(parent) ||
    !allowedKinds.includes(String(parent.kind || "").toLowerCase())
  ) {
    throw createStandardApiErrorFromMessage(
      "The selected parent transaction is not valid for this order action.",
      422,
    );
  }
  return parent;
}

function assertRefundLineQuantities(
  order: ShopifyOrder,
  refunds: ShopifyRefund[],
  requestedItems: OrderRefundLineItemInput[],
) {
  const orderLines = new Map(
    (order.line_items || []).map((line) => [String(line.id), line]),
  );
  const refundedByLine = new Map<string, number>();
  for (const refund of refunds) {
    for (const line of refund.refund_line_items || []) {
      const id = String(line.line_item_id);
      refundedByLine.set(id, (refundedByLine.get(id) || 0) + Number(line.quantity));
    }
  }

  const seen = new Set<string>();
  for (const requested of requestedItems) {
    const id = String(requested.lineItemId || "").trim();
    const quantity = Number(requested.quantity);
    const orderLine = orderLines.get(id);
    const remaining = Number(orderLine?.quantity || 0) - (refundedByLine.get(id) || 0);
    if (
      !id ||
      seen.has(id) ||
      !orderLine ||
      !Number.isSafeInteger(quantity) ||
      quantity <= 0 ||
      quantity > remaining
    ) {
      throw createStandardApiErrorFromMessage(
        "A refund line item quantity is invalid or exceeds the refundable quantity.",
        422,
      );
    }
    seen.add(id);
  }
}

function assertOrderNotCancelled(order: ShopifyOrder) {
  if (order.cancelled_at) {
    throw createStandardApiErrorFromMessage(
      "Financial actions are not allowed on a cancelled order.",
      422,
    );
  }
}

function assertAmountWithin(amount: string, maximum: string, label: string) {
  if (compareMoney(amount, maximum) > 0) {
    throw createStandardApiErrorFromMessage(
      `${label} exceeds the remaining Shopify amount.`,
      422,
    );
  }
}

function assertCurrencyMatches(
  requestedValue: unknown,
  expectedValue: unknown,
  label: string,
) {
  const requested = String(requestedValue || "")
    .trim()
    .toUpperCase();
  const expected = String(expectedValue || "")
    .trim()
    .toUpperCase();
  if (!expected || (requested && requested !== expected)) {
    throw createStandardApiErrorFromMessage(
      `${label} must match Shopify currency ${expected || "(unknown)"}.`,
      422,
    );
  }
}

function requirePositiveMoney(value: unknown, label: string, statusCode = 400) {
  const normalized = requireMoney(value, label, statusCode);
  if (compareMoney(normalized, "0") <= 0) {
    throw createStandardApiErrorFromMessage(
      `${label} must be a positive decimal amount.`,
      statusCode,
    );
  }
  return normalized;
}

function requireMoney(value: unknown, label: string, statusCode: number) {
  const normalized = String(value ?? "").trim();
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
    throw createStandardApiErrorFromMessage(
      `${label} must be a decimal amount.`,
      statusCode,
    );
  }
  return normalized;
}

function isSuccessful(transaction: ShopifyOrderTransaction) {
  return String(transaction.status || "").toLowerCase() === "success";
}

function parseDecimal(value: string) {
  const [whole = "0", fraction = ""] = String(value).split(".");
  return {
    value: BigInt(`${whole || "0"}${fraction}`),
    scale: fraction.length,
  };
}

function addMoney(left: string, right: string) {
  return calculateMoney(left, right, BIGINT_ONE);
}

function subtractMoney(left: string, right: string) {
  return calculateMoney(left, right, -BIGINT_ONE);
}

function calculateMoney(left: string, right: string, direction: bigint) {
  const a = parseDecimal(left);
  const b = parseDecimal(right);
  const scale = Math.max(a.scale, b.scale);
  const value =
    a.value * BIGINT_TEN ** BigInt(scale - a.scale) +
    direction * b.value * BIGINT_TEN ** BigInt(scale - b.scale);
  if (value <= BIGINT_ZERO) return "0";
  if (scale === 0) return value.toString();
  const digits = value.toString().padStart(scale + 1, "0");
  return `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}
