import { defineEventHandler, getQuery, getRouterParam } from "h3";
import {
  callShopifyApi,
  createApiErrorFromMessage,
} from "~~/server/utils/callShopifyApi";
import { buildOrderTransactionDetailParams } from "~~/server/utils/shopify-order-transaction-query";
import type { OrderTransactionResponse } from "~~/types/shopify";

export default defineEventHandler(async (event) => {
  const orderId = getRouterParam(event, "id");
  const transactionId = getRouterParam(event, "transactionId");
  const query = getQuery(event);
  const storeId = String(query.storeId || "");
  const token = String(query.token || "");

  if (!orderId || !transactionId) {
    throw createApiErrorFromMessage(
      "Order ID and transaction ID are required.",
      400,
    );
  }
  if (!storeId || !token) {
    throw createApiErrorFromMessage(
      "Store ID and Access Token are required.",
      400,
    );
  }

  return callShopifyApi<OrderTransactionResponse>({
    event,
    storeId,
    token,
    path: `/orders/${orderId}/transactions/${transactionId}.json`,
    params: buildOrderTransactionDetailParams(query),
  });
});
