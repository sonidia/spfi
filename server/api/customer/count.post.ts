import { defineEventHandler, readBody } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
import { buildCustomerCountParams } from "~~/server/utils/shopify-customer-query";
import { requireCustomerCredentials } from "~~/server/utils/shopify-customer-request";
import type {
  CustomerCountQuery,
  CustomerCountResponse,
} from "~~/types/shopify-customer";

interface CustomerCountBody {
  storeId?: string;
  token?: string;
  query?: CustomerCountQuery;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<CustomerCountBody>(event)) || {};
  const { storeId, token } = requireCustomerCredentials(body);

  return callShopifyApi<CustomerCountResponse>({
    event,
    storeId,
    token,
    path: "/customers/count.json",
    params: buildCustomerCountParams(body.query),
    missingProxyMessage: "Missing sock proxy for this store.",
  });
});
