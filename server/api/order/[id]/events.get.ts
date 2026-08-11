import { defineEventHandler, getRouterParam } from "h3";
import { callShopifyPaginatedApi } from "~~/server/utils/callShopifyPaginatedApi";
import {
  getShopifyQueryCredentials,
  requireShopifyResourceId,
} from "~~/server/utils/shopify-admin-request";
import type { ShopifyOrderEvent } from "~~/types/shopify";

export default defineEventHandler(async (event) => {
  const orderId = requireShopifyResourceId(getRouterParam(event, "id"), "Order");
  const { storeId, token } = getShopifyQueryCredentials(event);

  const events = await callShopifyPaginatedApi<ShopifyOrderEvent>({
    event,
    storeId,
    token,
    path: `/orders/${orderId}/events.json`,
    resourceKey: "events",
  });

  return { events };
});
