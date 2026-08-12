import { defineEventHandler } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
import {
  getCustomerQueryCredentials,
  requireCustomerResourceId,
} from "~~/server/utils/shopify-customer-request";

export default defineEventHandler(async (event) => {
  const customerId = requireCustomerResourceId(
    event.context.params?.id,
    "Customer",
  );
  const addressId = requireCustomerResourceId(
    event.context.params?.aid,
    "Address",
  );
  const { storeId, token } = getCustomerQueryCredentials(event);

  await callShopifyApi<Record<string, never>>({
    event,
    storeId,
    token,
    path: `/customers/${customerId}/addresses/${addressId}.json`,
    method: "DELETE",
    missingProxyMessage: "Missing sock proxy for this store.",
  });

  return { success: true };
});
