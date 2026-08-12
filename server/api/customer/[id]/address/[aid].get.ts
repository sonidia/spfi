import { defineEventHandler } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
import {
  getCustomerQueryCredentials,
  requireCustomerResourceId,
} from "~~/server/utils/shopify-customer-request";
import type { CustomerAddressResponse } from "~~/types/shopify-customer";

export default defineEventHandler(async (event) => {
  const customerId = requireCustomerResourceId(event.context.params?.id, "Customer");
  const addressId = requireCustomerResourceId(event.context.params?.aid, "Address");
  const { storeId, token } = getCustomerQueryCredentials(event);

  return callShopifyApi<CustomerAddressResponse>({
    event,
    storeId,
    token,
    path: `/customers/${customerId}/addresses/${addressId}.json`,
    missingProxyMessage: "Missing sock proxy for this store.",
  });
});
