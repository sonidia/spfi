import { defineEventHandler, getQuery, getRouterParam } from "h3";
import { callShopifyPaginatedApi } from "~~/server/utils/callShopifyPaginatedApi";
import {
  getShopifyQueryCredentials,
  requireShopifyResourceId,
} from "~~/server/utils/shopify-admin-request";
import { buildOrderTransactionListParams } from "~~/server/utils/shopify-order-transaction-query";
import type { ShopifyOrderTransaction } from "~~/types/shopify";

export default defineEventHandler(async (event) => {
  const orderId = requireShopifyResourceId(getRouterParam(event, "id"), "Order");
  const query = getQuery(event);
  const { storeId, token } = getShopifyQueryCredentials(event);

  const transactions = await callShopifyPaginatedApi<ShopifyOrderTransaction>({
    event,
    storeId,
    token,
    path: `/orders/${orderId}/transactions.json`,
    resourceKey: "transactions",
    params: buildOrderTransactionListParams(query),
  });

  return { transactions };
});
