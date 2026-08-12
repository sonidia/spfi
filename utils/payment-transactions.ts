import type { ShopifyBalanceTransaction } from "~~/types/shopify";

type OrderTransactionStatusSource = Pick<
  ShopifyBalanceTransaction,
  "source_order_id" | "payout_status"
>;

export function buildOrderTransactionStatusMap(
  transactions: readonly OrderTransactionStatusSource[],
) {
  const statuses = new Map<string, string>();

  for (const transaction of transactions) {
    const orderId = String(transaction.source_order_id || "").trim();
    const status = String(transaction.payout_status || "").trim();
    if (orderId && status && !statuses.has(orderId)) {
      statuses.set(orderId, status);
    }
  }

  return statuses;
}
