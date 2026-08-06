import { defineEventHandler, readBody } from "h3";
import {
  callShopifyApi,
  createApiErrorFromMessage,
} from "~~/server/utils/callShopifyApi";
import { callShopifyPaginatedApi } from "~~/server/utils/callShopifyPaginatedApi";
import { groupTransactionsByPayout } from "~~/server/utils/shopify-payment-query";
import type {
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

export default defineEventHandler(async (event) => {
  const body = (await readBody<PaymentAllBody>(event)) || {};
  const storeId = String(body.storeId || "");
  const token = String(body.token || "");

  if (!storeId || !token) {
    throw createApiErrorFromMessage("Store ID and Access Token are required.", 400);
  }

  const [balanceRes, payouts, balanceTransactions] = await Promise.all([
    callShopifyApi<BalanceResponse>({
      event,
      storeId,
      token,
      path: "/shopify_payments/balance.json",
    }),
    callShopifyPaginatedApi<ShopifyPayout>({
      event,
      storeId,
      token,
      path: "/shopify_payments/payouts.json",
      resourceKey: "payouts",
    }),
    callShopifyPaginatedApi<ShopifyBalanceTransaction>({
      event,
      storeId,
      token,
      path: "/shopify_payments/balance/transactions.json",
      resourceKey: "transactions",
    }),
  ]);

  return {
    balance: balanceRes.balance ?? null,
    payouts,
    balanceTransactions,
    transactionsByPayout: groupTransactionsByPayout(balanceTransactions),
  } satisfies PaymentsOverviewResponse;
});
