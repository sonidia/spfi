import { createApiErrorFromMessage } from "./callShopifyApi";
import { toShopifyGid } from "./callShopifyGraphql";
import { requireShopifyExactResourceId } from "./shopify-admin-request";
import type {
  ShopifyFulfillmentOrder,
  ShopifyFulfillmentOrderLineItem,
} from "~~/types/shopify";
import type { OrderFulfillmentGroupInput } from "~~/types/shopify-order";

export interface GraphqlFulfillmentGroupInput {
  fulfillmentOrderId: string;
  fulfillmentOrderLineItems: Array<{
    id: string;
    quantity: number;
  }>;
}

export function buildShopifyFulfillmentGroups(
  requestedGroups: OrderFulfillmentGroupInput[] | undefined,
  fulfillmentOrders: ShopifyFulfillmentOrder[],
): GraphqlFulfillmentGroupInput[] {
  if (requestedGroups !== undefined && !Array.isArray(requestedGroups)) {
    throw createApiErrorFromMessage("Fulfillment order groups must be an array.", 400);
  }

  const openOrders = fulfillmentOrders.filter(isOpenFulfillmentOrder);
  if (!openOrders.length) {
    throw createApiErrorFromMessage("This order has no open fulfillment items.", 422);
  }

  const openOrdersById = new Map(
    openOrders.map((order) => [
      requireShopifyExactResourceId(order.id, "Fulfillment order"),
      order,
    ]),
  );
  const groups = requestedGroups?.length
    ? requestedGroups.map((group) => validateRequestedGroup(group, openOrdersById))
    : openOrders.map(buildDefaultGroup).filter(hasLineItems);

  if (!groups.length) {
    throw createApiErrorFromMessage("Select at least one fulfillable line item.", 400);
  }

  return groups;
}

function validateRequestedGroup(
  group: OrderFulfillmentGroupInput,
  openOrdersById: Map<string, ShopifyFulfillmentOrder>,
): GraphqlFulfillmentGroupInput {
  const fulfillmentOrderId = requireShopifyExactResourceId(
    group?.fulfillment_order_id,
    "Fulfillment order",
  );
  const fulfillmentOrder = openOrdersById.get(fulfillmentOrderId);

  if (!fulfillmentOrder) {
    throw createApiErrorFromMessage(
      "A selected fulfillment order is not open for this order.",
      422,
    );
  }
  if (!Array.isArray(group.fulfillment_order_line_items)) {
    throw createApiErrorFromMessage(
      "Fulfillment order line items must be an array.",
      400,
    );
  }

  const availableById = new Map(
    (fulfillmentOrder.line_items || []).map((item) => [
      requireShopifyExactResourceId(item.id, "Fulfillment order line item"),
      item,
    ]),
  );
  const lineItems = group.fulfillment_order_line_items.map((item) => {
    const id = requireShopifyExactResourceId(item?.id, "Fulfillment order line item");
    const quantity = Number(item?.quantity);
    const available = availableById.get(id);
    const maximum = available
      ? (available.fulfillable_quantity ?? available.quantity)
      : 0;

    if (
      !available ||
      !Number.isSafeInteger(quantity) ||
      quantity <= 0 ||
      quantity > maximum
    ) {
      throw createApiErrorFromMessage(
        "A selected fulfillment quantity is invalid or no longer available.",
        422,
      );
    }

    return {
      id: toShopifyGid("FulfillmentOrderLineItem", id),
      quantity,
    };
  });

  if (!lineItems.length) {
    throw createApiErrorFromMessage(
      "Each selected fulfillment order needs at least one line item.",
      400,
    );
  }

  return {
    fulfillmentOrderId: toShopifyGid("FulfillmentOrder", fulfillmentOrderId),
    fulfillmentOrderLineItems: lineItems,
  };
}

function buildDefaultGroup(
  order: ShopifyFulfillmentOrder,
): GraphqlFulfillmentGroupInput {
  const fulfillmentOrderId = requireShopifyExactResourceId(
    order.id,
    "Fulfillment order",
  );
  const fulfillmentOrderLineItems = (order.line_items || [])
    .map(buildDefaultLineItem)
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return {
    fulfillmentOrderId: toShopifyGid("FulfillmentOrder", fulfillmentOrderId),
    fulfillmentOrderLineItems,
  };
}

function buildDefaultLineItem(item: ShopifyFulfillmentOrderLineItem) {
  const quantity = item.fulfillable_quantity ?? item.quantity;
  if (!Number.isSafeInteger(quantity) || quantity <= 0) return null;

  const id = requireShopifyExactResourceId(item.id, "Fulfillment order line item");
  return {
    id: toShopifyGid("FulfillmentOrderLineItem", id),
    quantity,
  };
}

function hasLineItems(group: GraphqlFulfillmentGroupInput) {
  return group.fulfillmentOrderLineItems.length > 0;
}

function isOpenFulfillmentOrder(order: ShopifyFulfillmentOrder) {
  const status = String(order.status || "").toLowerCase();
  return status === "open" || status === "in_progress";
}
