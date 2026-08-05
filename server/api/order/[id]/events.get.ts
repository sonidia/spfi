import { defineEventHandler, getQuery, getRouterParam } from "h3";
import {
  callShopifyApi,
  createApiErrorFromMessage,
} from "~~/server/utils/callShopifyApi";
import type { OrderEventsResponse } from "~~/types/shopify";

export default defineEventHandler(async (event) => {
  const orderId = getRouterParam(event, "id");
  const query = getQuery(event);
  const storeId = String(query.storeId || "");
  const token = String(query.token || "");

  if (!orderId || !storeId || !token) {
    throw createApiErrorFromMessage(
      "Order ID, Store ID and Access Token are required.",
      400,
    );
  }

  return callShopifyApi<OrderEventsResponse>({
    event,
    storeId,
    token,
    path: `/orders/${orderId}/events.json`,
    params: { limit: 250 },
  });
});
