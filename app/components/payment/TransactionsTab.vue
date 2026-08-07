<script setup lang="ts">
import { Clock, Filter, RotateCcw } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useStoreFeedback } from "~/composables/useStoreFeedback";
import { useOrderStore } from "~/stores/order";
import { usePaymentStore } from "~/stores/payment";
import type { Transaction } from "~/stores/payment";
import type {
  ShopifyPaymentsBalanceTransactionSearchFilters,
} from "~~/types/shopify-payments-graphql";
import { capitalize, fmtDate } from "~~/helpers";
import { formatShopifyPaymentLabel } from "~~/utils/shopify-payment";

const paymentStore = usePaymentStore();
const orderStore = useOrderStore();
const { storeId, token, isReady } = useActiveShopAuth();
const feedback = useStoreFeedback();

const transactionType = ref("");
const payoutStatus = ref("");
const payoutDate = ref("");
const processedFrom = ref("");
const processedThrough = ref("");
const currency = ref("");
const cardLast4 = ref("");
const paymentMethod = ref("");
const transferId = ref("");
const taxExempt = ref<"" | "yes" | "no">("");
const hideTransfers = ref(false);
const testMode = ref<"" | "live" | "test">("");
const sinceId = ref("");
const lastId = ref("");
const currentPage = ref(1);
const pageSize = ref(20);
const payoutStatusOptions = [
  { label: "All statuses", value: "" },
  { label: "Pending / not paid out", value: "pending" },
  { label: "Scheduled", value: "scheduled" },
  { label: "In transit", value: "in_transit" },
  { label: "Paid", value: "paid" },
  { label: "Failed", value: "failed" },
  { label: "Canceled", value: "canceled" },
  { label: "Action required", value: "action_required" },
];
const taxExemptOptions = [
  { label: "All", value: "" },
  { label: "Exempt", value: "yes" },
  { label: "Not exempt", value: "no" },
];
const testModeOptions = [
  { label: "Live and test", value: "" },
  { label: "Live only", value: "live" },
  { label: "Test only", value: "test" },
];

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

function setPayoutStatus(value: unknown) {
  payoutStatus.value = typeof value === "string" ? value : "";
}

function setTaxExempt(value: unknown) {
  taxExempt.value = value === "yes" || value === "no" ? value : "";
}

function setTestMode(value: unknown) {
  testMode.value = value === "live" || value === "test" ? value : "";
}

async function applyFilters(successMessage = "Transaction filters applied.") {
  if (!isReady.value) {
    feedback.warning("Select a store with valid credentials before filtering.");
    return;
  }
  const filters: ShopifyPaymentsBalanceTransactionSearchFilters = {
    ...(transactionType.value
      ? { transaction_type: transactionType.value }
      : {}),
    ...(payoutStatus.value
      ? { payout_status: payoutStatus.value }
      : {}),
    ...(payoutDate.value ? { payout_date: payoutDate.value } : {}),
    ...(processedFrom.value
      ? { processed_at_min: processedFrom.value }
      : {}),
    ...(processedThrough.value
      ? { processed_at_max: processedThrough.value }
      : {}),
    ...(currency.value ? { currency: currency.value } : {}),
    ...(cardLast4.value
      ? { credit_card_last4: cardLast4.value }
      : {}),
    ...(paymentMethod.value
      ? { payment_method_name: paymentMethod.value }
      : {}),
    ...(transferId.value
      ? { payments_transfer_id: transferId.value }
      : {}),
    ...(taxExempt.value
      ? { tax_reporting_exempt: taxExempt.value === "yes" }
      : {}),
    ...(hideTransfers.value ? { hide_transfers: true } : {}),
    ...(testMode.value ? { test: testMode.value === "test" } : {}),
    ...(sinceId.value ? { since_id: sinceId.value } : {}),
    ...(lastId.value ? { last_id: lastId.value } : {}),
  };
  currentPage.value = 1;
  await paymentStore.fetchGraphqlBalanceTransactions(
    storeId.value,
    token.value,
    filters,
  );
  feedback.requestResult({
    errorMessage: paymentStore.error,
    warningMessage: paymentStore.graphqlWarning,
    successMessage,
    fallbackError: "Failed to apply transaction filters.",
  });
}

async function showPending() {
  payoutStatus.value = "pending";
  await applyFilters("Pending transactions shown.");
}

async function resetFilters() {
  transactionType.value = "";
  payoutStatus.value = "";
  payoutDate.value = "";
  processedFrom.value = "";
  processedThrough.value = "";
  currency.value = "";
  cardLast4.value = "";
  paymentMethod.value = "";
  transferId.value = "";
  taxExempt.value = "";
  hideTransfers.value = false;
  testMode.value = "";
  sinceId.value = "";
  lastId.value = "";
  await applyFilters("Transaction filters reset.");
}

function getPayoutDate(payoutId: number | null) {
  if (!payoutId) return "—";
  const payout = paymentStore.payouts.find((item) => item.id === payoutId);
  return payout ? fmtDate(payout.date) : "—";
}

function getOrderName(transaction: Transaction) {
  if (transaction.source_order_name) return transaction.source_order_name;
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
    <form class="filter-toolbar" @submit.prevent="applyFilters()">
      <label>
        <span>Transaction type</span>
        <input
          v-model.trim="transactionType"
          placeholder="charge, refund…"
        />
      </label>
      <label>
        <span>Payout status</span>
        <BaseSelect
          class-name="filter-select"
          :model-value="payoutStatus"
          :options="payoutStatusOptions"
          @update:model-value="setPayoutStatus"
        />
      </label>
      <label>
        <span>Payout date</span>
        <input v-model="payoutDate" type="date" />
      </label>
      <label>
        <span>Processed from</span>
        <input v-model="processedFrom" type="date" />
      </label>
      <label>
        <span>Processed through</span>
        <input v-model="processedThrough" type="date" />
      </label>
      <label>
        <span>Currency</span>
        <input
          v-model.trim="currency"
          maxlength="4"
          placeholder="USD"
        />
      </label>
      <label>
        <span>Card last 4</span>
        <input
          v-model.trim="cardLast4"
          inputmode="numeric"
          maxlength="4"
          placeholder="4242"
        />
      </label>
      <label>
        <span>Payment method</span>
        <input v-model.trim="paymentMethod" placeholder="Visa" />
      </label>
      <label>
        <span>Payments transfer ID</span>
        <input
          v-model.trim="transferId"
          inputmode="numeric"
          placeholder="Transfer ID"
        />
      </label>
      <label>
        <span>Tax reporting</span>
        <BaseSelect
          class-name="filter-select"
          :model-value="taxExempt"
          :options="taxExemptOptions"
          @update:model-value="setTaxExempt"
        />
      </label>
      <label>
        <span>Mode</span>
        <BaseSelect
          class-name="filter-select"
          :model-value="testMode"
          :options="testModeOptions"
          @update:model-value="setTestMode"
        />
      </label>
      <label>
        <span>After transaction ID</span>
        <input v-model.trim="sinceId" inputmode="numeric" placeholder="since_id" />
      </label>
      <BaseCheckbox v-model="hideTransfers" label="Hide transfers" />
      <label>
        <span>Before transaction ID</span>
        <input v-model.trim="lastId" inputmode="numeric" placeholder="last_id" />
      </label>
      <div class="filter-actions">
        <BaseButton
          type="button"
          class="filter-action-pending"
          @click="showPending"
        >
          <template #icon>
            <Clock />
          </template>
          Show pending
        </BaseButton>
        <BaseButton type="button" @click="resetFilters">
          <template #icon>
            <RotateCcw />
          </template>
          Reset
        </BaseButton>
        <BaseButton
          type="submit"
          variant="primary"
          :loading="paymentStore.isLoading"
        >
          <template #icon>
            <Filter />
          </template>
          {{ paymentStore.isLoading ? "Loading…" : "Apply filters" }}
        </BaseButton>
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
          <td class="td-type">
            <strong>{{ formatShopifyPaymentLabel(transaction.type) }}</strong>
            <small v-if="transaction.source_type">
              Source: {{ formatShopifyPaymentLabel(transaction.source_type) }}
            </small>
            <details
              v-if="transaction.adjustment_order_transactions.length"
              class="adjustment-orders"
            >
              <summary>
                {{ transaction.adjustment_order_transactions.length }}
                adjusted
                {{
                  transaction.adjustment_order_transactions.length === 1
                    ? "order"
                    : "orders"
                }}
              </summary>
              <div
                v-for="adjustment in transaction.adjustment_order_transactions"
                :key="adjustment.id"
              >
                <NuxtLink
                  v-if="adjustment.order.id"
                  :to="`/order/${adjustment.order.id}`"
                >
                  {{ adjustment.order.name }}
                </NuxtLink>
                <span v-else>{{ adjustment.order.name }}</span>
                <span>
                  {{ formatMoney(adjustment.net, transaction.currency) }} net
                </span>
              </div>
            </details>
          </td>
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
  grid-template-columns: repeat(4, minmax(150px, 1fr));
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

.filter-toolbar input {
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

.filter-toolbar :deep(.select-trigger) {
  min-height: 34px;
  padding: 0 8px;
  background: var(--surface);
  font-size: 12px;
}

.filter-toolbar :deep(.selected-label) {
  font-size: 12px;
  font-weight: 600;
}

.filter-actions {
  display: flex;
  gap: 6px;
  grid-column: 1 / -1;
  justify-content: flex-end;
}

.filter-action-pending {
  border-color: color-mix(in srgb, var(--amber) 35%, var(--border));
  background: var(--amber-soft);
  color: var(--amber);
}

.td-type strong,
.td-type small {
  display: block;
}

.td-type small {
  margin-top: 2px;
  color: var(--text-sub);
  font-size: 10px;
}

.adjustment-orders {
  margin-top: 5px;
  font-size: 10px;
}

.adjustment-orders summary {
  color: var(--text-link);
  cursor: pointer;
}

.adjustment-orders div {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-top: 3px;
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
