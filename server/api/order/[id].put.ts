import { defineEventHandler, readBody } from "h3";
import {
  callShopifyApi,
} from "~~/server/utils/callShopifyApi";
import {
  requireShopifyCredentials,
  requireShopifyPayload,
  requireShopifyResourceId,
  requireShopifySafeResourceNumber,
} from "~~/server/utils/shopify-admin-request";
import type { OrdersResponse } from "~~/types/shopify";
import type { ShopifyOrderPayload } from "~~/types/shopify-order";

interface UpdateOrderBody {
  storeId?: string;
  token?: string;
  order?: ShopifyOrderPayload;
}

export default defineEventHandler(async (event) => {
  const id = requireShopifyResourceId(event.context.params?.id, "Order");
  const body = (await readBody<UpdateOrderBody>(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);
  const order = requireShopifyPayload<ShopifyOrderPayload>(
    body.order,
    "Order",
  );

  const requestBody = {
    order: {
      ...order,
      id: requireShopifySafeResourceNumber(id, "Order"),
    },
  };
  return callShopifyApi<OrdersResponse, typeof requestBody>({
    event,
    storeId,
    token,
    path: `/orders/${id}.json`,
    method: "PUT",
    body: requestBody,
  });
});
