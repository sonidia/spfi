import { defineEventHandler, readBody } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
import {
  requireCustomerCredentials,
  requireCustomerResourceId,
} from "~~/server/utils/shopify-customer-request";
import type { CustomerAccountActivationUrlResponse } from "~~/types/shopify-customer";

interface CustomerActionBody {
  storeId?: string;
  token?: string;
}

export default defineEventHandler(async (event) => {
  const customerId = requireCustomerResourceId(event.context.params?.id, "Customer");
  const body = (await readBody<CustomerActionBody>(event)) || {};
  const { storeId, token } = requireCustomerCredentials(body);

  return callShopifyApi<CustomerAccountActivationUrlResponse, Record<string, never>>({
    event,
    storeId,
    token,
    path: `/customers/${customerId}/account_activation_url.json`,
    method: "POST",
    body: {},
    missingProxyMessage: "Missing sock proxy for this store.",
  });
});
