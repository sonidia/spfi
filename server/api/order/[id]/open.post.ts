import { defineEventHandler, readBody } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
import type { OrdersResponse } from "~~/types/shopify";
import {
  requireShopifyCredentials,
  requireShopifyResourceId,
} from "~~/server/utils/shopify-admin-request";

interface OrderActionBody {
  storeId?: string;
  token?: string;
}

export default defineEventHandler(async (event) => {
  const id = requireShopifyResourceId(event.context.params?.id, "Order");
  const body = (await readBody<OrderActionBody>(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);

  return callShopifyApi<OrdersResponse>({
    event,
    storeId,
    token,
    path: `/orders/${id}/open.json`,
    method: "POST",
    body: {},
  });
});
