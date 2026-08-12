import { defineEventHandler, readBody } from "h3";
import { createApiErrorFromMessage } from "~~/server/utils/callShopifyApi";
import { fetchShopifyPaymentsDisputes } from "~~/server/utils/shopify-payments-graphql";
import type { ShopifyPaymentsDisputeFilters } from "~~/types/shopify-payments-graphql";

interface DisputesBody {
  storeId?: string;
  token?: string;
  filters?: ShopifyPaymentsDisputeFilters;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<DisputesBody>(event)) || {};
  const storeId = String(body.storeId || "");
  const token = String(body.token || "");

  if (!storeId || !token) {
    throw createApiErrorFromMessage("Store ID and Access Token are required.", 400);
  }

  const disputes = await fetchShopifyPaymentsDisputes(
    { event, storeId, token },
    body.filters || {},
  );
  return { disputes };
});
