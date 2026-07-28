import { defineEventHandler, getQuery } from "h3";
import {
  callShopifyApi,
  createApiErrorFromMessage,
} from "~~/server/utils/callShopifyApi";
import type {
  BalanceTransactionsResponse,
  PayoutDetailResponse,
  ShopifyPayout,
} from "~~/types/shopify";

interface PayoutResponse {
  payout?: ShopifyPayout;
}

export default defineEventHandler(async (event) => {
  const payoutId = event.context.params?.id;
  const query = getQuery(event);
  const storeId = String(query.storeId || "");
  const token = String(query.token || "");

  if (!storeId || !token || !payoutId) {
    throw createApiErrorFromMessage("storeId, token and payout id are required.", 400);
  }

  const [payoutRes, txRes] = await Promise.all([
    callShopifyApi<PayoutResponse>({
      event,
      storeId,
      token,
      path: `/shopify_payments/payouts/${payoutId}.json`,
    }),
    callShopifyApi<BalanceTransactionsResponse>({
      event,
      storeId,
      token,
      path: "/shopify_payments/balance/transactions.json",
      params: { payout_id: payoutId },
    }),
  ]);

  return {
    payout: payoutRes.payout ?? null,
    transactions: txRes.transactions ?? [],
  } satisfies PayoutDetailResponse;
});
