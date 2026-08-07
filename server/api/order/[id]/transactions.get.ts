import { defineEventHandler, getQuery, getRouterParam } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
import {
  getShopifyQueryCredentials,
  requireShopifyResourceId,
} from "~~/server/utils/shopify-admin-request";
import { buildOrderTransactionListParams } from "~~/server/utils/shopify-order-transaction-query";
import type { OrderTransactionsResponse } from "~~/types/shopify";

export default defineEventHandler(async (event) => {
  const orderId = requireShopifyResourceId(
    getRouterParam(event, "id"),
    "Order",
  );
  const query = getQuery(event);
  const { storeId, token } = getShopifyQueryCredentials(event);

  return callShopifyApi<OrderTransactionsResponse>({
    event,
    storeId,
    token,
    path: `/orders/${orderId}/transactions.json`,
    params: buildOrderTransactionListParams(query),
  });
});
