<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { usePaymentStore } from "~/stores/payment";
import type {
  ShopifyPaymentsDisputeFilters,
  ShopifyPaymentsDisputeStatus,
} from "~~/types/shopify-payments-graphql";
import { fmtDate } from "~~/helpers";
import { formatShopifyPaymentLabel } from "~~/utils/shopify-payment";

const paymentStore = usePaymentStore();
const { storeId, token, isReady } = useActiveShopAuth();

const status = ref<"" | ShopifyPaymentsDisputeStatus>("");
const initiatedFrom = ref("");
const initiatedThrough = ref("");
const currentPage = ref(1);
const pageSize = ref(20);

const sortedDisputes = computed(() =>
  [...paymentStore.visibleDisputes].sort(
    (left, right) =>
      new Date(right.initiatedAt).getTime() -
      new Date(left.initiatedAt).getTime(),
  ),
);
const totalPages = computed(() =>
  Math.max(1, Math.ceil(sortedDisputes.value.length / pageSize.value)),
);
const paginatedDisputes = computed(() => {
  const safePage = Math.min(currentPage.value, totalPages.value);
  const start = (safePage - 1) * pageSize.value;
  return sortedDisputes.value.slice(start, start + pageSize.value);
});

watch(totalPages, (count) => {
  if (currentPage.value > count) currentPage.value = count;
});

async function applyFilters() {
  if (!isReady.value) return;
  const filters: ShopifyPaymentsDisputeFilters = {
    ...(status.value ? { status: status.value } : {}),
    ...(initiatedFrom.value
      ? { initiated_at_min: initiatedFrom.value }
      : {}),
    ...(initiatedThrough.value
      ? { initiated_at_max: initiatedThrough.value }
      : {}),
  };
  currentPage.value = 1;
  await paymentStore.fetchDisputes(storeId.value, token.value, filters);
}

async function resetFilters() {
  status.value = "";
  initiatedFrom.value = "";
  initiatedThrough.value = "";
  await applyFilters();
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

function deadlineClass(deadline: string | null, statusValue: string) {
  if (!deadline || statusValue !== "NEEDS_RESPONSE") return "";
  const days = (new Date(deadline).getTime() - Date.now()) / 86_400_000;
  if (days < 0) return "is-overdue";
  if (days <= 3) return "is-urgent";
  return "";
}

function updatePageSize(size: number) {
  pageSize.value = size;
  currentPage.value = 1;
}
</script>

<template>
  <div class="disputes-tab">
    <form class="filter-toolbar" @submit.prevent="applyFilters">
      <label>
        <span>Status</span>
        <select v-model="status">
          <option value="">All statuses</option>
          <option value="NEEDS_RESPONSE">Needs response</option>
          <option value="UNDER_REVIEW">Under review</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="PREVENTED">Prevented</option>
          <option value="WON">Won</option>
          <option value="LOST">Lost</option>
        </select>
      </label>
      <label>
        <span>Initiated from</span>
        <input v-model="initiatedFrom" type="date" />
      </label>
      <label>
        <span>Initiated through</span>
        <input v-model="initiatedThrough" type="date" />
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
          <th>Initiated</th>
          <th>Order</th>
          <th>Status</th>
          <th>Type / reason</th>
          <th>Evidence due</th>
          <th class="right">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="dispute in paginatedDisputes" :key="dispute.id">
          <td class="td-date">{{ fmtDate(dispute.initiatedAt) }}</td>
          <td>
            <NuxtLink
              v-if="dispute.order"
              class="link"
              :to="`/order/${dispute.order.legacyResourceId}`"
            >
              {{ dispute.order.name }}
            </NuxtLink>
            <span v-else>—</span>
          </td>
          <td>
            <span class="status-badge" :class="`is-${dispute.status.toLowerCase()}`">
              {{ formatShopifyPaymentLabel(dispute.status) }}
            </span>
          </td>
          <td>
            <strong>{{ formatShopifyPaymentLabel(dispute.type) }}</strong>
            <small>{{ formatShopifyPaymentLabel(dispute.reasonDetails.reason) }}</small>
          </td>
          <td
            class="td-date"
            :class="deadlineClass(dispute.evidenceDueBy, dispute.status)"
          >
            {{ dispute.evidenceDueBy ? fmtDate(dispute.evidenceDueBy) : "—" }}
          </td>
          <td class="right td-amount">
            {{ formatMoney(dispute.amount.amount, dispute.amount.currencyCode) }}
          </td>
        </tr>
      </tbody>
    </table>

    <PaginationControls
      v-if="sortedDisputes.length"
      :page="currentPage"
      :page-size="pageSize"
      :total-items="sortedDisputes.length"
      item-label="disputes"
      @update:page="currentPage = $event"
      @update:page-size="updatePageSize"
    />
    <div v-else class="empty">No Shopify Payments disputes found.</div>
  </div>
</template>

<style scoped>
.filter-toolbar {
  display: grid;
  grid-template-columns: repeat(3, minmax(160px, 1fr)) auto;
  gap: 10px;
  align-items: end;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--surface-soft);
}

.filter-toolbar label {
  display: grid;
  gap: 4px;
}

.filter-toolbar label span,
td small {
  color: var(--text-sub);
  font-size: 11px;
}

.filter-toolbar input,
.filter-toolbar select {
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
}

.filter-actions button.secondary {
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-sub);
}

td strong,
td small {
  display: block;
}

.status-badge {
  display: inline-flex;
  border-radius: 999px;
  padding: 3px 8px;
  background: var(--surface-soft);
  font-size: 11px;
  font-weight: 700;
}

.status-badge.is-needs_response,
.is-urgent {
  color: #a15c00;
}

.status-badge.is-won,
.status-badge.is-prevented {
  color: var(--green);
}

.status-badge.is-lost,
.is-overdue {
  color: var(--red);
}

@media (max-width: 800px) {
  .filter-toolbar {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
