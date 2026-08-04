import { defineEventHandler, readBody } from "h3";
import {
  callShopifyApi,
  createApiErrorFromMessage,
} from "~~/server/utils/callShopifyApi";
import type { OrdersResponse } from "~~/types/shopify";

interface OrderActionBody {
  storeId?: string;
  token?: string;
}

export default defineEventHandler(async (event) => {
  const id = String(event.context.params?.id || "");
  const body = (await readBody<OrderActionBody>(event)) || {};
  const storeId = String(body.storeId || "");
  const token = String(body.token || "");
  if (!id || !storeId || !token) {
    throw createApiErrorFromMessage(
      "Order ID, Store ID and Access Token are required.",
      400,
    );
  }

  return callShopifyApi<OrdersResponse>({
    event,
    storeId,
    token,
    path: `/orders/${id}/close.json`,
    method: "POST",
    body: {},
  });
});
