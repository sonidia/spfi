import { defineEventHandler, getQuery } from "h3";
import { callShopifyPaginatedApi } from "~~/server/utils/callShopifyPaginatedApi";
import {
  getShopifyQueryCredentials,
  requireShopifyResourceId,
} from "~~/server/utils/shopify-admin-request";
import { buildOrderFulfillmentListParams } from "~~/server/utils/shopify-order-query";
import type { ShopifyFulfillment } from "~~/types/shopify";
import type { OrderFulfillmentsResponse } from "~~/types/shopify-order";

export default defineEventHandler(
  async (event): Promise<OrderFulfillmentsResponse> => {
    const orderId = requireShopifyResourceId(
      event.context.params?.id,
      "order",
    );
    const { storeId, token } = getShopifyQueryCredentials(event);

    const fulfillments = await callShopifyPaginatedApi<ShopifyFulfillment>({
      event,
      storeId,
      token,
      path: `/orders/${orderId}/fulfillments.json`,
      resourceKey: "fulfillments",
      params: buildOrderFulfillmentListParams(getQuery(event)),
    });

    return { fulfillments };
  },
);
