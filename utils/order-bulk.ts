import type { ShopifyOrder } from "../types/shopify";
import type { OrderBulkAction } from "../types/shopify-operations";

const CAPTURABLE_STATUSES = new Set(["authorized", "partially_paid"]);
const REFUNDABLE_STATUSES = new Set(["paid", "partially_paid", "partially_refunded"]);

export function isOrderEligibleForBulkAction(
  order: ShopifyOrder,
  action: OrderBulkAction,
) {
  if (order.cancelled_at) return false;

  const financialStatus = String(order.financial_status || "").toLowerCase();
  if (action === "capture") return CAPTURABLE_STATUSES.has(financialStatus);
  if (action === "refund") {
    return (
      REFUNDABLE_STATUSES.has(financialStatus) &&
      Number(order.current_total_price ?? order.total_price) > 0
    );
  }

  const fulfillmentStatus = String(
    order.fulfillment_status || "unfulfilled",
  ).toLowerCase();
  return fulfillmentStatus === "unfulfilled" || fulfillmentStatus === "partial";
}

export function getEligibleBulkOrderIds(
  orders: ShopifyOrder[],
  selectedIds: ReadonlySet<string>,
  action: OrderBulkAction,
) {
  return orders
    .filter(
      (order) =>
        selectedIds.has(String(order.id)) &&
        isOrderEligibleForBulkAction(order, action),
    )
    .map((order) => String(order.id));
}
