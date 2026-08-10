import { defineEventHandler } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
import {
  getShopifyQueryCredentials,
  requireShopifyResourceId,
} from "~~/server/utils/shopify-admin-request";
import type { ShopifyFulfillmentOrder } from "~~/types/shopify";

interface FulfillmentOrdersResponse {
  fulfillment_orders?: ShopifyFulfillmentOrder[];
}

export default defineEventHandler(async (event) => {
  const id = requireShopifyResourceId(event.context.params?.id, "Order");
  const { storeId, token } = getShopifyQueryCredentials(event);

  return callShopifyApi<FulfillmentOrdersResponse>({
    event,
    storeId,
    token,
    path: `/orders/${id}/fulfillment_orders.json`,
    useAdminDomain: true,
    missingProxyMessage: "Missing sock proxy.",
    preserveUnsafeIntegers: true,
  });
});
