<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { usePaymentStore } from "~/stores/payment";
import type {
  ShopifyPayoutFilters,
  ShopifyPayoutStatus,
} from "~~/types/shopify-payment";
import { capitalize, fmtDate } from "~~/helpers";

const paymentStore = usePaymentStore();
const router = useRouter();
const { storeId, token, isReady } = useActiveShopAuth();

const status = ref<"" | ShopifyPayoutStatus>("");
const date = ref("");
const dateMin = ref("");
const dateMax = ref("");
const sinceId = ref("");
const lastId = ref("");
const currentPage = ref(1);
const pageSize = ref(20);

const sortedPayouts = computed(() =>
  [...paymentStore.visiblePayouts].sort(
    (left, right) =>
      new Date(right.date).getTime() - new Date(left.date).getTime(),
  ),
);
const totalPages = computed(() =>
  Math.max(1, Math.ceil(sortedPayouts.value.length / pageSize.value)),
);
const paginatedPayouts = computed(() => {
  const safePage = Math.min(currentPage.value, totalPages.value);
  const start = (safePage - 1) * pageSize.value;
  return sortedPayouts.value.slice(start, start + pageSize.value);
});

watch(totalPages, (count) => {
  if (currentPage.value > count) currentPage.value = count;
});

async function applyFilters() {
  if (!isReady.value) return;
  const filters: ShopifyPayoutFilters = {
    ...(status.value ? { status: status.value } : {}),
    ...(date.value ? { date: date.value } : {}),
    ...(dateMin.value ? { date_min: dateMin.value } : {}),
    ...(dateMax.value ? { date_max: dateMax.value } : {}),
    ...(sinceId.value ? { since_id: sinceId.value } : {}),
    ...(lastId.value ? { last_id: lastId.value } : {}),
  };
  currentPage.value = 1;
  await paymentStore.fetchPayouts(storeId.value, token.value, filters);
}

async function resetFilters() {
  status.value = "";
  date.value = "";
  dateMin.value = "";
  dateMax.value = "";
  sinceId.value = "";
  lastId.value = "";
  await applyFilters();
}

function getPayoutProcessedDate(payoutId: number) {
  const transactions =
    paymentStore.transactionsByPayout[String(payoutId)] || [];
  const charge = transactions.find(
    (transaction) => transaction.type === "charge",
  );
  return charge ? fmtDate(charge.processed_at) : "—";
}

function statusBadge(statusValue: string) {
  if (statusValue === "paid") return "badge-paid";
  if (statusValue === "in_transit") return "badge-in-transit";
  return "badge-pending";
}

function formatMoney(amount: string, currency: string) {
  const numericAmount = Number(amount || 0);
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(numericAmount);
  } catch {
    return `${numericAmount.toFixed(2)} ${currency}`;
  }
}

function openPayoutDetail(payoutId: number) {
  router.push(`/store/payout/${payoutId}`);
}

function updatePageSize(size: number) {
  pageSize.value = size;
  currentPage.value = 1;
}
</script>

<template>
  <div class="payouts-tab">
    <form class="filter-toolbar" @submit.prevent="applyFilters">
      <label>
        <span>Status</span>
        <select v-model="status">
          <option value="">All statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="in_transit">In transit</option>
          <option value="paid">Paid</option>
          <option value="failed">Failed</option>
          <option value="canceled">Canceled</option>
        </select>
      </label>
      <label>
        <span>Exact date</span>
        <input v-model="date" type="date" />
      </label>
      <label>
        <span>From</span>
        <input v-model="dateMin" type="date" />
      </label>
      <label>
        <span>Through</span>
        <input v-model="dateMax" type="date" />
      </label>
      <label>
        <span>After payout ID</span>
        <input v-model.trim="sinceId" inputmode="numeric" placeholder="since_id" />
      </label>
      <label>
        <span>Before payout ID</span>
        <input v-model.trim="lastId" inputmode="numeric" placeholder="last_id" />
      </label>
      <div class="filter-actions">
        <button type="button" class="secondary" @click="resetFilters">
          Reset
        </button>
        <button type="submit" :disabled="paymentStore.isLoading">
          {{ paymentStore.isLoading ? "Loading…" : "Apply filters" }}
        </button>
      </div>
    </form>

    <table>
      <thead>
        <tr>
          <th>Payout date</th>
          <th>Status</th>
          <th>Transaction date</th>
          <th class="right">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="payout in paginatedPayouts"
          :key="payout.id"
          @click="openPayoutDetail(payout.id)"
        >
          <td class="td-date">{{ fmtDate(payout.date) }}</td>
          <td>
            <span class="badge" :class="statusBadge(payout.status)">
              {{ payout.status === "paid" ? "Deposited" : capitalize(payout.status) }}
            </span>
          </td>
          <td class="td-date">{{ getPayoutProcessedDate(payout.id) }}</td>
          <td class="right td-net">
            {{ formatMoney(payout.amount, payout.currency) }}
          </td>
        </tr>
      </tbody>
    </table>

    <PaginationControls
      v-if="sortedPayouts.length"
      :page="currentPage"
      :page-size="pageSize"
      :total-items="sortedPayouts.length"
      item-label="payouts"
      @update:page="currentPage = $event"
      @update:page-size="updatePageSize"
    />
    <div v-else class="empty">No payouts found.</div>
  </div>
</template>

<style scoped>
.filter-toolbar {
  display: grid;
  grid-template-columns: repeat(6, minmax(120px, 1fr)) auto;
  gap: 10px;
  align-items: end;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--surface-soft);
}

.filter-toolbar label {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.filter-toolbar label span {
  color: var(--text-sub);
  font-size: 11px;
  font-weight: 700;
}

.filter-toolbar input,
.filter-toolbar select {
  min-width: 0;
  height: 34px;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0 8px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-size: 12px;
}

.filter-actions {
  display: flex;
  gap: 6px;
}

.filter-actions button {
  height: 34px;
  border: 0;
  border-radius: 6px;
  padding: 0 11px;
  background: var(--green);
  color: white;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

.filter-actions button.secondary {
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-sub);
}

.filter-actions button:disabled {
  opacity: 0.55;
  cursor: wait;
}

.td-date {
  color: var(--text-secondary);
  white-space: nowrap;
}

.td-net {
  color: var(--text-primary);
  font-weight: 600;
}

@media (max-width: 1180px) {
  .filter-toolbar {
    grid-template-columns: repeat(3, minmax(150px, 1fr));
  }
}

@media (max-width: 700px) {
  .filter-toolbar {
    grid-template-columns: 1fr 1fr;
  }

  .filter-actions {
    grid-column: 1 / -1;
  }
}
</style>
