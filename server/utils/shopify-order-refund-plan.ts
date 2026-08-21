import { buildShopifyGid } from "./shopify-gid.ts";
import {
  addDecimal,
  compareDecimal,
  subtractDecimal,
  sumDecimal,
} from "./shopify-order-money.ts";
import type { ShopifyOrderTransaction } from "../../types/shopify.ts";

export function buildRefundTransactionPlan(
  orderId: string,
  transactions: ShopifyOrderTransaction[],
) {
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
  const currencies = new Set<string>();
  let amount = "0";

  for (const parent of parents) {
    const currency = String(parent.currency || "")
      .trim()
      .toUpperCase();
    if (!currency) throw new Error("A refundable transaction is missing its currency.");
    const alreadyRefunded = sumDecimal(
      refunds
        .filter((refund) => String(refund.parent_id || "") === String(parent.id))
        .map((refund) => refund.amount),
    );
    const available = subtractDecimal(parent.amount, alreadyRefunded);
    if (compareDecimal(available, "0") <= 0) continue;

    currencies.add(currency);
    amount = addDecimal(amount, available);
    output.push({
      orderId: buildShopifyGid("Order", orderId),
      parentId: buildShopifyGid("OrderTransaction", parent.id),
      kind: "REFUND",
      gateway: String(parent.gateway || "manual"),
      amount: available,
    });
  }

  if (!output.length) throw new Error("The order has no refundable payment balance.");
  if (currencies.size !== 1) {
    throw new Error(
      "Bulk refund cannot combine payment transactions in different currencies.",
    );
  }
  return {
    amount,
    currency: [...currencies][0]!,
    transactions: output,
  };
}
