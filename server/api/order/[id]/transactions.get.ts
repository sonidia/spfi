import { defineEventHandler, getQuery, getRouterParam } from "h3";
import {
  callShopifyApi,
  createApiErrorFromMessage,
} from "~~/server/utils/callShopifyApi";
import type { BalanceTransactionsResponse } from "~~/types/shopify";

export default defineEventHandler(async (event) => {
  const orderId = getRouterParam(event, "id");
  const query = getQuery(event);
  const storeId = String(query.storeId || "");
  const token = String(query.token || "");

  if (!orderId) {
    throw createApiErrorFromMessage("Order ID is required.", 400);
  }

  if (!storeId || !token) {
    throw createApiErrorFromMessage("Store ID and Access Token are required.", 400);
  }

  return callShopifyApi<BalanceTransactionsResponse>({
    event,
    storeId,
    token,
    path: `/orders/${orderId}/transactions.json`,
  });
});
