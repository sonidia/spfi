import { defineStore } from "pinia";
import { ref } from "vue";
import type {
  PaymentsOverviewResponse,
  PayoutDetailResponse,
  ShopifyBalance,
  ShopifyBalanceTransaction,
  ShopifyPayout,
} from "~~/types/shopify";
import { getAppErrorMessage } from "~~/utils/error";

export type Payout = ShopifyPayout;
export type Transaction = ShopifyBalanceTransaction;
export type Balance = ShopifyBalance;

export const usePaymentStore = defineStore("payment", () => {
  const balance = ref<Balance | Balance[] | null>(null);
  const payouts = ref<Payout[]>([]);
  const payoutDetails = ref<Record<string, Payout>>({});
  const transactionsByPayout = ref<Record<string, Transaction[]>>({});

  const balanceTransactions = ref<Transaction[]>([]);
  const hasFetchedAll = ref(false);
  const hasFetchedBalanceTransactions = ref(false);

  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const storeCache = ref<
    Record<
      string,
      {
        balance: Balance | Balance[] | null;
        payouts: Payout[];
        payoutDetails: Record<string, Payout>;
        transactionsByPayout: Record<string, Transaction[]>;
        balanceTransactions: Transaction[];
        hasFetchedAll: boolean;
        hasFetchedBalanceTransactions: boolean;
      }
    >
  >({});

  function rememberStore(storeId: string) {
    storeCache.value[storeId] = {
      balance: balance.value,
      payouts: [...payouts.value],
      payoutDetails: { ...payoutDetails.value },
      transactionsByPayout: { ...transactionsByPayout.value },
      balanceTransactions: [...balanceTransactions.value],
      hasFetchedAll: hasFetchedAll.value,
      hasFetchedBalanceTransactions: hasFetchedBalanceTransactions.value,
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

    try {
      const response = await $fetch<PaymentsOverviewResponse>("/api/payment/all", {
        method: "POST",
        body: { storeId, token },
      });

      balance.value = response.balance || null;
      payouts.value = response.payouts || [];
      transactionsByPayout.value = response.transactionsByPayout || {};
      hasFetchedAll.value = true;
      rememberStore(storeId);
    } catch (err) {
      error.value = getAppErrorMessage(err, "Failed to fetch payment data.");
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchBalanceTransactions(
    storeId: string,
    token: string,
    force = false,
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
          body: { storeId, token },
        },
      );
      balanceTransactions.value = (res.transactions || []).filter(
        (transaction) => transaction.type !== "payout",
      );
      hasFetchedBalanceTransactions.value = true;
      rememberStore(storeId);
    } catch (err) {
      error.value = getAppErrorMessage(err, "Failed to load transactions");
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

      transactionsByPayout.value[String(payoutId)] = response.transactions ?? [];

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
    payoutDetails.value = { ...cached.payoutDetails };
    transactionsByPayout.value = { ...cached.transactionsByPayout };
    balanceTransactions.value = [...cached.balanceTransactions];
    hasFetchedAll.value = cached.hasFetchedAll;
    hasFetchedBalanceTransactions.value =
      cached.hasFetchedBalanceTransactions;
    error.value = null;
    return true;
  }

  function $reset() {
    balance.value = null;
    payouts.value = [];
    payoutDetails.value = {};
    transactionsByPayout.value = {};
    balanceTransactions.value = [];
    hasFetchedAll.value = false;
    hasFetchedBalanceTransactions.value = false;
    error.value = null;
    isLoading.value = false;
  }

  return {
    balance,
    payouts,
    payoutDetails,
    transactionsByPayout,
    balanceTransactions,
    hasFetchedAll,
    hasFetchedBalanceTransactions,
    isLoading,
    error,
    fetchAll,
    fetchBalanceTransactions,
    fetchPayoutDetail,
    getTransactionsForPayout,
    hydrate,
    $reset,
  };
});
