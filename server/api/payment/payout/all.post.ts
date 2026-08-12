import { defineEventHandler, readBody } from "h3";
import {
  createApiErrorFromMessage,
} from "~~/server/utils/callShopifyApi";
import { callShopifyPaginatedApi } from "~~/server/utils/callShopifyPaginatedApi";
import { buildPayoutQueryParams } from "~~/server/utils/shopify-payment-query";
import type { PayoutsResponse } from "~~/types/shopify";
import type {
  ShopifyPayoutFilters,
} from "~~/types/shopify-payment";

interface PayoutAllBody {
  storeId?: string;
  token?: string;
  filters?: ShopifyPayoutFilters;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<PayoutAllBody>(event)) || {};
  const storeId = String(body.storeId || "");
  const token = String(body.token || "");

  if (!storeId || !token) {
    throw createApiErrorFromMessage("Store ID and Access Token are required.", 400);
  }

  const payouts = await callShopifyPaginatedApi<PayoutsResponse["payouts"][number]>({
    event,
    storeId,
    token,
    path: "/shopify_payments/payouts.json",
    resourceKey: "payouts",
    params: buildPayoutQueryParams(body.filters),
    missingProxyMessage: "Missing sock proxy for this store.",
    preserveUnsafeIntegers: true,
  });

  return {
    payouts,
  } satisfies PayoutsResponse;
});
