import { randomUUID } from "node:crypto";
import type { H3Event } from "h3";
import type {
  ShopifyFulfillmentOrder,
  ShopifyOrder,
  ShopifyOrderTransaction,
} from "~~/types/shopify";
import type { OrderBulkAction, OrderBulkResult } from "~~/types/shopify-operations";
import { callShopifyApi, createApiErrorFromMessage } from "./callShopifyApi";
import {
  assertNoGraphqlUserErrors,
  callShopifyGraphql,
  toShopifyGid,
} from "./callShopifyGraphql";
import { buildShopifyFulfillmentGroups } from "./shopify-fulfillment";

interface BulkContext {
  event: H3Event;
  storeId: string;
  token: string;
  notifyCustomer: boolean;
}

interface TransactionsResponse {
  transactions?: ShopifyOrderTransaction[];
}

interface OrderResponse {
  order?: ShopifyOrder;
}

interface FulfillmentOrdersResponse {
  fulfillment_orders?: ShopifyFulfillmentOrder[];
}

interface UserError {
  field?: string[] | null;
  message: string;
}

const BULK_CONCURRENCY = 2;

export async function runShopifyOrderBulkAction(
  context: BulkContext,
  action: OrderBulkAction,
  orderIds: string[],
) {
  const results: OrderBulkResult[] = new Array(orderIds.length);
  let cursor = 0;

  async function worker() {
    while (cursor < orderIds.length) {
      const index = cursor++;
      const orderId = orderIds[index]!;
      try {
        const message = await runSingleAction(context, action, orderId);
        results[index] = { orderId, ok: true, message };
      } catch (error) {
        results[index] = {
          orderId,
          ok: false,
          message: getServerErrorMessage(error, `Failed to ${action} order.`),
        };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(BULK_CONCURRENCY, orderIds.length) }, worker),
  );
  return results;
}

async function runSingleAction(
  context: BulkContext,
  action: OrderBulkAction,
  orderId: string,
) {
  if (action === "capture") return captureAvailableAuthorization(context, orderId);
  if (action === "fulfill") return fulfillAvailableItems(context, orderId);
  return refundRemainingOrder(context, orderId);
}

async function captureAvailableAuthorization(context: BulkContext, orderId: string) {
  const transactions = await fetchTransactions(context, orderId);
  const candidates = transactions
    .filter(
      (transaction) =>
        transaction.kind.toLowerCase() === "authorization" &&
        transaction.status.toLowerCase() === "success",
    )
    .map((transaction) => ({
      transaction,
      remaining: subtractDecimal(
        transaction.amount,
        sumDecimal(
          transactions
            .filter(
              (child) =>
                String(child.parent_id || "") === String(transaction.id) &&
                child.kind.toLowerCase() === "capture" &&
                child.status.toLowerCase() === "success",
            )
            .map((child) => child.amount),
        ),
      ),
    }))
    .filter(({ remaining }) => compareDecimal(remaining, "0") > 0)
    .sort((a, b) => compareDecimal(b.remaining, a.remaining));

  const candidate = candidates[0];
  if (!candidate) {
    throw createApiErrorFromMessage(
      "No successful authorization with capturable funds was found.",
      422,
    );
  }

  const data = await callShopifyGraphql<{
    orderCapture: {
      transaction: { id: string; status: string } | null;
      userErrors: UserError[];
    };
  }>({
    ...context,
    operationName: "BulkCaptureOrderPayment",
    retryTransport: false,
    query: `#graphql
      mutation BulkCaptureOrderPayment($input: OrderCaptureInput!) {
        orderCapture(input: $input) {
          transaction { id status }
          userErrors { field message }
        }
      }
    `,
    variables: {
      input: {
        id: toShopifyGid("Order", orderId),
        parentTransactionId: toShopifyGid("OrderTransaction", candidate.transaction.id),
        amount: candidate.remaining,
        currency: candidate.transaction.currency,
        finalCapture: true,
      },
    },
  });

  assertNoGraphqlUserErrors(
    data.orderCapture.userErrors,
    "Failed to capture the order payment.",
  );
  if (!data.orderCapture.transaction) {
    throw createApiErrorFromMessage(
      "Shopify did not return the captured transaction.",
      502,
    );
  }

  return `Captured ${candidate.remaining} ${candidate.transaction.currency}.`;
}

async function fulfillAvailableItems(context: BulkContext, orderId: string) {
  const response = await callShopifyApi<FulfillmentOrdersResponse>({
    ...context,
    path: `/orders/${orderId}/fulfillment_orders.json`,
    preserveUnsafeIntegers: true,
  });
  const groups = buildShopifyFulfillmentGroups(
    undefined,
    response.fulfillment_orders || [],
  );
  const data = await callShopifyGraphql<{
    fulfillmentCreate: {
      fulfillment: { id: string } | null;
      userErrors: UserError[];
    };
  }>({
    ...context,
    operationName: "BulkCreateFulfillment",
    retryTransport: false,
    query: `#graphql
      mutation BulkCreateFulfillment($fulfillment: FulfillmentInput!) {
        fulfillmentCreate(fulfillment: $fulfillment) {
          fulfillment { id }
          userErrors { field message }
        }
      }
    `,
    variables: {
      fulfillment: {
        notifyCustomer: context.notifyCustomer,
        lineItemsByFulfillmentOrder: groups,
      },
    },
  });

  assertNoGraphqlUserErrors(
    data.fulfillmentCreate.userErrors,
    "Failed to fulfill the order.",
  );
  if (!data.fulfillmentCreate.fulfillment) {
    throw createApiErrorFromMessage(
      "Shopify did not return the created fulfillment.",
      502,
    );
  }
  return "Fulfilled all currently available items.";
}

async function refundRemainingOrder(context: BulkContext, orderId: string) {
  const [{ order }, transactions] = await Promise.all([
    callShopifyApi<OrderResponse>({
      ...context,
      path: `/orders/${orderId}.json`,
      preserveUnsafeIntegers: true,
    }),
    fetchTransactions(context, orderId),
  ]);
  if (!order) {
    throw createApiErrorFromMessage("Shopify did not return the order.", 502);
  }

  const amount = String(order.current_total_price ?? order.total_price ?? "0");
  if (compareDecimal(amount, "0") <= 0) {
    throw createApiErrorFromMessage(
      "The order has no remaining amount to refund.",
      422,
    );
  }

  const refundableTransactions = buildRefundTransactions(orderId, amount, transactions);
  const refundedByLineItem = new Map<string, number>();
  for (const refund of order.refunds || []) {
    for (const lineItem of refund.refund_line_items || []) {
      const key = String(lineItem.line_item_id);
      refundedByLineItem.set(
        key,
        (refundedByLineItem.get(key) || 0) + Number(lineItem.quantity || 0),
      );
    }
  }
  const refundLineItems = (order.line_items || [])
    .map((lineItem) => ({
      lineItemId: toShopifyGid("LineItem", lineItem.id),
      quantity: Math.max(
        0,
        Number(lineItem.quantity || 0) -
          (refundedByLineItem.get(String(lineItem.id)) || 0),
      ),
      restockType: "NO_RESTOCK" as const,
    }))
    .filter(
      (lineItem) => Number.isSafeInteger(lineItem.quantity) && lineItem.quantity > 0,
    );

  if (!refundLineItems.length) {
    throw createApiErrorFromMessage("The order has no refundable line items.", 422);
  }

  const input = {
    orderId: toShopifyGid("Order", orderId),
    refundLineItems,
    transactions: refundableTransactions,
    discrepancyReason: "OTHER",
    currency: order.currency,
    notify: context.notifyCustomer,
    note: "Full refund created from bulk order operations.",
  };
  const data = await callShopifyGraphql<{
    refundCreate: {
      refund: { id: string } | null;
      userErrors: UserError[];
    };
  }>({
    ...context,
    operationName: "BulkCreateOrderRefund",
    retryTransport: false,
    query: `#graphql
      mutation BulkCreateOrderRefund($input: RefundInput!, $key: String!) {
        refundCreate(input: $input) @idempotent(key: $key) {
          refund { id }
          userErrors { field message }
        }
      }
    `,
    variables: { input, key: randomUUID() },
  });

  assertNoGraphqlUserErrors(
    data.refundCreate.userErrors,
    "Failed to refund the order.",
  );
  if (!data.refundCreate.refund) {
    throw createApiErrorFromMessage("Shopify did not return the created refund.", 502);
  }
  return `Refunded ${amount} ${order.currency} without changing inventory.`;
}

async function fetchTransactions(context: BulkContext, orderId: string) {
  const response = await callShopifyApi<TransactionsResponse>({
    ...context,
    path: `/orders/${orderId}/transactions.json`,
    preserveUnsafeIntegers: true,
  });
  return response.transactions || [];
}

function buildRefundTransactions(
  orderId: string,
  requestedAmount: string,
  transactions: ShopifyOrderTransaction[],
) {
  let remaining = requestedAmount;
  const refunds = transactions.filter(
    (transaction) =>
      transaction.kind.toLowerCase() === "refund" &&
      transaction.status.toLowerCase() === "success",
  );
  const parents = transactions.filter(
    (transaction) =>
      ["sale", "capture"].includes(transaction.kind.toLowerCase()) &&
      transaction.status.toLowerCase() === "success",
  );
  const output: Array<Record<string, string>> = [];

  for (const parent of parents) {
    const alreadyRefunded = sumDecimal(
      refunds
        .filter((refund) => String(refund.parent_id || "") === String(parent.id))
        .map((refund) => refund.amount),
    );
    const available = subtractDecimal(parent.amount, alreadyRefunded);
    if (compareDecimal(available, "0") <= 0) continue;

    const amount = compareDecimal(available, remaining) <= 0 ? available : remaining;
    output.push({
      orderId: toShopifyGid("Order", orderId),
      parentId: toShopifyGid("OrderTransaction", parent.id),
      kind: "REFUND",
      gateway: String(parent.gateway || "manual"),
      amount,
    });
    remaining = subtractDecimal(remaining, amount);
    if (compareDecimal(remaining, "0") <= 0) break;
  }

  if (!output.length || compareDecimal(remaining, "0") > 0) {
    throw createApiErrorFromMessage(
      "Successful payment transactions do not cover the remaining refund amount.",
      422,
    );
  }
  return output;
}

interface ParsedDecimal {
  units: bigint;
  scale: number;
}

const BIGINT_ZERO = BigInt(0);
const BIGINT_TEN = BigInt(10);

function parseDecimal(value: string): ParsedDecimal {
  const normalized = String(value || "0").trim();
  const match = normalized.match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!match)
    throw createApiErrorFromMessage("Shopify returned an invalid amount.", 502);
  const fraction = match[3] || "";
  const units = BigInt(`${match[1] || ""}${match[2]}${fraction}`);
  return { units, scale: fraction.length };
}

function alignDecimals(left: ParsedDecimal, right: ParsedDecimal) {
  const scale = Math.max(left.scale, right.scale);
  return {
    left: left.units * BIGINT_TEN ** BigInt(scale - left.scale),
    right: right.units * BIGINT_TEN ** BigInt(scale - right.scale),
    scale,
  };
}

function formatDecimal(units: bigint, scale: number) {
  const negative = units < BIGINT_ZERO;
  const digits = (negative ? -units : units).toString().padStart(scale + 1, "0");
  const value = scale
    ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}`.replace(/\.?0+$/, "")
    : digits;
  return `${negative ? "-" : ""}${value || "0"}`;
}

function subtractDecimal(leftValue: string, rightValue: string) {
  const { left, right, scale } = alignDecimals(
    parseDecimal(leftValue),
    parseDecimal(rightValue),
  );
  return formatDecimal(left - right, scale);
}

function sumDecimal(values: string[]) {
  return values.reduce((total, value) => addDecimal(total, value), "0");
}

function addDecimal(leftValue: string, rightValue: string) {
  const { left, right, scale } = alignDecimals(
    parseDecimal(leftValue),
    parseDecimal(rightValue),
  );
  return formatDecimal(left + right, scale);
}

function compareDecimal(leftValue: string, rightValue: string) {
  const { left, right } = alignDecimals(
    parseDecimal(leftValue),
    parseDecimal(rightValue),
  );
  return left === right ? 0 : left > right ? 1 : -1;
}

function getServerErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object") {
    const value = error as {
      statusMessage?: unknown;
      message?: unknown;
      data?: unknown;
    };
    if (typeof value.statusMessage === "string" && value.statusMessage.trim()) {
      return value.statusMessage.trim();
    }
    if (typeof value.message === "string" && value.message.trim()) {
      return value.message.trim();
    }
  }
  return fallback;
}
