import { defineEventHandler, getQuery } from "h3";
import {
  callShopifyApi,
  createApiErrorFromMessage,
} from "~~/server/utils/callShopifyApi";
import type { ShopifyFulfillmentOrder } from "~~/types/shopify";

interface FulfillmentOrdersResponse {
  fulfillment_orders?: ShopifyFulfillmentOrder[];
}

export default defineEventHandler(async (event) => {
  const id = event.context.params?.id;
  const query = getQuery(event);
  const storeId = String(query.storeId || "");
  const token = String(query.token || "");

  if (!id || !storeId || !token) {
    throw createApiErrorFromMessage("Order ID, Store ID and Access Token are required in query params.", 400);
  }

  return callShopifyApi<FulfillmentOrdersResponse>({
    event,
    storeId,
    token,
    path: `/orders/${id}/fulfillment_orders.json`,
    useAdminDomain: true,
    missingProxyMessage: "Missing sock proxy.",
  });
});
