import { defineEventHandler, readBody } from "h3";
import { callShopifyApiWithResponse } from "~~/server/utils/callShopifyApi";
import type { OrdersResponse } from "~~/types/shopify";
import type { OrderListQuery, PaginatedOrdersResponse } from "~~/types/shopify-order";
import { buildOrderListParams } from "~~/server/utils/shopify-order-query";
import { getShopifyPageInfo } from "~~/server/utils/shopify-pagination";
import { createApiSuccessResponse } from "~~/server/utils/api-response";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";

interface OrderAllBody {
  storeId?: string;
  token?: string;
  query?: OrderListQuery;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<OrderAllBody>(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);

  const response = await callShopifyApiWithResponse<OrdersResponse>({
    event,
    storeId,
    token,
    path: "/orders.json",
    params: buildOrderListParams(body.query),
    preserveUnsafeIntegers: true,
  });

  const orders = response.data.orders || [];
  const pageInfo = getShopifyPageInfo(response.headers);

  return createApiSuccessResponse(
    { orders },
    {
      resource: "orders",
      strategy: "cursor",
      fieldConvention: "shopify-rest",
      pagination: pageInfo,
    },
  ) satisfies PaginatedOrdersResponse;
});
