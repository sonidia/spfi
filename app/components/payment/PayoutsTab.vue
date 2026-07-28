<template>
  <div class="payouts-tab">
    <table>
      <thead>
        <tr>
          <th>Payout Date</th>
          <th>Status</th>
          <th>Transaction date</th>
          <th class="right">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="payout in filteredPayouts"
          :key="payout.id"
          @click="openPayoutDetail(payout.id)"
        >
          <td class="td-date">{{ fmtDate(payout.date) }}</td>
          <td>
            <span
              class="badge"
              :class="payout.status === 'paid' ? 'badge-paid' : ''"
            >
              {{
                payout.status === "paid"
                  ? "Deposited"
                  : capitalize(payout.status)
              }}
            </span>
          </td>
          <td class="td-date">
            {{ getPayoutProcessedDate(payout.id) }}
          </td>
          <td class="right td-net">
            ${{ parseFloat(payout.amount).toFixed(2) }}
            {{ payout.currency }}
          </td>
        </tr>
      </tbody>
    </table>
    <div v-if="filteredPayouts.length === 0" class="empty">
      No payouts found.
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { usePaymentStore } from "~/stores/payment";
import { capitalize, fmtDate } from "~~/helpers";

const props = defineProps<{
  filter: "all" | "paid" | "in_transit";
}>();

const paymentStore = usePaymentStore();
const router = useRouter();

const filteredPayouts = computed(() =>
  paymentStore.payouts.filter(
    (p) => props.filter === "all" || p.status === props.filter,
  ),
);

function getPayoutProcessedDate(payoutId: number) {
  const txs = paymentStore.transactionsByPayout[String(payoutId)] || [];
  const payoutTx = txs.find((tx) => tx.type === "charge");
  return payoutTx ? fmtDate(payoutTx.processed_at) : "—";
}

function openPayoutDetail(payoutId: number) {
  router.push(`/payment/payout/${payoutId}`);
}
</script>

<style scoped>
.td-date {
  color: var(--text-secondary);
  white-space: nowrap;
}
.td-net {
  color: var(--text-primary);
  font-weight: 600;
}
</style>
