import { defineEventHandler, readBody } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
import {
  requireCustomerCredentials,
  requireCustomerPayload,
  requireCustomerResourceId,
} from "~~/server/utils/shopify-customer-request";
import type {
  CustomerAddressResponse,
  ShopifyCustomerAddressInput,
} from "~~/types/shopify-customer";

interface CustomerAddressUpdateBody {
  storeId?: string;
  token?: string;
  address?: ShopifyCustomerAddressInput;
}

export default defineEventHandler(async (event) => {
  const customerId = requireCustomerResourceId(event.context.params?.id, "Customer");
  const addressId = requireCustomerResourceId(event.context.params?.aid, "Address");
  const body = (await readBody<CustomerAddressUpdateBody>(event)) || {};
  const { storeId, token } = requireCustomerCredentials(body);
  const address = requireCustomerPayload<ShopifyCustomerAddressInput>(
    body.address,
    "Address",
  );

  return callShopifyApi<
    CustomerAddressResponse,
    { address: ShopifyCustomerAddressInput }
  >({
    event,
    storeId,
    token,
    path: `/customers/${customerId}/addresses/${addressId}.json`,
    method: "PUT",
    body: { address },
    missingProxyMessage: "Missing sock proxy for this store.",
  });
});
