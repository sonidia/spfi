import { defineEventHandler, readBody } from "h3";
import {
  callShopifyApi,
  createApiErrorFromMessage,
} from "~~/server/utils/callShopifyApi";
import type { OrdersResponse } from "~~/types/shopify";

interface OrderAllBody {
  storeId?: string;
  token?: string;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<OrderAllBody>(event)) || {};
  const storeId = String(body.storeId || "");
  const token = String(body.token || "");

  if (!storeId || !token) {
    throw createApiErrorFromMessage("Store ID and Access Token are required.", 400);
  }

  return callShopifyApi<OrdersResponse>({
    event,
    storeId,
    token,
    path: "/orders.json",
    params: { status: "any", limit: 250 },
  });
});
