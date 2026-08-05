import { defineEventHandler, readBody } from "h3";
import {
  callShopifyApi,
  createApiError,
  createApiErrorFromMessage,
} from "~~/server/utils/callShopifyApi";
import type {
  ShopifyFulfillmentOrder,
  ShopifyFulfillmentOrderLineItem,
} from "~~/types/shopify";

interface TrackingInfo {
  number?: string;
  company?: string;
  url?: string;
}

interface FulfillmentLineItemsByOrder {
  fulfillment_order_id?: number;
  fulfillment_order_line_items?: ShopifyFulfillmentOrderLineItem[];
}

interface OrderFulfillBody {
  storeId?: string;
  token?: string;
  fulfillment?: {
    notify_customer?: boolean;
    tracking_info?: TrackingInfo;
    line_items_by_fulfillment_order?: FulfillmentLineItemsByOrder[];
  };
}

interface FulfillmentOrdersResponse {
  fulfillment_orders?: ShopifyFulfillmentOrder[];
}

interface ModernFulfillmentPayload {
  fulfillment: {
    notify_customer: boolean;
    line_items_by_fulfillment_order: Array<{
      fulfillment_order_id: number;
      fulfillment_order_line_items?: Array<{ id: number; quantity: number }>;
    }>;
    tracking_info?: {
      number?: string;
      company?: string;
      url?: string;
    };
  };
}

export default defineEventHandler(async (event) => {
  const appConfig = useAppConfig();
  const orderId = String(event.context.params?.id || "");
  const body = (await readBody<OrderFulfillBody>(event)) || {};
  const storeId = String(body.storeId || "");
  const token = String(body.token || "");
  const fulfillmentInfo = body.fulfillment || {};

  if (!orderId || !storeId || !token) {
    throw createApiErrorFromMessage(
      "Order ID, Store ID and Access Token are required.",
      400,
    );
  }

  try {
    const response = await callShopifyApi<FulfillmentOrdersResponse>({
      event,
      storeId,
      token,
      path: `/orders/${orderId}/fulfillment_orders.json`,
      missingProxyMessage: "Missing sock proxy.",
    });
    const openOrders = (response.fulfillment_orders || []).filter(
      (order) => order.status === "open" || order.status === "in_progress",
    );

    if (!openOrders.length) {
      throw createApiErrorFromMessage(
        "This order has no open fulfillment items.",
        422,
      );
    }

    const requestedGroups =
      fulfillmentInfo.line_items_by_fulfillment_order || [];
    const groups = requestedGroups.length
      ? validateRequestedGroups(requestedGroups, openOrders)
      : openOrders
          .map((order) => ({
            fulfillment_order_id: order.id,
            fulfillment_order_line_items: (order.line_items || [])
              .map((item) => ({
                id: item.id,
                quantity: item.fulfillable_quantity ?? item.quantity,
              }))
              .filter((item) => item.quantity > 0),
          }))
          .filter((group) => group.fulfillment_order_line_items.length > 0);

    if (!groups.length) {
      throw createApiErrorFromMessage(
        "Select at least one fulfillable line item.",
        400,
      );
    }

    const trackingNumber = String(
      fulfillmentInfo.tracking_info?.number || "",
    ).trim();
    const trackingCompany = String(
      fulfillmentInfo.tracking_info?.company || appConfig.tracking.company || "",
    ).trim();
    const canUseDefaultTrackingUrl =
      trackingNumber &&
      trackingCompany.toLowerCase() ===
        String(appConfig.tracking.company || "").trim().toLowerCase();
    const trackingUrl = String(
      fulfillmentInfo.tracking_info?.url ||
        (canUseDefaultTrackingUrl
          ? `${appConfig.tracking.url}${trackingNumber}`
          : ""),
    ).trim();
    const trackingInfo = trackingNumber || trackingUrl
      ? {
          ...(trackingNumber ? { number: trackingNumber } : {}),
          ...(trackingCompany ? { company: trackingCompany } : {}),
          ...(trackingUrl ? { url: trackingUrl } : {}),
        }
      : undefined;

    return await callShopifyApi<Record<string, unknown>, ModernFulfillmentPayload>({
      event,
      storeId,
      token,
      method: "POST",
      retryTransport: false,
      path: "/fulfillments.json",
      missingProxyMessage: "Missing sock proxy.",
      body: {
        fulfillment: {
          notify_customer: fulfillmentInfo.notify_customer !== false,
          line_items_by_fulfillment_order: groups,
          ...(trackingInfo ? { tracking_info: trackingInfo } : {}),
        },
      },
    });
  } catch (error) {
    if (typeof error === "object" && error && "statusCode" in error) {
      throw error;
    }
    throw createApiError(error, "Failed to fulfill order.");
  }
});

function validateRequestedGroups(
  requestedGroups: FulfillmentLineItemsByOrder[],
  openOrders: ShopifyFulfillmentOrder[],
): ModernFulfillmentPayload["fulfillment"]["line_items_by_fulfillment_order"] {
  return requestedGroups.map((group) => {
    const fulfillmentOrderId = Number(group.fulfillment_order_id);
    const fulfillmentOrder = openOrders.find(
      (candidate) => candidate.id === fulfillmentOrderId,
    );
    if (!fulfillmentOrder) {
      throw createApiErrorFromMessage(
        "A selected fulfillment order is not open for this order.",
        422,
      );
    }

    const availableById = new Map(
      (fulfillmentOrder.line_items || []).map((item) => [item.id, item]),
    );
    const items = (group.fulfillment_order_line_items || []).map((item) => {
      const id = Number(item.id);
      const quantity = Number(item.quantity);
      const available = availableById.get(id);
      const maximum = available
        ? available.fulfillable_quantity ?? available.quantity
        : 0;

      if (
        !available ||
        !Number.isInteger(quantity) ||
        quantity <= 0 ||
        quantity > maximum
      ) {
        throw createApiErrorFromMessage(
          "A selected fulfillment quantity is invalid or no longer available.",
          422,
        );
      }

      return { id, quantity };
    });

    if (!items.length) {
      throw createApiErrorFromMessage(
        "Each selected fulfillment order needs at least one line item.",
        400,
      );
    }

    return {
      fulfillment_order_id: fulfillmentOrderId,
      fulfillment_order_line_items: items,
    };
  });
}
