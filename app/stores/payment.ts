import { defineStore } from "pinia";
import { ref } from "vue";

export interface Payout {
  id: number;
  status: string;
  date: string;
  currency: string;
  amount: string;
  summary: {
    adjustments_fee_amount: string;
    adjustments_gross_amount: string;
    charges_fee_amount: string;
    charges_gross_amount: string;
    refunds_fee_amount: string;
    refunds_gross_amount: string;
    reserved_funds_fee_amount: string;
    reserved_funds_gross_amount: string;
    retried_payouts_fee_amount: string;
    retried_payouts_gross_amount: string;
  };
}

export interface Transaction {
  id: number;
  type: string;
  test: boolean;
  payout_id: number;
  payout_status: string;
  currency: string;
  amount: string;
  fee: string;
  net: string;
  source_id: number;
  source_type: string;
  source_order_id: number | null;
  source_order_transaction_id: number | null;
  processed_at: string;
  adjustment_order_transactions: any;
  adjustment_reason: string | null;
}

export interface Balance {
  currency: string;
  amount: string;
  on_hold_amount?: string;
  pending_amount?: string;
}

export const usePaymentStore = defineStore("payment", () => {
  const balance = ref<Balance | null>(null);
  const payouts = ref<Payout[]>([]);
  // Individual full payout details cached by ID
  const payoutDetails = ref<Record<string, Payout>>({});
  // Map: payoutId → Transaction[]
  const transactionsByPayout = ref<Record<string, Transaction[]>>({});

  const balanceTransactions = ref<any[]>([]);
  const hasFetchedAll = ref(false);
  const hasFetchedBalanceTransactions = ref(false);

  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const storeCache = ref<
    Record<
      string,
      {
        balance: Balance | null;
        payouts: Payout[];
        payoutDetails: Record<string, Payout>;
        transactionsByPayout: Record<string, Transaction[]>;
        balanceTransactions: any[];
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
      const response = await $fetch<any>("/api/payment/all", {
        method: "POST",
        body: { storeId, token },
      });

      balance.value = response.balance || null;
      payouts.value = response.payouts || [];
      transactionsByPayout.value = response.transactionsByPayout || {};
      hasFetchedAll.value = true;
      rememberStore(storeId);
    } catch (err: any) {
      error.value =
        err?.data?.statusMessage ??
        err?.message ??
        "Failed to fetch payment data.";
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
      const res = await $fetch<any>("/api/payment/balance-transactions", {
        method: "POST",
        body: { storeId, token },
      });
      balanceTransactions.value = (res.transactions || []).filter(
        (t: any) => t.type !== "payout",
      );
      hasFetchedBalanceTransactions.value = true;
      rememberStore(storeId);
    } catch (err: any) {
      error.value = err.message || "Failed to load transactions";
    } finally {
      isLoading.value = false;
    }
  }

  /** Lấy transactions của một payout cụ thể */
  function getTransactionsForPayout(payoutId: number): Transaction[] {
    return transactionsByPayout.value[String(payoutId)] ?? [];
  }

  /** Fetch a single payout + its transactions (with cache) */
  async function fetchPayoutDetail(
    storeId: string,
    token: string,
    payoutId: number,
    force = false,
  ) {
    // Already have full payout cached? Skip fetch unless forced
    if (
      !force &&
      payoutDetails.value[String(payoutId)] &&
      transactionsByPayout.value[String(payoutId)]?.length
    )
      return;

    isLoading.value = true;
    error.value = null;

    try {
      const response = await $fetch<any>(`/api/payment/payout/${payoutId}`, {
        params: { storeId, token },
      });

      if (response.payout) {
        // Cache detailed version
        payoutDetails.value[String(payoutId)] = response.payout;

        // Also update lightweight list if present
        const listIndex = payouts.value.findIndex((p) => p.id === payoutId);
        if (listIndex > -1) {
          payouts.value[listIndex] = response.payout;
        } else {
          payouts.value = [response.payout, ...payouts.value];
        }
      }

      // Cache transactions
      transactionsByPayout.value[String(payoutId)] =
        response.transactions ?? [];

      rememberStore(storeId);
    } catch (err: any) {
      error.value =
        err?.data?.statusMessage ??
        err?.message ??
        "Failed to fetch payout detail.";
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
