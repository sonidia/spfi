import { createError, defineEventHandler, getQuery, getRouterParam } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
import type { BalanceTransactionsResponse } from "~~/types/shopify";

export default defineEventHandler(async (event) => {
  const orderId = getRouterParam(event, "id");
  const query = getQuery(event);
  const storeId = String(query.storeId || "");
  const token = String(query.token || "");

  if (!orderId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Order ID is required.",
    });
  }

  if (!storeId || !token) {
    throw createError({
      statusCode: 400,
      statusMessage: "Store ID and Access Token are required.",
    });
  }

  return callShopifyApi<BalanceTransactionsResponse>({
    event,
    storeId,
    token,
    path: `/orders/${orderId}/transactions.json`,
  });
});
