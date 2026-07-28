import { createError, defineEventHandler, readBody } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
import type { BalanceTransactionsResponse } from "~~/types/shopify";

interface BalanceTransactionsBody {
  storeId?: string;
  token?: string;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<BalanceTransactionsBody>(event)) || {};
  const storeId = String(body.storeId || "");
  const token = String(body.token || "");

  if (!storeId || !token) {
    throw createError({
      statusCode: 400,
      statusMessage: "Store ID and Access Token are required.",
    });
  }

  const response = await callShopifyApi<BalanceTransactionsResponse>({
    event,
    storeId,
    token,
    path: "/shopify_payments/balance/transactions.json",
    missingProxyMessage: "Missing sock proxy for this store.",
  });

  return {
    transactions: response.transactions ?? [],
  } satisfies BalanceTransactionsResponse;
});
