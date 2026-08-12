import { defineEventHandler, readBody } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
import {
  requireCustomerCredentials,
  requireCustomerPayload,
} from "~~/server/utils/shopify-customer-request";
import type { CustomerResponse, ShopifyCustomerInput } from "~~/types/shopify-customer";

interface CustomerCreateBody {
  storeId?: string;
  token?: string;
  customer?: ShopifyCustomerInput;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<CustomerCreateBody>(event)) || {};
  const { storeId, token } = requireCustomerCredentials(body);
  const customer = requireCustomerPayload<ShopifyCustomerInput>(
    body.customer,
    "Customer",
  );

  return callShopifyApi<CustomerResponse, { customer: ShopifyCustomerInput }>({
    event,
    storeId,
    token,
    path: "/customers.json",
    method: "POST",
    body: { customer },
    missingProxyMessage: "Missing sock proxy for this store.",
  });
});
