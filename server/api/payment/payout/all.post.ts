import { defineEventHandler, readBody } from "h3";
import {
  callShopifyApi,
  createApiErrorFromMessage,
} from "~~/server/utils/callShopifyApi";
import type { PayoutsResponse } from "~~/types/shopify";

interface PayoutAllBody {
  storeId?: string;
  token?: string;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<PayoutAllBody>(event)) || {};
  const storeId = String(body.storeId || "");
  const token = String(body.token || "");

  if (!storeId || !token) {
    throw createApiErrorFromMessage("Store ID and Access Token are required.", 400);
  }

  const response = await callShopifyApi<PayoutsResponse>({
    event,
    storeId,
    token,
    path: "/shopify_payments/payouts.json",
    missingProxyMessage: "Missing sock proxy for this store.",
  });

  return {
    payouts: response.payouts ?? [],
  } satisfies PayoutsResponse;
});
