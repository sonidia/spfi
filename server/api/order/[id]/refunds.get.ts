import { defineEventHandler, getQuery } from "h3";
import { callShopifyPaginatedApi } from "~~/server/utils/callShopifyPaginatedApi";
import {
  getShopifyQueryCredentials,
  requireShopifyResourceId,
} from "~~/server/utils/shopify-admin-request";
import { buildOrderRefundListParams } from "~~/server/utils/shopify-order-query";
import type { ShopifyRefund } from "~~/types/shopify";
import type { OrderRefundsResponse } from "~~/types/shopify-order";

export default defineEventHandler(async (event): Promise<OrderRefundsResponse> => {
  const orderId = requireShopifyResourceId(
    event.context.params?.id,
    "order",
  );
  const { storeId, token } = getShopifyQueryCredentials(event);

  const refunds = await callShopifyPaginatedApi<ShopifyRefund>({
    event,
    storeId,
    token,
    path: `/orders/${orderId}/refunds.json`,
    resourceKey: "refunds",
    params: buildOrderRefundListParams(getQuery(event)),
  });

  return { refunds };
});
