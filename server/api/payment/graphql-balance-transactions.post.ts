import { defineEventHandler, readBody } from "h3";
import { createApiErrorFromMessage } from "~~/server/utils/callShopifyApi";
import { fetchShopifyPaymentsBalanceTransactions } from "~~/server/utils/shopify-payments-graphql";
import type { ShopifyPaymentsBalanceTransactionSearchFilters } from "~~/types/shopify-payments-graphql";

interface GraphqlTransactionsBody {
  storeId?: string;
  token?: string;
  filters?: ShopifyPaymentsBalanceTransactionSearchFilters;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<GraphqlTransactionsBody>(event)) || {};
  const storeId = String(body.storeId || "");
  const token = String(body.token || "");

  if (!storeId || !token) {
    throw createApiErrorFromMessage(
      "Store ID and Access Token are required.",
      400,
    );
  }

  const transactions = await fetchShopifyPaymentsBalanceTransactions(
    { event, storeId, token },
    body.filters || {},
  );

  return { transactions };
});
