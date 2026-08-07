import { defineEventHandler } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
import {
  getShopifyQueryCredentials,
  requireShopifyResourceId,
} from "~~/server/utils/shopify-admin-request";

export default defineEventHandler(async (event) => {
  const id = requireShopifyResourceId(event.context.params?.id, "Order");
  const { storeId, token } = getShopifyQueryCredentials(event);

  await callShopifyApi<Record<string, never>>({
    event,
    storeId,
    token,
    path: `/orders/${id}.json`,
    method: "DELETE",
  });

  return { success: true };
});
