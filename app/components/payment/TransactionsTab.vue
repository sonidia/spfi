<template>
  <div class="transactions-tab">
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Payout date</th>
          <th>Payout status</th>
          <th>Order</th>
          <th>Type</th>
          <th>Payment</th>
          <th class="right">Amount</th>
          <th class="right">Fee</th>
          <th class="right">Net</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="tx in paymentStore.balanceTransactions" :key="tx.id">
          <td class="td-date">{{ fmtDate(tx.processed_at) }}</td>
          <td class="td-date">
            <NuxtLink
              v-if="tx.payout_id"
              :to="`/payment/payout/${tx.payout_id}`"
              class="link"
            >
              {{ getPayoutDate(tx) }}
            </NuxtLink>
            <span v-else>{{ getPayoutDate(tx) }}</span>
          </td>
          <td>
            <span
              class="badge"
              :class="
                tx.payout_status === 'paid'
                  ? 'badge-deposited'
                  : tx.payout_status === 'in_transit'
                    ? 'badge-in-transit'
                    : 'badge-pending'
              "
            >
              {{
                tx.payout_status === "paid"
                  ? "Deposited"
                  : capitalize(tx.payout_status)
              }}
            </span>
          </td>
          <td class="td-order">
            <NuxtLink
              v-if="getOrderNumber(tx)"
              class="link"
              :to="`/order/${getOrderNumber(tx)}`"
            >
              #{{ getOrderNumber(tx) }}
            </NuxtLink>
            <span v-else>—</span>
          </td>
          <td class="td-type">{{ capitalize(tx.type) }}</td>
          <td>
            <span class="payment-method">
              <span class="card-brand" v-if="tx.type === 'charge'">Visa</span>
              <span v-else>—</span>
            </span>
          </td>
          <td class="right td-amount">
            ${{ Math.abs(parseFloat(tx.amount)).toFixed(2) }}
            <span class="chevron-sm">▾</span>
          </td>
          <td class="right td-fee">
            <template v-if="parseFloat(tx.fee)">
              -${{ parseFloat(tx.fee).toFixed(2) }}
              <span class="chevron-sm">▾</span>
            </template>
            <template v-else>—</template>
          </td>
          <td class="right td-net" style="font-weight: 700">
            ${{ Math.abs(parseFloat(tx.net)).toFixed(2) }}
            <span style="font-weight: normal; font-size: 11px">USD</span>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-if="paymentStore.balanceTransactions.length === 0" class="empty">
      No balance transactions found.
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { usePaymentStore } from "~/stores/payment";
import {
  addBusinessDays,
  businessDaysBetween,
  capitalize,
  fmtDate,
} from "~~/helpers";

const paymentStore = usePaymentStore();

const businessDaysOffset = computed(() => {
  const transactionsWithPayout = paymentStore.balanceTransactions
    .filter((tx) => tx.payout_id)
    .sort(
      (a, b) =>
        new Date(a.processed_at).getTime() - new Date(b.processed_at).getTime(),
    );

  if (transactionsWithPayout.length === 0) return 0;

  const oldestTx = transactionsWithPayout[0];
  const payout = paymentStore.payouts.find((p) => p.id === oldestTx.payout_id);
  if (!payout) return 0;

  return businessDaysBetween(
    new Date(oldestTx.processed_at),
    new Date(payout.date),
  );
});

function getPayoutDate(tx: any) {
  // 1. Direct lookup from API data
  if (tx.payout_id) {
    const payout = paymentStore.payouts.find((p: any) => p.id === tx.payout_id);
    if (payout) {
      return fmtDate(payout.date);
    }
  }

  // 2. Prediction using business day offset
  if (businessDaysOffset.value > 0) {
    const predictedDate = addBusinessDays(
      new Date(tx.processed_at),
      businessDaysOffset.value,
    );
    return fmtDate(predictedDate.toISOString().split("T")[0] || "");
  }

  // 3. Fallback for paid transactions if no offset
  if (tx.payout_status === "paid") {
    return fmtDate(tx.processed_at);
  }
  return "Pending...";
}

function getOrderNumber(tx: any) {
  if (!tx.source_order_id) return null;
  // Note: orderMap was empty in index.vue, keeping logic same
  const orderMap: Record<number, string> = {};
  return orderMap[tx.source_order_id] || tx.source_order_id;
}
</script>

<style scoped>
.td-date {
  color: var(--text-secondary);
  white-space: nowrap;
}
.td-order a, .link {
  color: var(--blue);
  font-weight: 500;
  text-decoration: none;
}
.td-order a:hover, .link:hover {
  text-decoration: underline;
}
.td-type {
  color: var(--text-primary);
}
.payment-method {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.card-brand {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #3535ff;
  color: white !important;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: -0.3px;
  padding: 2px 5px;
  border-radius: 3px;
  text-transform: uppercase;
}
.td-amount {
  color: var(--text-primary);
  font-weight: 500;
}
.td-fee {
  color: var(--red);
  font-weight: 500;
}
.td-net {
  color: var(--text-primary);
  font-weight: 600;
}
.chevron-sm {
  color: var(--text-muted);
  font-weight: 400;
  font-size: 12px;
  margin-left: 2px;
}
</style>
