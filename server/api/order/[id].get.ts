import { createError, defineEventHandler, getQuery } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
import type { OrdersResponse } from "~~/types/shopify";

export default defineEventHandler(async (event) => {
  const id = event.context.params?.id;
  const { storeId, token } = getQuery(event);
  const sid = String(storeId || "");
  const accessToken = String(token || "");

  if (!id || !sid || !accessToken) {
    throw createError({
      statusCode: 400,
      statusMessage: "ID, Store ID and Access Token are required.",
    });
  }

  return callShopifyApi<OrdersResponse>({
    event,
    storeId: sid,
    token: accessToken,
    path: `/orders/${id}.json`,
    missingProxyMessage: "Missing sock proxy for this store.",
  });
});
