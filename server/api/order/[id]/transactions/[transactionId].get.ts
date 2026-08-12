import { defineEventHandler, getQuery, getRouterParam } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
import {
  getShopifyQueryCredentials,
  requireShopifyResourceId,
} from "~~/server/utils/shopify-admin-request";
import { buildOrderTransactionDetailParams } from "~~/server/utils/shopify-order-transaction-query";
import type { OrderTransactionResponse } from "~~/types/shopify";

export default defineEventHandler(async (event) => {
  const orderId = requireShopifyResourceId(getRouterParam(event, "id"), "Order");
  const transactionId = requireShopifyResourceId(
    getRouterParam(event, "transactionId"),
    "Transaction",
  );
  const query = getQuery(event);
  const { storeId, token } = getShopifyQueryCredentials(event);

  return callShopifyApi<OrderTransactionResponse>({
    event,
    storeId,
    token,
    path: `/orders/${orderId}/transactions/${transactionId}.json`,
    params: buildOrderTransactionDetailParams(query),
  });
});
