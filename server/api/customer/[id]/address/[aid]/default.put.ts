import { defineEventHandler, readBody } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
import {
  requireCustomerCredentials,
  requireCustomerResourceId,
} from "~~/server/utils/shopify-customer-request";
import type { CustomerAddressResponse } from "~~/types/shopify-customer";

interface CustomerAddressDefaultBody {
  storeId?: string;
  token?: string;
}

export default defineEventHandler(async (event) => {
  const customerId = requireCustomerResourceId(event.context.params?.id, "Customer");
  const addressId = requireCustomerResourceId(event.context.params?.aid, "Address");
  const body = (await readBody<CustomerAddressDefaultBody>(event)) || {};
  const { storeId, token } = requireCustomerCredentials(body);

  return callShopifyApi<CustomerAddressResponse, Record<string, never>>({
    event,
    storeId,
    token,
    path: `/customers/${customerId}/addresses/${addressId}/default.json`,
    method: "PUT",
    body: {},
    missingProxyMessage: "Missing sock proxy for this store.",
  });
});
