import { defineEventHandler } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
import { callShopifyPaginatedApi } from "~~/server/utils/callShopifyPaginatedApi";
import {
  getCustomerQueryCredentials,
  requireCustomerResourceId,
} from "~~/server/utils/shopify-customer-request";
import type {
  CustomerDetailResponse,
  CustomersResponse,
  ShopifyOrder,
} from "~~/types/shopify";

export default defineEventHandler(async (event): Promise<CustomerDetailResponse> => {
  const id = requireCustomerResourceId(event.context.params?.id, "Customer");
  const { storeId, token } = getCustomerQueryCredentials(event);

  const [customerResponse, orders] = await Promise.all([
    callShopifyApi<CustomersResponse>({
      event,
      storeId,
      token,
      path: `/customers/${id}.json`,
      missingProxyMessage: "Missing sock proxy for this store.",
    }),
    callShopifyPaginatedApi<ShopifyOrder>({
      event,
      storeId,
      token,
      path: `/customers/${id}/orders.json`,
      resourceKey: "orders",
      params: { status: "any" },
      missingProxyMessage: "Missing sock proxy for this store.",
    }),
  ]);

  return {
    customer: customerResponse.customer || null,
    orders,
  };
});
