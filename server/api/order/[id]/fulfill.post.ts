import { createError, defineEventHandler, readBody } from "h3";
import { callShopifyApi, formatErrorMessage } from "~~/server/utils/callShopifyApi";
import type {
  ShopifyFulfillmentOrder,
  ShopifyFulfillmentOrderLineItem,
  ShopifyLocation,
} from "~~/types/shopify";

interface TrackingInfo {
  number?: string;
  company?: string;
}

interface FulfillmentLineItemsByOrder {
  fulfillment_order_id?: number;
  fulfillment_order_line_items?: ShopifyFulfillmentOrderLineItem[];
}

interface FulfillmentInfo {
  tracking_info?: TrackingInfo;
  line_items_by_fulfillment_order?: FulfillmentLineItemsByOrder[];
}

interface OrderFulfillBody {
  storeId?: string;
  token?: string;
  fulfillment?: FulfillmentInfo;
}

interface FulfillmentOrdersResponse {
  fulfillment_orders?: ShopifyFulfillmentOrder[];
}

interface LocationsResponse {
  locations?: ShopifyLocation[];
}

interface ModernFulfillmentPayload {
  fulfillment: {
    notify_customer: boolean;
    line_items_by_fulfillment_order: Array<{
      fulfillment_order_id: number;
      fulfillment_order_line_items?: ShopifyFulfillmentOrderLineItem[];
    }>;
    tracking_info: {
      number?: string;
      company: string;
      url: string;
    };
  };
}

interface LegacyFulfillmentPayload {
  fulfillment: {
    location_id: number;
    notify_customer: boolean;
    tracking_info: {
      number?: string;
      company: string;
      url: string;
    };
    tracking_number?: string;
    tracking_company: string;
  };
}

export default defineEventHandler(async (event) => {
  const appConfig = useAppConfig();
  const id = event.context.params?.id;
  const body = (await readBody<OrderFulfillBody>(event)) || {};
  const storeId = String(body.storeId || "");
  const token = String(body.token || "");
  const fulfillmentInfo = body.fulfillment;

  if (!id || !storeId || !token) {
    throw createError({
      statusCode: 400,
      statusMessage: "Order ID, Store ID and Access Token are required.",
    });
  }

  const trackingNumber = fulfillmentInfo?.tracking_info?.number;
  const trackingCompany =
    fulfillmentInfo?.tracking_info?.company || appConfig.tracking.company;
  const trackingUrl = `${appConfig.tracking.url}${trackingNumber || ""}`;

  try {
    let openFulfillmentOrder: ShopifyFulfillmentOrder | null = null;
    let fulfillmentOrderLineItems: ShopifyFulfillmentOrderLineItem[] = [];

    try {
      const explicitFulfillmentOrder =
        fulfillmentInfo?.line_items_by_fulfillment_order?.[0];

      if (explicitFulfillmentOrder?.fulfillment_order_id) {
        openFulfillmentOrder = {
          id: explicitFulfillmentOrder.fulfillment_order_id,
        };
        fulfillmentOrderLineItems =
          explicitFulfillmentOrder.fulfillment_order_line_items || [];
      } else {
        const fulfillmentOrdersResponse =
          await callShopifyApi<FulfillmentOrdersResponse>({
            event,
            storeId,
            token,
            path: `/orders/${id}/fulfillment_orders.json`,
            useAdminDomain: true,
            missingProxyMessage: "Missing sock proxy.",
          });
        const fulfillmentOrders =
          fulfillmentOrdersResponse.fulfillment_orders || [];

        openFulfillmentOrder =
          fulfillmentOrders.find(
            (order) => order.status === "open" || order.status === "in_progress",
          ) || null;

        if (openFulfillmentOrder && "line_items" in openFulfillmentOrder) {
          fulfillmentOrderLineItems = (openFulfillmentOrder.line_items || [])
            .map((lineItem) => ({
              id: lineItem.id,
              quantity: lineItem.fulfillable_quantity || lineItem.quantity,
            }))
            .filter((lineItem) => lineItem.quantity > 0);
        }
      }

      if (openFulfillmentOrder) {
        const fulfillmentOrderPayload: ModernFulfillmentPayload["fulfillment"]["line_items_by_fulfillment_order"][number] = {
          fulfillment_order_id: openFulfillmentOrder.id,
        };

        if (fulfillmentOrderLineItems.length > 0) {
          fulfillmentOrderPayload.fulfillment_order_line_items =
            fulfillmentOrderLineItems;
        }

        return await callShopifyApi<Record<string, unknown>, ModernFulfillmentPayload>({
          event,
          storeId,
          token,
          method: "POST",
          path: "/fulfillments.json",
          useAdminDomain: true,
          missingProxyMessage: "Missing sock proxy.",
          body: {
            fulfillment: {
              notify_customer: true,
              line_items_by_fulfillment_order: [fulfillmentOrderPayload],
              tracking_info: {
                number: trackingNumber,
                company: trackingCompany,
                url: trackingUrl,
              },
            },
          },
        });
      }
    } catch (fulfillmentOrderError) {
      console.warn(
        "[Fulfillment] Modern way failed: ",
        formatErrorMessage(fulfillmentOrderError),
      );
    }

    const locationsResponse = await callShopifyApi<LocationsResponse>({
      event,
      storeId,
      token,
      path: "/locations.json",
      useAdminDomain: true,
      missingProxyMessage: "Missing sock proxy.",
    });
    const locations = locationsResponse.locations || [];
    const primaryLocation = locations.find((location) => location.active) || locations[0];

    if (!primaryLocation) {
      throw new Error("No active location found to fulfill items.");
    }

    return await callShopifyApi<Record<string, unknown>, LegacyFulfillmentPayload>({
      event,
      storeId,
      token,
      method: "POST",
      path: `/orders/${id}/fulfillments.json`,
      useAdminDomain: true,
      missingProxyMessage: "Missing sock proxy.",
      body: {
        fulfillment: {
          location_id: primaryLocation.id,
          notify_customer: true,
          tracking_info: {
            number: trackingNumber,
            company: trackingCompany,
            url: trackingUrl,
          },
          tracking_number: trackingNumber,
          tracking_company: trackingCompany,
        },
      },
    });
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: formatErrorMessage(error),
    });
  }
});

