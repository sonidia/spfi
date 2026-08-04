<template>
  <div class="transactions-tab">
    <table>
      <thead>
        <tr>
          <th>Processed at</th>
          <th>Payout date</th>
          <th>Payout status</th>
          <th>Latest order</th>
          <th>Latest customer</th>
          <th>Type</th>
          <th>Payment</th>
          <th class="right">Amount</th>
          <th class="right">Fee</th>
          <th class="right">Net</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="payout in sortedPayouts" :key="payout.id">
          <tr class="payout-row" @click="togglePayout(payout.id)">
            <td class="td-date payout-cell">
              <button
                class="expand-btn"
                type="button"
                @click.stop="togglePayout(payout.id)"
              >
                {{ isExpanded(payout.id) ? "▾" : "▸" }}
              </button>
              <NuxtLink :to="`/store/payout/${payout.id}`" class="link">
                {{ payout.id }}
              </NuxtLink>
            </td>
            <td class="td-date">
              <span>
                {{ fmtDate(payout.date) }}
              </span>
            </td>
            <td>
              <span
                class="badge"
                :class="
                  payout.status === 'paid'
                    ? 'badge-deposited'
                    : payout.status === 'in_transit'
                      ? 'badge-in-transit'
                      : 'badge-pending'
                "
              >
                {{
                  payout.status === "paid"
                    ? "Deposited"
                    : capitalize(payout.status)
                }}
              </span>
            </td>
            <td class="td-order">
              <template v-if="!isExpanded(payout.id)">
                <NuxtLink
                  v-if="getLatestOrderNumber(payout.id)"
                  class="link"
                  :to="`/order/${getLatestOrderNumber(payout.id)}`"
                >
                  #{{ getLatestOrderNumber(payout.id) }}
                </NuxtLink>
                <span v-else>—</span>
              </template>
              <span v-else>—</span>
            </td>
            <td class="td-customer">
              <template v-if="!isExpanded(payout.id)">
                {{ getLatestCustomerName(payout.id) }}
              </template>
              <span v-else>—</span>
            </td>
            <td class="td-type">Payout</td>
            <td>
              <span class="payment-method">
                <template
                  v-if="
                    !isExpanded(payout.id) &&
                    getLatestTransactionForPayout(payout.id)?.type === 'charge'
                  "
                >
                  <span class="card-brand">Visa</span>
                </template>
                <span v-else>—</span>
              </span>
            </td>
            <td class="right td-amount">
              ${{ getPayoutAmount(payout).toFixed(2) }}
            </td>
            <td class="right td-fee">
              <template v-if="getPayoutFee(payout)">
                -${{ getPayoutFee(payout).toFixed(2) }}
              </template>
              <template v-else>—</template>
            </td>
            <td class="right td-net" style="font-weight: 700">
              ${{ Math.abs(parseFloat(payout.amount)).toFixed(2) }}
            </td>
          </tr>
          <tr
            v-for="tx in getChildTransactions(payout.id)"
            v-show="isExpanded(payout.id)"
            :key="tx.id"
            class="child-row"
          >
            <td class="td-date">{{ fmtDate(tx.processed_at) }}</td>
            <td class="td-date">
              <span v-if="tx.payout_id">
                {{ getPayoutDateById(tx.payout_id) }}
              </span>
              <span v-else>—</span>
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
            <td class="td-customer">{{ getCustomerName(tx) }}</td>
            <td class="td-type">{{ capitalize(tx.type) }}</td>
            <td>
              <span class="payment-method">
                <span class="card-brand" v-if="tx.type === 'charge'">Visa</span>
                <span v-else>—</span>
              </span>
            </td>
            <td class="right td-amount">
              ${{ Math.abs(parseFloat(tx.amount)).toFixed(2) }}
            </td>
            <td class="right td-fee">
              <template v-if="parseFloat(tx.fee)">
                -${{ parseFloat(tx.fee).toFixed(2) }}
              </template>
              <template v-else>—</template>
            </td>
            <td class="right td-net" style="font-weight: 700">
              ${{ Math.abs(parseFloat(tx.net)).toFixed(2) }}
            </td>
          </tr>
        </template>
      </tbody>
    </table>
    <div v-if="sortedPayouts.length === 0" class="empty">
      No balance transactions found.
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useOrderStore } from "~/stores/order";
import type { Payout, Transaction } from "~/stores/payment";
import { capitalize, fmtDate } from "~~/helpers";

const paymentStore = usePaymentStore();
const orderStore = useOrderStore();

const sortedPayouts = computed(() =>
  [...paymentStore.payouts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  ),
);

const expandedPayouts = ref<Record<number, boolean>>({});

watch(
  () => paymentStore.payouts,
  (payouts) => {
    payouts.forEach((payout) => {
      if (expandedPayouts.value[payout.id] === undefined) {
        expandedPayouts.value[payout.id] = false;
      }
    });
  },
  { immediate: true },
);

function togglePayout(payoutId: number) {
  expandedPayouts.value[payoutId] = !expandedPayouts.value[payoutId];
}

function isExpanded(payoutId: number) {
  return expandedPayouts.value[payoutId] ?? false;
}

function getPayoutDateById(payoutId: number | null) {
  if (!payoutId) return "—";
  const payout = paymentStore.payouts.find((p) => p.id === payoutId);
  return payout ? fmtDate(payout.date) : "—";
}

function getPayoutAmount(payout: Payout) {
  const amount = payout?.summary?.charges_gross_amount;
  return Math.abs(parseFloat(amount ?? payout.amount ?? "0"));
}

function getPayoutFee(payout: Payout) {
  const fee = payout?.summary?.charges_fee_amount;
  return Math.abs(parseFloat(fee ?? "0"));
}

function getChildTransactions(payoutId: number) {
  return (paymentStore.transactionsByPayout[String(payoutId)] || []).filter(
    (tx) => tx.type !== "payout",
  );
}

function getLatestTransactionForPayout(payoutId: number) {
  const transactions = getChildTransactions(payoutId).filter(
    (tx) => tx.source_order_id,
  );
  if (!transactions.length) return null;
  return transactions.sort(
    (a, b) =>
      new Date(b.processed_at).getTime() - new Date(a.processed_at).getTime(),
  )[0];
}

function getLatestOrderNumber(payoutId: number) {
  const tx = getLatestTransactionForPayout(payoutId);
  return tx ? getOrderNumber(tx) : null;
}

function getLatestCustomerName(payoutId: number) {
  const tx = getLatestTransactionForPayout(payoutId);
  if (!tx) return "—";
  return getCustomerName(tx);
}

function getOrderNumber(tx: Transaction) {
  if (!tx.source_order_id) return null;
  // Note: orderMap was empty in index.vue, keeping logic same
  const orderMap: Record<number, string> = {};
  return orderMap[tx.source_order_id] || tx.source_order_id;
}

function getCustomerName(tx: Transaction) {
  if (!tx.source_order_id) return "—";
  const order = orderStore.orders.find((o) => o.id === tx.source_order_id);
  if (order && order.customer) {
    return (
      `${order.customer.first_name || ""} ${order.customer.last_name || ""}`.trim() ||
      "—"
    );
  }
  return "—";
}
</script>

<style scoped>
.td-date {
  color: var(--text-secondary);
  white-space: nowrap;
}
.td-order a,
.link {
  color: var(--blue);
  font-weight: 500;
  text-decoration: none;
}
.td-customer {
  color: var(--text-primary);
  white-space: nowrap;
}
.td-order a:hover,
.link:hover {
  text-decoration: underline;
}
.td-type {
  color: var(--text-primary);
}
.payout-row {
  background: var(--surface-soft);
}
.payout-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}
.expand-btn {
  width: 18px;
  height: 18px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.payout-label {
  display: flex;
  flex-direction: column;
  font-weight: 600;
  color: var(--text-primary);
}
.payout-id {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}
.child-row td {
  background: var(--surface);
}
.child-row .td-date {
  color: var(--text-secondary);
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
  background: var(--blue);
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
td {
  text-align: center;
}
</style>
