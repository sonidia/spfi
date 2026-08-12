import { defineEventHandler, getRouterParam } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
import {
  getShopifyQueryCredentials,
  requireShopifyResourceId,
} from "~~/server/utils/shopify-admin-request";
import type { OrderTransactionCountResponse } from "~~/types/shopify";

export default defineEventHandler(async (event) => {
  const orderId = requireShopifyResourceId(getRouterParam(event, "id"), "Order");
  const { storeId, token } = getShopifyQueryCredentials(event);

  return callShopifyApi<OrderTransactionCountResponse>({
    event,
    storeId,
    token,
    path: `/orders/${orderId}/transactions/count.json`,
  });
});
