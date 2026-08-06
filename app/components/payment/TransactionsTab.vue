<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useOrderStore } from "~/stores/order";
import { usePaymentStore } from "~/stores/payment";
import type { Transaction } from "~/stores/payment";
import type {
  ShopifyBalancePayoutStatus,
  ShopifyBalanceTransactionFilters,
} from "~~/types/shopify-payment";
import { capitalize, fmtDate } from "~~/helpers";

const paymentStore = usePaymentStore();
const orderStore = useOrderStore();
const { storeId, token, isReady } = useActiveShopAuth();

const payoutStatus = ref<"" | ShopifyBalancePayoutStatus>("");
const testMode = ref<"" | "live" | "test">("");
const sinceId = ref("");
const lastId = ref("");
const currentPage = ref(1);
const pageSize = ref(20);

const sortedTransactions = computed(() =>
  [...paymentStore.visibleBalanceTransactions].sort(
    (left, right) =>
      new Date(right.processed_at).getTime() -
      new Date(left.processed_at).getTime(),
  ),
);
const totalPages = computed(() =>
  Math.max(1, Math.ceil(sortedTransactions.value.length / pageSize.value)),
);
const paginatedTransactions = computed(() => {
  const safePage = Math.min(currentPage.value, totalPages.value);
  const start = (safePage - 1) * pageSize.value;
  return sortedTransactions.value.slice(start, start + pageSize.value);
});

watch(totalPages, (count) => {
  if (currentPage.value > count) currentPage.value = count;
});

async function applyFilters() {
  if (!isReady.value) return;
  const filters: ShopifyBalanceTransactionFilters = {
    ...(payoutStatus.value
      ? { payout_status: payoutStatus.value }
      : {}),
    ...(testMode.value ? { test: testMode.value === "test" } : {}),
    ...(sinceId.value ? { since_id: sinceId.value } : {}),
    ...(lastId.value ? { last_id: lastId.value } : {}),
  };
  currentPage.value = 1;
  await paymentStore.fetchBalanceTransactions(
    storeId.value,
    token.value,
    true,
    filters,
  );
}

async function showPending() {
  payoutStatus.value = "pending";
  await applyFilters();
}

async function resetFilters() {
  payoutStatus.value = "";
  testMode.value = "";
  sinceId.value = "";
  lastId.value = "";
  await applyFilters();
}

function getPayoutDate(payoutId: number | null) {
  if (!payoutId) return "—";
  const payout = paymentStore.payouts.find((item) => item.id === payoutId);
  return payout ? fmtDate(payout.date) : "—";
}

function getOrderName(transaction: Transaction) {
  if (!transaction.source_order_id) return null;
  const order = orderStore.orders.find(
    (item) => item.id === transaction.source_order_id,
  );
  return order?.name || `#${transaction.source_order_id}`;
}

function getCustomerName(transaction: Transaction) {
  if (!transaction.source_order_id) return "—";
  const customer = orderStore.orders.find(
    (item) => item.id === transaction.source_order_id,
  )?.customer;
  if (!customer) return "—";
  return (
    `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "—"
  );
}

function payoutBadge(status: string) {
  if (status === "paid") return "badge-deposited";
  if (status === "in_transit") return "badge-in-transit";
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

function updatePageSize(size: number) {
  pageSize.value = size;
  currentPage.value = 1;
}
</script>

<template>
  <div class="transactions-tab">
    <form class="filter-toolbar" @submit.prevent="applyFilters">
      <label>
        <span>Payout status</span>
        <select v-model="payoutStatus">
          <option value="">All statuses</option>
          <option value="pending">Pending / not paid out</option>
          <option value="scheduled">Scheduled</option>
          <option value="in_transit">In transit</option>
          <option value="paid">Paid</option>
          <option value="failed">Failed</option>
          <option value="canceled">Canceled</option>
        </select>
      </label>
      <label>
        <span>Mode</span>
        <select v-model="testMode">
          <option value="">Live and test</option>
          <option value="live">Live only</option>
          <option value="test">Test only</option>
        </select>
      </label>
      <label>
        <span>After transaction ID</span>
        <input v-model.trim="sinceId" inputmode="numeric" placeholder="since_id" />
      </label>
      <label>
        <span>Before transaction ID</span>
        <input v-model.trim="lastId" inputmode="numeric" placeholder="last_id" />
      </label>
      <div class="filter-actions">
        <button type="button" class="pending" @click="showPending">
          Show pending
        </button>
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
          <th>Processed at</th>
          <th>Payout date</th>
          <th>Payout status</th>
          <th>Order</th>
          <th>Customer</th>
          <th>Type</th>
          <th>Mode</th>
          <th class="right">Amount</th>
          <th class="right">Fee</th>
          <th class="right">Net</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="transaction in paginatedTransactions" :key="transaction.id">
          <td class="td-date">{{ fmtDate(transaction.processed_at) }}</td>
          <td class="td-date">{{ getPayoutDate(transaction.payout_id) }}</td>
          <td>
            <span class="badge" :class="payoutBadge(transaction.payout_status)">
              {{
                transaction.payout_status === "paid"
                  ? "Deposited"
                  : capitalize(transaction.payout_status)
              }}
            </span>
          </td>
          <td class="td-order">
            <NuxtLink
              v-if="transaction.source_order_id"
              class="link"
              :to="`/order/${transaction.source_order_id}`"
            >
              {{ getOrderName(transaction) }}
            </NuxtLink>
            <span v-else>—</span>
          </td>
          <td class="td-customer">{{ getCustomerName(transaction) }}</td>
          <td class="td-type">{{ capitalize(transaction.type) }}</td>
          <td>
            <span v-if="transaction.test" class="mode-badge">Test</span>
            <span v-else>Live</span>
          </td>
          <td class="right td-amount">
            {{ formatMoney(transaction.amount, transaction.currency) }}
          </td>
          <td class="right td-fee">
            {{ formatMoney(transaction.fee, transaction.currency) }}
          </td>
          <td class="right td-net">
            {{ formatMoney(transaction.net, transaction.currency) }}
          </td>
        </tr>
      </tbody>
    </table>

    <PaginationControls
      v-if="sortedTransactions.length"
      :page="currentPage"
      :page-size="pageSize"
      :total-items="sortedTransactions.length"
      item-label="transactions"
      @update:page="currentPage = $event"
      @update:page-size="updatePageSize"
    />
    <div v-else class="empty">No balance transactions found.</div>
  </div>
</template>

<style scoped>
.filter-toolbar {
  display: grid;
  grid-template-columns: repeat(4, minmax(150px, 1fr)) auto;
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

.filter-actions button.secondary,
.filter-actions button.pending {
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-sub);
}

.filter-actions button.pending {
  border-color: color-mix(in srgb, var(--amber) 35%, var(--border));
  background: var(--amber-soft);
  color: var(--amber);
}

.filter-actions button:disabled {
  opacity: 0.55;
  cursor: wait;
}

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

.td-amount,
.td-net {
  color: var(--text-primary);
  font-weight: 600;
}

.td-fee {
  color: var(--red);
  font-weight: 500;
}

.mode-badge {
  display: inline-flex;
  border-radius: 20px;
  padding: 2px 8px;
  background: var(--amber-soft);
  color: var(--amber);
  font-size: 11px;
  font-weight: 700;
}

@media (max-width: 1050px) {
  .filter-toolbar {
    grid-template-columns: repeat(2, minmax(150px, 1fr));
  }

  .filter-actions {
    grid-column: 1 / -1;
  }
}

@media (max-width: 620px) {
  .filter-toolbar {
    grid-template-columns: 1fr;
  }

  .filter-actions {
    grid-column: auto;
    flex-wrap: wrap;
  }
}
</style>
