import { defineEventHandler, readBody } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
import {
  requireCustomerCredentials,
  requireCustomerPayload,
  requireCustomerResourceId,
} from "~~/server/utils/shopify-customer-request";
import { requireShopifySafeResourceNumber } from "~~/server/utils/shopify-admin-request";
import type {
  CustomerResponse,
  ShopifyCustomerInput,
} from "~~/types/shopify-customer";

interface CustomerUpdateBody {
  storeId?: string;
  token?: string;
  customer?: ShopifyCustomerInput;
}

export default defineEventHandler(async (event) => {
  const customerId = requireCustomerResourceId(
    event.context.params?.id,
    "Customer",
  );
  const body = (await readBody<CustomerUpdateBody>(event)) || {};
  const { storeId, token } = requireCustomerCredentials(body);
  const customer = requireCustomerPayload<ShopifyCustomerInput>(
    body.customer,
    "Customer",
  );
  const requestBody = {
    customer: {
      ...customer,
      id: requireShopifySafeResourceNumber(customerId, "Customer"),
    },
  };

  return callShopifyApi<CustomerResponse, typeof requestBody>({
    event,
    storeId,
    token,
    path: `/customers/${customerId}.json`,
    method: "PUT",
    body: requestBody,
    missingProxyMessage: "Missing sock proxy for this store.",
  });
});
