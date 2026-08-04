import { defineEventHandler, getQuery } from "h3";
import {
  callShopifyApi,
  createApiErrorFromMessage,
} from "~~/server/utils/callShopifyApi";

export default defineEventHandler(async (event) => {
  const id = String(event.context.params?.id || "");
  const query = getQuery(event);
  const storeId = String(query.storeId || "");
  const token = String(query.token || "");
  if (!id || !storeId || !token) {
    throw createApiErrorFromMessage(
      "Order ID, Store ID and Access Token are required.",
      400,
    );
  }

  await callShopifyApi<Record<string, never>>({
    event,
    storeId,
    token,
    path: `/orders/${id}.json`,
    method: "DELETE",
  });

  return { success: true };
});
