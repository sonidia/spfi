import { defineEventHandler, getQuery } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
import {
  getShopifyQueryCredentials,
  requireShopifyResourceId,
} from "~~/server/utils/shopify-admin-request";
import { buildOrderRefundListParams } from "~~/server/utils/shopify-order-query";
import type { OrderRefundsResponse } from "~~/types/shopify-order";

export default defineEventHandler(async (event): Promise<OrderRefundsResponse> => {
  const orderId = requireShopifyResourceId(
    event.context.params?.id,
    "order",
  );
  const { storeId, token } = getShopifyQueryCredentials(event);

  return callShopifyApi<OrderRefundsResponse>({
    event,
    storeId,
    token,
    path: `/orders/${orderId}/refunds.json`,
    params: buildOrderRefundListParams(getQuery(event)),
  });
});
