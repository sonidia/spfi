import { defineEventHandler, getQuery } from "h3";
import {
  callShopifyApi,
  createApiErrorFromMessage,
} from "~~/server/utils/callShopifyApi";
import { isShopifyNumericId } from "~~/server/utils/shopify-id";
import type {
  CustomerDetailResponse,
  CustomersResponse,
  OrdersResponse,
} from "~~/types/shopify";

export default defineEventHandler(async (event): Promise<CustomerDetailResponse> => {
  const id = String(event.context.params?.id || "").trim();
  const { storeId, token } = getQuery(event);
  const sid = String(storeId || "").trim();
  const accessToken = String(token || "").trim();

  if (!isShopifyNumericId(id) || !sid || !accessToken) {
    throw createApiErrorFromMessage(
      "A numeric Customer ID, Store ID and Access Token are required.",
      400,
    );
  }

  const [customerResponse, ordersResponse] = await Promise.all([
    callShopifyApi<CustomersResponse>({
      event,
      storeId: sid,
      token: accessToken,
      path: `/customers/${id}.json`,
      missingProxyMessage: "Missing sock proxy for this store.",
    }),
    callShopifyApi<OrdersResponse>({
      event,
      storeId: sid,
      token: accessToken,
      path: `/customers/${id}/orders.json`,
      params: { status: "any", limit: 250 },
      missingProxyMessage: "Missing sock proxy for this store.",
    }),
  ]);

  return {
    customer: customerResponse.customer || null,
    orders: ordersResponse.orders || [],
  };
});
