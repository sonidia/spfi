import { defineEventHandler, readBody } from "h3";
import {
  callShopifyApi,
  createApiErrorFromMessage,
} from "~~/server/utils/callShopifyApi";
import type { OrdersResponse } from "~~/types/shopify";
import { requireShopifyResourceId } from "~~/server/utils/shopify-admin-request";

interface OrderActionBody {
  storeId?: string;
  token?: string;
}

export default defineEventHandler(async (event) => {
  const id = requireShopifyResourceId(event.context.params?.id, "Order");
  const body = (await readBody<OrderActionBody>(event)) || {};
  const storeId = String(body.storeId || "");
  const token = String(body.token || "");
  if (!storeId || !token) {
    throw createApiErrorFromMessage(
      "Order ID, Store ID and Access Token are required.",
      400,
    );
  }

  return callShopifyApi<OrdersResponse>({
    event,
    storeId,
    token,
    path: `/orders/${id}/open.json`,
    method: "POST",
    body: {},
  });
});
