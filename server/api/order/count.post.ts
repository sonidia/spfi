import { defineEventHandler, readBody } from "h3";
import {
  callShopifyApi,
  createApiErrorFromMessage,
} from "~~/server/utils/callShopifyApi";
import { buildOrderCountParams } from "~~/server/utils/shopify-order-query";
import type { OrderCountQuery, OrderCountResponse } from "~~/types/shopify-order";

interface CountOrdersBody {
  storeId?: string;
  token?: string;
  query?: OrderCountQuery;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<CountOrdersBody>(event)) || {};
  const storeId = String(body.storeId || "");
  const token = String(body.token || "");
  if (!storeId || !token) {
    throw createApiErrorFromMessage("Store ID and Access Token are required.", 400);
  }

  return callShopifyApi<OrderCountResponse>({
    event,
    storeId,
    token,
    path: "/orders/count.json",
    params: buildOrderCountParams(body.query),
  });
});
