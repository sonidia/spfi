import { defineEventHandler, readBody } from "h3";
import {
  callShopifyApiWithResponse,
  createApiErrorFromMessage,
} from "~~/server/utils/callShopifyApi";
import type { OrdersResponse } from "~~/types/shopify";
import type { OrderListQuery, PaginatedOrdersResponse } from "~~/types/shopify-order";
import { buildOrderListParams } from "~~/server/utils/shopify-order-query";
import { getShopifyPageInfo } from "~~/server/utils/shopify-pagination";

interface OrderAllBody {
  storeId?: string;
  token?: string;
  query?: OrderListQuery;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<OrderAllBody>(event)) || {};
  const storeId = String(body.storeId || "");
  const token = String(body.token || "");

  if (!storeId || !token) {
    throw createApiErrorFromMessage("Store ID and Access Token are required.", 400);
  }

  const response = await callShopifyApiWithResponse<OrdersResponse>({
    event,
    storeId,
    token,
    path: "/orders.json",
    params: buildOrderListParams(body.query),
    preserveUnsafeIntegers: true,
  });

  return {
    orders: response.data.orders || [],
    pageInfo: getShopifyPageInfo(response.headers),
  } satisfies PaginatedOrdersResponse;
});
