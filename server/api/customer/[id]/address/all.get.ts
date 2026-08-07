import { defineEventHandler, getQuery } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
import { buildCustomerAddressListParams } from "~~/server/utils/shopify-customer-query";
import {
  getCustomerQueryCredentials,
  requireCustomerResourceId,
} from "~~/server/utils/shopify-customer-request";
import type { CustomerAddressesResponse } from "~~/types/shopify-customer";

export default defineEventHandler(async (event) => {
  const customerId = requireCustomerResourceId(
    event.context.params?.id,
    "Customer",
  );
  const { storeId, token } = getCustomerQueryCredentials(event);

  return callShopifyApi<CustomerAddressesResponse>({
    event,
    storeId,
    token,
    path: `/customers/${customerId}/addresses.json`,
    params: buildCustomerAddressListParams(getQuery(event)),
    missingProxyMessage: "Missing sock proxy for this store.",
  });
});
