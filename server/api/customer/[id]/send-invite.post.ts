import { defineEventHandler, readBody } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
import {
  requireCustomerCredentials,
  requireCustomerResourceId,
} from "~~/server/utils/shopify-customer-request";
import type {
  CustomerInviteResponse,
  ShopifyCustomerInviteInput,
} from "~~/types/shopify-customer";

interface CustomerInviteBody {
  storeId?: string;
  token?: string;
  customer_invite?: ShopifyCustomerInviteInput;
}

export default defineEventHandler(async (event) => {
  const customerId = requireCustomerResourceId(event.context.params?.id, "Customer");
  const body = (await readBody<CustomerInviteBody>(event)) || {};
  const { storeId, token } = requireCustomerCredentials(body);
  const requestBody = {
    customer_invite: body.customer_invite || {},
  };

  return callShopifyApi<CustomerInviteResponse, typeof requestBody>({
    event,
    storeId,
    token,
    path: `/customers/${customerId}/send_invite.json`,
    method: "POST",
    body: requestBody,
    missingProxyMessage: "Missing sock proxy for this store.",
  });
});
