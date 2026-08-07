import { defineStore } from "pinia";
import { ref } from "vue";
import type {
  PaymentsOverviewResponse,
  PayoutDetailResponse,
  ShopifyBalance,
  ShopifyBalanceTransaction,
  ShopifyPayout,
} from "~~/types/shopify";
import type {
  ShopifyBalanceTransactionFilters,
  ShopifyPayoutFilters,
} from "~~/types/shopify-payment";
import type {
  ShopifyPaymentsAccount,
  ShopifyPaymentsAccountResponse,
  ShopifyPaymentsBalanceTransactionSearchFilters,
  ShopifyPaymentsDispute,
  ShopifyPaymentsDisputeFilters,
  ShopifyPaymentsDisputesResponse,
  ShopifyPaymentsGraphqlTransactionsResponse,
  ShopifyPaymentsPayoutMetadata,
} from "~~/types/shopify-payments-graphql";
import { getAppErrorMessage } from "~~/utils/error";

export type Payout = ShopifyPayout;
export type Transaction = ShopifyBalanceTransaction;
export type Balance = ShopifyBalance;

export const usePaymentStore = defineStore("payment", () => {
  const balance = ref<Balance | Balance[] | null>(null);
  const payouts = ref<Payout[]>([]);
  const visiblePayouts = ref<Payout[]>([]);
  const payoutDetails = ref<Record<string, Payout>>({});
  const paymentsAccount = ref<ShopifyPaymentsAccount | null>(null);
  const payoutMetadata = ref<Record<string, ShopifyPaymentsPayoutMetadata>>({});
  const transactionsByPayout = ref<Record<string, Transaction[]>>({});

  const balanceTransactions = ref<Transaction[]>([]);
  const visibleBalanceTransactions = ref<Transaction[]>([]);
  const disputes = ref<ShopifyPaymentsDispute[]>([]);
  const visibleDisputes = ref<ShopifyPaymentsDispute[]>([]);
  const hasFetchedAll = ref(false);
  const hasFetchedBalanceTransactions = ref(false);
  const hasFetchedDisputes = ref(false);

  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const graphqlWarning = ref<string | null>(null);

  const storeCache = ref<
    Record<
      string,
      {
        balance: Balance | Balance[] | null;
        payouts: Payout[];
        visiblePayouts: Payout[];
        payoutDetails: Record<string, Payout>;
        paymentsAccount: ShopifyPaymentsAccount | null;
        payoutMetadata: Record<string, ShopifyPaymentsPayoutMetadata>;
        transactionsByPayout: Record<string, Transaction[]>;
        balanceTransactions: Transaction[];
        visibleBalanceTransactions: Transaction[];
        disputes: ShopifyPaymentsDispute[];
        visibleDisputes: ShopifyPaymentsDispute[];
        hasFetchedAll: boolean;
        hasFetchedBalanceTransactions: boolean;
        hasFetchedDisputes: boolean;
        graphqlWarning: string | null;
      }
    >
  >({});

  function rememberStore(storeId: string) {
    storeCache.value[storeId] = {
      balance: balance.value,
      payouts: [...payouts.value],
      visiblePayouts: [...visiblePayouts.value],
      payoutDetails: { ...payoutDetails.value },
      paymentsAccount: paymentsAccount.value,
      payoutMetadata: { ...payoutMetadata.value },
      transactionsByPayout: { ...transactionsByPayout.value },
      balanceTransactions: [...balanceTransactions.value],
      visibleBalanceTransactions: [...visibleBalanceTransactions.value],
      disputes: [...disputes.value],
      visibleDisputes: [...visibleDisputes.value],
      hasFetchedAll: hasFetchedAll.value,
      hasFetchedBalanceTransactions: hasFetchedBalanceTransactions.value,
      hasFetchedDisputes: hasFetchedDisputes.value,
      graphqlWarning: graphqlWarning.value,
    };
  }

  async function fetchAll(storeId: string, token: string, force = false) {
    if (!storeId || !token) {
      error.value = "Store ID and Access Token are required.";
      return;
    }

    if (!force && hasFetchedAll.value) return;

    isLoading.value = true;
    error.value = null;
    graphqlWarning.value = null;

    try {
      const [overviewResult, accountResult, graphqlTransactionsResult] =
        await Promise.allSettled([
          $fetch<PaymentsOverviewResponse>("/api/payment/all", {
            method: "POST",
            body: { storeId, token },
          }),
          $fetch<ShopifyPaymentsAccountResponse>("/api/payment/account", {
            method: "POST",
            body: { storeId, token },
          }),
          $fetch<ShopifyPaymentsGraphqlTransactionsResponse>(
            "/api/payment/graphql-balance-transactions",
            {
              method: "POST",
              body: { storeId, token, filters: {} },
            },
          ),
        ]);

      if (overviewResult.status === "rejected") throw overviewResult.reason;
      const response = overviewResult.value;

      payouts.value = response.payouts || [];
      visiblePayouts.value = [...payouts.value];
      const restTransactions = (response.balanceTransactions || []).filter(
        (transaction) => transaction.type !== "payout",
      );

      if (accountResult.status === "fulfilled") {
        applyPaymentsAccountResponse(accountResult.value);
      } else {
        balance.value = response.balance || null;
      }

      const preferredTransactions =
        graphqlTransactionsResult.status === "fulfilled"
          ? graphqlTransactionsResult.value.transactions
          : restTransactions;
      balanceTransactions.value = preferredTransactions.filter(
        (transaction) => transaction.type !== "payout",
      );
      visibleBalanceTransactions.value = [...balanceTransactions.value];
      transactionsByPayout.value = groupByPayout(
        graphqlTransactionsResult.status === "fulfilled"
          ? graphqlTransactionsResult.value.transactions
          : response.balanceTransactions || [],
      );

      const warnings: string[] = [];
      if (accountResult.status === "rejected") {
        warnings.push(
          getAppErrorMessage(
            accountResult.reason,
            "Shopify Payments account details are unavailable.",
          ),
        );
      }
      if (graphqlTransactionsResult.status === "rejected") {
        warnings.push(
          getAppErrorMessage(
            graphqlTransactionsResult.reason,
            "GraphQL transaction enrichment is unavailable; showing REST data.",
          ),
        );
      }
      graphqlWarning.value = warnings.length ? warnings.join(" ") : null;

      hasFetchedAll.value = true;
      hasFetchedBalanceTransactions.value = true;
      rememberStore(storeId);
    } catch (err) {
      error.value = getAppErrorMessage(err, "Failed to fetch payment data.");
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchPaymentsAccount(
    storeId: string,
    token: string,
    force = false,
  ) {
    if (!storeId || !token) {
      error.value = "Store ID and Access Token are required.";
      return;
    }
    if (!force && paymentsAccount.value) return;

    try {
      const response = await $fetch<ShopifyPaymentsAccountResponse>(
        "/api/payment/account",
        {
          method: "POST",
          body: { storeId, token },
        },
      );
      applyPaymentsAccountResponse(response);
      graphqlWarning.value = null;
      rememberStore(storeId);
    } catch (err) {
      graphqlWarning.value = getAppErrorMessage(
        err,
        "Shopify Payments account details are unavailable.",
      );
    }
  }

  async function fetchGraphqlBalanceTransactions(
    storeId: string,
    token: string,
    filters: ShopifyPaymentsBalanceTransactionSearchFilters = {},
  ) {
    if (!storeId || !token) {
      error.value = "Store ID and Access Token are required.";
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const response =
        await $fetch<ShopifyPaymentsGraphqlTransactionsResponse>(
          "/api/payment/graphql-balance-transactions",
          {
            method: "POST",
            body: { storeId, token, filters },
          },
        );
      visibleBalanceTransactions.value = response.transactions || [];
      if (!hasActiveFilters(filters)) {
        balanceTransactions.value = [...visibleBalanceTransactions.value];
        transactionsByPayout.value = groupByPayout(
          visibleBalanceTransactions.value,
        );
      }
      hasFetchedBalanceTransactions.value = true;
      graphqlWarning.value = null;
      rememberStore(storeId);
    } catch (err) {
      error.value = getAppErrorMessage(
        err,
        "Failed to load Shopify Payments transactions.",
      );
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchDisputes(
    storeId: string,
    token: string,
    filters: ShopifyPaymentsDisputeFilters = {},
  ) {
    if (!storeId || !token) {
      error.value = "Store ID and Access Token are required.";
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const response = await $fetch<ShopifyPaymentsDisputesResponse>(
        "/api/payment/dispute/all",
        {
          method: "POST",
          body: { storeId, token, filters },
        },
      );
      visibleDisputes.value = response.disputes || [];
      if (!hasActiveFilters(filters)) {
        disputes.value = [...visibleDisputes.value];
      }
      hasFetchedDisputes.value = true;
      rememberStore(storeId);
    } catch (err) {
      error.value = getAppErrorMessage(
        err,
        "Failed to load Shopify Payments disputes.",
      );
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchBalanceTransactions(
    storeId: string,
    token: string,
    force = false,
    filters: ShopifyBalanceTransactionFilters = {},
  ) {
    if (!storeId || !token) {
      error.value = "Store ID and Access Token are required.";
      return;
    }

    if (!force && hasFetchedBalanceTransactions.value) return;

    isLoading.value = true;
    error.value = null;

    try {
      const res = await $fetch<{ transactions?: Transaction[] }>(
        "/api/payment/balance-transactions",
        {
          method: "POST",
          body: { storeId, token, filters },
        },
      );
      const transactions = (res.transactions || []).filter(
        (transaction) => transaction.type !== "payout",
      );
      visibleBalanceTransactions.value = transactions;
      if (!hasActiveFilters(filters)) {
        balanceTransactions.value = transactions;
        transactionsByPayout.value = groupByPayout(res.transactions || []);
      }
      hasFetchedBalanceTransactions.value = true;
      rememberStore(storeId);
    } catch (err) {
      error.value = getAppErrorMessage(err, "Failed to load transactions");
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchPayouts(
    storeId: string,
    token: string,
    filters: ShopifyPayoutFilters = {},
  ) {
    if (!storeId || !token) {
      error.value = "Store ID and Access Token are required.";
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const response = await $fetch<{ payouts?: Payout[] }>(
        "/api/payment/payout/all",
        {
          method: "POST",
          body: { storeId, token, filters },
        },
      );
      visiblePayouts.value = response.payouts || [];
      if (!hasActiveFilters(filters)) {
        payouts.value = [...visiblePayouts.value];
      }
      rememberStore(storeId);
    } catch (err) {
      error.value = getAppErrorMessage(err, "Failed to load payouts.");
    } finally {
      isLoading.value = false;
    }
  }

  function getTransactionsForPayout(payoutId: number): Transaction[] {
    return transactionsByPayout.value[String(payoutId)] ?? [];
  }

  async function fetchPayoutDetail(
    storeId: string,
    token: string,
    payoutId: number,
    force = false,
  ) {
    if (
      !force &&
      payoutDetails.value[String(payoutId)] &&
      transactionsByPayout.value[String(payoutId)]?.length
    ) {
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const response = await $fetch<PayoutDetailResponse>(
        `/api/payment/payout/${payoutId}`,
        {
          params: { storeId, token },
        },
      );

      if (response.payout) {
        payoutDetails.value[String(payoutId)] = response.payout;

        const listIndex = payouts.value.findIndex((payout) => payout.id === payoutId);
        if (listIndex > -1) {
          payouts.value[listIndex] = response.payout;
        } else {
          payouts.value = [response.payout, ...payouts.value];
        }
      }

      const enrichedById = new Map(
        balanceTransactions.value.map((transaction) => [
          String(transaction.id),
          transaction,
        ]),
      );
      transactionsByPayout.value[String(payoutId)] = (
        response.transactions ?? []
      ).map((transaction) => {
        const enriched = enrichedById.get(String(transaction.id));
        return enriched
          ? {
              ...transaction,
              source_order_name:
                enriched.source_order_name || transaction.source_order_name,
            }
          : transaction;
      });

      rememberStore(storeId);
    } catch (err) {
      error.value = getAppErrorMessage(err, "Failed to fetch payout detail.");
    } finally {
      isLoading.value = false;
    }
  }

  function hydrate(storeId: string): boolean {
    const cached = storeCache.value[storeId];
    if (!cached) return false;
    balance.value = cached.balance;
    payouts.value = [...cached.payouts];
    visiblePayouts.value = [
      ...(cached.visiblePayouts || cached.payouts),
    ];
    payoutDetails.value = { ...cached.payoutDetails };
    paymentsAccount.value = cached.paymentsAccount || null;
    payoutMetadata.value = { ...(cached.payoutMetadata || {}) };
    transactionsByPayout.value = { ...cached.transactionsByPayout };
    balanceTransactions.value = [...cached.balanceTransactions];
    visibleBalanceTransactions.value = [
      ...(cached.visibleBalanceTransactions || cached.balanceTransactions),
    ];
    disputes.value = [...(cached.disputes || [])];
    visibleDisputes.value = [
      ...(cached.visibleDisputes || cached.disputes || []),
    ];
    hasFetchedAll.value = cached.hasFetchedAll;
    hasFetchedBalanceTransactions.value =
      cached.hasFetchedBalanceTransactions;
    hasFetchedDisputes.value = cached.hasFetchedDisputes || false;
    graphqlWarning.value = cached.graphqlWarning || null;
    error.value = null;
    return true;
  }

  function $reset() {
    balance.value = null;
    payouts.value = [];
    visiblePayouts.value = [];
    payoutDetails.value = {};
    paymentsAccount.value = null;
    payoutMetadata.value = {};
    transactionsByPayout.value = {};
    balanceTransactions.value = [];
    visibleBalanceTransactions.value = [];
    disputes.value = [];
    visibleDisputes.value = [];
    hasFetchedAll.value = false;
    hasFetchedBalanceTransactions.value = false;
    hasFetchedDisputes.value = false;
    error.value = null;
    graphqlWarning.value = null;
    isLoading.value = false;
  }

  function hasActiveFilters(filters: object) {
    return Object.values(filters).some(
      (value) => value !== undefined && value !== null && value !== "",
    );
  }

  function groupByPayout(transactions: Transaction[]) {
    const grouped: Record<string, Transaction[]> = {};
    for (const transaction of transactions) {
      if (transaction.payout_id === null) continue;
      (grouped[String(transaction.payout_id)] ||= []).push(transaction);
    }
    return grouped;
  }

  function applyPaymentsAccountResponse(
    response: ShopifyPaymentsAccountResponse,
  ) {
    paymentsAccount.value = response.account;
    payoutMetadata.value = Object.fromEntries(
      (response.payouts || []).map((payout) => [
        String(payout.legacyResourceId),
        payout,
      ]),
    );
    if (response.account?.balance.length) {
      balance.value = response.account.balance.map((money) => ({
        amount: money.amount,
        currency: money.currencyCode,
      }));
    }
  }

  return {
    balance,
    payouts,
    visiblePayouts,
    payoutDetails,
    paymentsAccount,
    payoutMetadata,
    transactionsByPayout,
    balanceTransactions,
    visibleBalanceTransactions,
    disputes,
    visibleDisputes,
    hasFetchedAll,
    hasFetchedBalanceTransactions,
    hasFetchedDisputes,
    isLoading,
    error,
    graphqlWarning,
    fetchAll,
    fetchPayouts,
    fetchBalanceTransactions,
    fetchGraphqlBalanceTransactions,
    fetchPaymentsAccount,
    fetchDisputes,
    fetchPayoutDetail,
    getTransactionsForPayout,
    hydrate,
    $reset,
  };
});
