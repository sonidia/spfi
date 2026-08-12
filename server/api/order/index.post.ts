import { defineEventHandler, readBody } from "h3";
import {
  callShopifyApi,
  createApiErrorFromMessage,
} from "~~/server/utils/callShopifyApi";
import type { OrdersResponse } from "~~/types/shopify";
import type { OrderCreateOptions, ShopifyOrderPayload } from "~~/types/shopify-order";

interface CreateOrderBody extends OrderCreateOptions {
  storeId?: string;
  token?: string;
  order?: ShopifyOrderPayload;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<CreateOrderBody>(event)) || {};
  const storeId = String(body.storeId || "");
  const token = String(body.token || "");

  if (!storeId || !token || !body.order) {
    throw createApiErrorFromMessage(
      "Store ID, Access Token and order payload are required.",
      400,
    );
  }

  const requestBody = {
    order: body.order,
    ...(body.inventory_behaviour
      ? { inventory_behaviour: body.inventory_behaviour }
      : {}),
    ...(typeof body.send_receipt === "boolean"
      ? { send_receipt: body.send_receipt }
      : {}),
    ...(typeof body.send_fulfillment_receipt === "boolean"
      ? { send_fulfillment_receipt: body.send_fulfillment_receipt }
      : {}),
  };

  return callShopifyApi<OrdersResponse, typeof requestBody>({
    event,
    storeId,
    token,
    path: "/orders.json",
    method: "POST",
    body: requestBody,
  });
});
