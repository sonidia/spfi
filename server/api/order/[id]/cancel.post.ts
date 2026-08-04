import { defineEventHandler, readBody } from "h3";
import {
  callShopifyApi,
  createApiErrorFromMessage,
} from "~~/server/utils/callShopifyApi";
import type { OrdersResponse } from "~~/types/shopify";
import type { OrderCancelInput } from "~~/types/shopify-order";

interface CancelOrderBody extends OrderCancelInput {
  storeId?: string;
  token?: string;
}

export default defineEventHandler(async (event) => {
  const id = String(event.context.params?.id || "");
  const body = (await readBody<CancelOrderBody>(event)) || {};
  const storeId = String(body.storeId || "");
  const token = String(body.token || "");
  if (!id || !storeId || !token) {
    throw createApiErrorFromMessage(
      "Order ID, Store ID and Access Token are required.",
      400,
    );
  }

  const requestBody: OrderCancelInput = {
    ...(body.amount ? { amount: body.amount } : {}),
    ...(body.currency ? { currency: body.currency } : {}),
    ...(typeof body.email === "boolean" ? { email: body.email } : {}),
    ...(body.reason ? { reason: body.reason } : {}),
    ...(body.refund ? { refund: body.refund } : {}),
  };

  return callShopifyApi<OrdersResponse, OrderCancelInput>({
    event,
    storeId,
    token,
    path: `/orders/${id}/cancel.json`,
    method: "POST",
    body: requestBody,
  });
});
