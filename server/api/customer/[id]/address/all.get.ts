import { defineEventHandler, getQuery } from "h3";
import { callShopifyPaginatedApi } from "~~/server/utils/callShopifyPaginatedApi";
import { buildCustomerAddressListParams } from "~~/server/utils/shopify-customer-query";
import {
  getCustomerQueryCredentials,
  requireCustomerResourceId,
} from "~~/server/utils/shopify-customer-request";
import type { ShopifyCustomerAddress } from "~~/types/shopify";

export default defineEventHandler(async (event) => {
  const customerId = requireCustomerResourceId(
    event.context.params?.id,
    "Customer",
  );
  const { storeId, token } = getCustomerQueryCredentials(event);

  const addresses = await callShopifyPaginatedApi<ShopifyCustomerAddress>({
    event,
    storeId,
    token,
    path: `/customers/${customerId}/addresses.json`,
    resourceKey: "addresses",
    params: buildCustomerAddressListParams(getQuery(event)),
    missingProxyMessage: "Missing sock proxy for this store.",
  });

  return { addresses };
});
