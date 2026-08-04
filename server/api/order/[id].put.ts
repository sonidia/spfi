import { defineEventHandler, readBody } from "h3";
import {
  callShopifyApi,
  createApiErrorFromMessage,
} from "~~/server/utils/callShopifyApi";
import type { OrdersResponse } from "~~/types/shopify";
import type { ShopifyOrderPayload } from "~~/types/shopify-order";

interface UpdateOrderBody {
  storeId?: string;
  token?: string;
  order?: ShopifyOrderPayload;
}

export default defineEventHandler(async (event) => {
  const id = String(event.context.params?.id || "");
  const body = (await readBody<UpdateOrderBody>(event)) || {};
  const storeId = String(body.storeId || "");
  const token = String(body.token || "");
  if (!id || !storeId || !token || !body.order) {
    throw createApiErrorFromMessage(
      "Order ID, Store ID, Access Token and order payload are required.",
      400,
    );
  }

  const requestBody = { order: { ...body.order, id: Number(id) || id } };
  return callShopifyApi<OrdersResponse, typeof requestBody>({
    event,
    storeId,
    token,
    path: `/orders/${id}.json`,
    method: "PUT",
    body: requestBody,
  });
});
