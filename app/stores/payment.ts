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
  // Map: payoutId → Transaction[]
  const transactionsByPayout = ref<Record<string, Transaction[]>>({});

  const isLoading = ref(false);
  const error = ref<string | null>(null);

  async function fetchAll(storeId: string, token: string) {
    if (!storeId || !token) {
      error.value = "Store ID and Access Token are required.";
      return;
    }

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
    } catch (err: any) {
      error.value =
        err?.data?.statusMessage ??
        err?.message ??
        "Failed to fetch payment data.";
    } finally {
      isLoading.value = false;
    }
  }

  /** Lấy transactions của một payout cụ thể */
  function getTransactionsForPayout(payoutId: number): Transaction[] {
    return transactionsByPayout.value[String(payoutId)] ?? [];
  }

  function $reset() {
    balance.value = null;
    payouts.value = [];
    transactionsByPayout.value = {};
    error.value = null;
    isLoading.value = false;
  }

  return {
    balance,
    payouts,
    transactionsByPayout,
    isLoading,
    error,
    fetchAll,
    getTransactionsForPayout,
    $reset,
  };
});
