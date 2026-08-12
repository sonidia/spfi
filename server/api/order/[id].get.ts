import { defineEventHandler, getQuery } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
import {
  getShopifyQueryCredentials,
  requireShopifyResourceId,
} from "~~/server/utils/shopify-admin-request";
import type { OrdersResponse } from "~~/types/shopify";

export default defineEventHandler(async (event) => {
  const id = requireShopifyResourceId(event.context.params?.id, "Order");
  const query = getQuery(event);
  const { storeId, token } = getShopifyQueryCredentials(event);
  const fields = query.fields;

  return callShopifyApi<OrdersResponse>({
    event,
    storeId,
    token,
    path: `/orders/${id}.json`,
    params: typeof fields === "string" && fields ? { fields } : undefined,
    missingProxyMessage: "Missing sock proxy for this store.",
  });
});
