import { defineEventHandler, readBody } from "h3";
import {
  callShopifyApi,
  createApiErrorFromMessage,
} from "~~/server/utils/callShopifyApi";
import type {
  BalanceTransactionsResponse,
  PaymentsOverviewResponse,
  ShopifyBalance,
  ShopifyBalanceTransaction,
  ShopifyPayout,
} from "~~/types/shopify";

interface PaymentAllBody {
  storeId?: string;
  token?: string;
}

interface BalanceResponse {
  balance?: ShopifyBalance | ShopifyBalance[];
}

interface PayoutsResponse {
  payouts?: ShopifyPayout[];
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<PaymentAllBody>(event)) || {};
  const storeId = String(body.storeId || "");
  const token = String(body.token || "");

  if (!storeId || !token) {
    throw createApiErrorFromMessage("Store ID and Access Token are required.", 400);
  }

  const [balanceRes, payoutsRes] = await Promise.all([
    callShopifyApi<BalanceResponse>({
      event,
      storeId,
      token,
      path: "/shopify_payments/balance.json",
    }),
    callShopifyApi<PayoutsResponse>({
      event,
      storeId,
      token,
      path: "/shopify_payments/payouts.json",
    }),
  ]);

  const payouts = payoutsRes.payouts ?? [];
  const txResults = await Promise.all(
    payouts.map(async (payout) => {
      const response = await callShopifyApi<BalanceTransactionsResponse>({
        event,
        storeId,
        token,
        path: "/shopify_payments/balance/transactions.json",
        params: { payout_id: payout.id },
      });

      return { payoutId: payout.id, transactions: response.transactions ?? [] };
    }),
  );

  const transactionsByPayout: Record<string, ShopifyBalanceTransaction[]> = {};
  for (const { payoutId, transactions } of txResults) {
    transactionsByPayout[String(payoutId)] = transactions;
  }

  return {
    balance: balanceRes.balance ?? null,
    payouts,
    transactionsByPayout,
  } satisfies PaymentsOverviewResponse;
});
