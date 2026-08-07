import { defineEventHandler, getQuery } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
import {
  getShopifyQueryCredentials,
  requireShopifyResourceId,
} from "~~/server/utils/shopify-admin-request";
import { buildOrderFulfillmentListParams } from "~~/server/utils/shopify-order-query";
import type { OrderFulfillmentsResponse } from "~~/types/shopify-order";

export default defineEventHandler(
  async (event): Promise<OrderFulfillmentsResponse> => {
    const orderId = requireShopifyResourceId(
      event.context.params?.id,
      "order",
    );
    const { storeId, token } = getShopifyQueryCredentials(event);

    return callShopifyApi<OrderFulfillmentsResponse>({
      event,
      storeId,
      token,
      path: `/orders/${orderId}/fulfillments.json`,
      params: buildOrderFulfillmentListParams(getQuery(event)),
    });
  },
);
