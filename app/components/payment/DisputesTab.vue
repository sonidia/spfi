<script setup lang="ts">
import { Filter, RotateCcw } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useStoreFeedback } from "~/composables/useStoreFeedback";
import { usePaymentStore } from "~/stores/payment";
import type {
  ShopifyPaymentsDisputeFilters,
  ShopifyPaymentsDisputeStatus,
} from "~~/types/shopify-payments-graphql";
import { fmtDate } from "~~/helpers";
import { formatShopifyPaymentLabel } from "~~/utils/shopify-payment";

const paymentStore = usePaymentStore();
const { storeId, token, isReady } = useActiveShopAuth();
const feedback = useStoreFeedback();

const status = ref<"" | ShopifyPaymentsDisputeStatus>("");
const initiatedFrom = ref("");
const initiatedThrough = ref("");
const currentPage = ref(1);
const pageSize = ref(20);
const statusOptions = [
  { label: "All statuses", value: "" },
  { label: "Needs response", value: "NEEDS_RESPONSE" },
  { label: "Under review", value: "UNDER_REVIEW" },
  { label: "Accepted", value: "ACCEPTED" },
  { label: "Prevented", value: "PREVENTED" },
  { label: "Won", value: "WON" },
  { label: "Lost", value: "LOST" },
];

const activeFilterCount = computed(
  () =>
    [status.value, initiatedFrom.value, initiatedThrough.value].filter(Boolean).length,
);

const sortedDisputes = computed(() =>
  [...paymentStore.visibleDisputes].sort(
    (left, right) =>
      new Date(right.initiatedAt).getTime() - new Date(left.initiatedAt).getTime(),
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

function setStatus(value: unknown) {
  status.value =
    typeof value === "string" &&
    [
      "",
      "NEEDS_RESPONSE",
      "UNDER_REVIEW",
      "ACCEPTED",
      "PREVENTED",
      "WON",
      "LOST",
    ].includes(value)
      ? (value as "" | ShopifyPaymentsDisputeStatus)
      : "";
}

async function applyFilters(successMessage = "Dispute filters applied.") {
  if (!isReady.value) {
    feedback.warning("Select a store with valid credentials before filtering.");
    return;
  }
  const filters: ShopifyPaymentsDisputeFilters = {
    ...(status.value ? { status: status.value } : {}),
    ...(initiatedFrom.value ? { initiated_at_min: initiatedFrom.value } : {}),
    ...(initiatedThrough.value ? { initiated_at_max: initiatedThrough.value } : {}),
  };
  currentPage.value = 1;
  await paymentStore.fetchDisputes(storeId.value, token.value, filters);
  feedback.requestResult({
    errorMessage: paymentStore.error,
    successMessage,
    fallbackError: "Failed to apply dispute filters.",
  });
}

async function resetFilters() {
  status.value = "";
  initiatedFrom.value = "";
  initiatedThrough.value = "";
  await applyFilters("Dispute filters reset.");
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
    <PaymentFilterPanel
      title="Dispute filters"
      :active-count="activeFilterCount"
      @submit="applyFilters()"
    >
      <label class="payment-filter-field">
        <span>Status</span>
        <BaseSelect
          class-name="filter-select"
          :model-value="status"
          :options="statusOptions"
          @update:model-value="setStatus"
        />
      </label>
      <label class="payment-filter-field">
        <span>Initiated from</span>
        <input v-model="initiatedFrom" class="payment-filter-input" type="date" />
      </label>
      <label class="payment-filter-field">
        <span>Initiated through</span>
        <input v-model="initiatedThrough" class="payment-filter-input" type="date" />
      </label>
      <template #actions>
        <BaseButton type="button" @click="resetFilters">
          <template #icon>
            <RotateCcw />
          </template>
          Reset
        </BaseButton>
        <BaseButton type="submit" variant="primary" :loading="paymentStore.isLoading">
          <template #icon>
            <Filter />
          </template>
          {{ paymentStore.isLoading ? "Loading…" : "Apply filters" }}
        </BaseButton>
      </template>
    </PaymentFilterPanel>

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
td small {
  color: var(--text-sub);
  font-size: 11px;
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
</style>
