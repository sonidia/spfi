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
import { compareDecimal, subtractDecimal, sumDecimal } from "./shopify-order-money";
import { buildRefundTransactionPlan } from "./shopify-order-refund-plan";

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

  const refundPlan = buildRefundTransactionPlan(orderId, transactions);
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
    transactions: refundPlan.transactions,
    discrepancyReason: "OTHER",
    currency: refundPlan.currency,
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
  return `Refunded ${refundPlan.amount} ${refundPlan.currency} without changing inventory.`;
}

async function fetchTransactions(context: BulkContext, orderId: string) {
  const response = await callShopifyApi<TransactionsResponse>({
    ...context,
    path: `/orders/${orderId}/transactions.json`,
    preserveUnsafeIntegers: true,
  });
  return response.transactions || [];
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
