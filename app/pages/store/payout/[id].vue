<template>
  <NuxtLayout name="shop">
    <template #title>
      <div v-if="currentPayout" class="breadcrumb">
        <NuxtLink to="/store" class="breadcrumb-back">
          <svg
            width="16"
            height="16"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
          >
            <path d="M13 4l-6 6 6 6" />
          </svg>
        </NuxtLink>
        <span class="page-title">Payout details</span>
        <span
          class="badge"
          :class="currentPayout.status === 'paid' ? 'badge-paid' : ''"
        >
          {{
            currentPayout.status === "paid"
              ? "Deposited"
              : capitalize(currentPayout.status)
          }}
        </span>
      </div>
      <div v-else class="breadcrumb">
        <NuxtLink to="/store" class="breadcrumb-back">
          <svg
            width="16"
            height="16"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
          >
            <path d="M13 4l-6 6 6 6" />
          </svg>
        </NuxtLink>
        <span class="page-title">Loading...</span>
      </div>
    </template>

    <section class="page">
      <div v-if="paymentStore.isLoading" class="empty">
        Loading payout details…
      </div>
      <div v-else-if="!currentPayout" class="empty">
        Payout not found or failed to load.
      </div>
      <div v-else class="screen">
        <div class="page-header" style="justify-content: flex-end">
          <button class="btn btn-secondary" type="button" @click="exportTransactions">
            <Download />
            Export
          </button>
        </div>

        <!-- Overview Card -->
        <div class="card">
          <div class="overview-card">
            <div class="overview-left">
              <div class="overview-label">Total</div>
              <div>
                <span class="overview-amount">{{
                  formatMoney(currentPayout.amount, currentPayout.currency)
                }}</span>
                <span class="overview-currency">{{
                  currentPayout.currency
                }}</span>
              </div>
              <div class="overview-provider">Shopify Payments</div>
              <div class="overview-meta">
                <div class="meta-item">
                  <label>Business entity</label>
                  <span>{{
                    currentPayoutMetadata?.businessEntity.displayName ||
                    "Unavailable"
                  }}</span>
                </div>
                <div class="meta-item">
                  <label>Direction</label>
                  <span>{{
                    formatShopifyPaymentLabel(
                      currentPayoutMetadata?.transactionType,
                    ) || "Unavailable"
                  }}</span>
                </div>
                <div class="meta-item">
                  <label>Issued</label>
                  <span>{{
                    currentPayoutMetadata?.issuedAt
                      ? fmtDate(currentPayoutMetadata.issuedAt)
                      : currentPayout.date
                        ? fmtDate(currentPayout.date)
                        : "N/A"
                  }}</span>
                </div>
                <div
                  v-if="currentPayoutMetadata?.externalTraceId"
                  class="meta-item"
                >
                  <label>Bank trace ID</label>
                  <span class="trace-id">{{
                    currentPayoutMetadata.externalTraceId
                  }}</span>
                </div>
              </div>
            </div>
            <div class="overview-right">
              <div class="summary-title">Summary</div>
              <div
                v-for="row in currentPayoutSummaryRows"
                :key="row.label"
                class="summary-row"
              >
                <span class="summary-label">
                  {{ row.label }}
                  <span v-if="row.chevron" class="chevron-icon">▾</span>
                </span>
                <span class="summary-value" :class="{ neg: row.neg }">{{
                  row.value
                }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Transactions Table Card -->
        <div class="card">
          <div class="table-header">
            <button class="tab-btn active">All</button>
            <button class="tab-btn">Charge</button>
            <div class="table-actions">
              <button class="icon-btn">
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <circle cx="9" cy="9" r="6" />
                  <path d="m15 15 3 3" />
                </svg>
              </button>
              <button class="icon-btn">
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M3 5h14M6 10h8M9 15h2" />
                </svg>
              </button>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Order</th>
                <th>Type</th>
                <th>Payment method</th>
                <th class="right">Amount</th>
                <th class="right">Fee</th>
                <th class="right">Net</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="tx in currentPayoutTransactions" :key="tx.id">
                <td class="td-date">{{ fmtDate(tx.processed_at) }}</td>
                <td class="td-order">
                  <NuxtLink
                    v-if="tx.source_order_id"
                    class="link"
                    :to="`/order/${tx.source_order_id}`"
                  >
                    {{ getOrderName(tx) }}
                  </NuxtLink>
                  <span v-else>—</span>
                </td>
                <td class="td-type">
                  <strong>{{ formatShopifyPaymentLabel(tx.type) }}</strong>
                  <small v-if="tx.source_type">
                    Source: {{ formatShopifyPaymentLabel(tx.source_type) }}
                  </small>
                  <details
                    v-if="tx.adjustment_order_transactions.length"
                    class="adjustment-orders"
                  >
                    <summary>
                      {{ tx.adjustment_order_transactions.length }} adjusted
                      {{
                        tx.adjustment_order_transactions.length === 1
                          ? "order"
                          : "orders"
                      }}
                    </summary>
                    <div
                      v-for="adjustment in tx.adjustment_order_transactions"
                      :key="adjustment.id"
                    >
                      <NuxtLink
                        v-if="adjustment.order.id"
                        :to="`/order/${adjustment.order.id}`"
                      >
                        {{ adjustment.order.name }}
                      </NuxtLink>
                      <span v-else>{{ adjustment.order.name }}</span>
                    </div>
                  </details>
                </td>
                <td>
                  <span class="payment-method">
                    <span class="card-brand">{{
                      tx.type === "charge" ? "Card" : "—"
                    }}</span>
                  </span>
                </td>
                <td class="right td-amount">
                  {{ formatMoney(tx.amount, tx.currency) }}
                  <span class="chevron-sm">▾</span>
                </td>
                <td class="right td-fee">
                  <template v-if="parseFloat(tx.fee)">
                    {{ formatMoney(tx.fee, tx.currency) }}
                    <span class="chevron-sm">▾</span>
                  </template>
                  <template v-else>—</template>
                </td>
                <td class="right td-net">
                  {{ formatMoney(tx.net, tx.currency) }}
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="currentPayoutTransactions.length === 0" class="empty">
            No transactions for this payout.
          </div>
          <div class="pagination">
            <button class="pag-btn" disabled>&#8592;</button>
            <button class="pag-btn" disabled>&#8594;</button>
          </div>
        </div>
      </div>
    </section>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { Download } from "@lucide/vue";
import { computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useStoreFeedback } from "~/composables/useStoreFeedback";
import { useCredentialVaultStore } from "~/stores/credentialVault";
import { useFormStore } from "../../../stores/form";
import type { Transaction } from "../../../stores/payment";
import { usePaymentStore } from "../../../stores/payment";
import { resolveStoreAccessToken } from "~~/utils/shop-auth";
import { formatShopifyPaymentLabel } from "~~/utils/shopify-payment";

definePageMeta({ layout: false });

const route = useRoute();
const formStore = useFormStore();
const paymentStore = usePaymentStore();
const credentialVault = useCredentialVaultStore();
const feedback = useStoreFeedback();

const payoutId = String(
  Array.isArray(route.params.id) ? route.params.id[0] : route.params.id || "",
).trim();

onMounted(() => {
  if (formStore.storeId && payoutId) {
    const token = resolveToken(formStore.storeId);
    if (token) {
      paymentStore.fetchPayoutDetail(formStore.storeId, token, payoutId, false);
      paymentStore.fetchPaymentsAccount(formStore.storeId, token);
    }
  }
});

function resolveToken(sid: string): string | null {
  return resolveStoreAccessToken(credentialVault.getStoreData(sid)) || null;
}

const currentPayout = computed(
  () =>
    paymentStore.payoutDetails[String(payoutId)] ||
    paymentStore.payouts.find((p) => String(p.id) === payoutId) ||
    null,
);

const currentPayoutMetadata = computed(
  () => paymentStore.payoutMetadata[String(payoutId)] || null,
);

const currentPayoutTransactions = computed(() => {
  if (!payoutId) return [];
  return paymentStore
    .getTransactionsForPayout(payoutId)
    .filter((t) => t.type !== "payout");
});

const currentPayoutSummaryRows = computed(() => {
  if (!currentPayout.value || !currentPayout.value.summary) return [];
  const s = currentPayout.value.summary;

  const charges = parseFloat(s.charges_gross_amount || "0");
  const refunds = parseFloat(s.refunds_gross_amount || "0");
  const adjustments = parseFloat(s.adjustments_gross_amount || "0");

  const fees =
    parseFloat(s.charges_fee_amount || "0") +
    parseFloat(s.refunds_fee_amount || "0") +
    parseFloat(s.adjustments_fee_amount || "0");

  const rows = [];
  if (charges) {
    rows.push({
      label: "Charges",
      value: `$${charges.toFixed(2)}`,
      neg: false,
    });
  }
  if (refunds) {
    rows.push({
      label: "Refunds",
      value: `-$${Math.abs(refunds).toFixed(2)}`,
      neg: true,
    });
  }
  if (adjustments) {
    rows.push({
      label: "Adjustments",
      value: `${adjustments < 0 ? "-$" : "$"}${Math.abs(adjustments).toFixed(2)}`,
      neg: adjustments < 0,
    });
  }
  if (fees) {
    rows.push({
      label: "Fees",
      value: `-$${Math.abs(fees).toFixed(2)}`,
      neg: true,
      chevron: true,
    });
  }
  return rows;
});

// ── Helpers ──────────────────────────────────────────────
function fmtDate(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function capitalize(s: string) {
  if (!s) return "";
  return (
    String(s).charAt(0).toUpperCase() + String(s).slice(1).replace(/_/g, " ")
  );
}

function getOrderName(tx: Transaction) {
  if (tx.source_order_name) return tx.source_order_name;
  if (!tx.source_order_id) return null;
  return `#${tx.source_order_id}`;
}

function exportTransactions() {
  if (!currentPayout.value) {
    feedback.warning("Payout details are not ready to export.");
    return;
  }

  const rows = currentPayoutTransactions.value.map((transaction) => [
    transaction.id,
    transaction.processed_at,
    getOrderName(transaction) || "",
    transaction.type,
    transaction.currency,
    transaction.amount,
    transaction.fee,
    transaction.net,
  ]);
  const csv = [
    ["id", "processed_at", "order", "type", "currency", "amount", "fee", "net"],
    ...rows,
  ]
    .map((row) => row.map(formatCsvCell).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `payout-${currentPayout.value.id}-transactions.csv`;
  link.click();
  URL.revokeObjectURL(url);
  feedback.success("Payout transactions exported.");
}

function formatCsvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
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
</script>

<style scoped>
.screen {
  display: block;
  animation: fadeIn 0.18s ease;
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
}
.breadcrumb-back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--surface, #fff);
  border: 1px solid var(--border, #e5e5e5);
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
  color: var(--text-primary, #1a1a1a);
}
.breadcrumb-back:hover {
  background: var(--surface-soft);
}
.page-title {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--text-primary);
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.6;
}
.badge-deposited,
.badge-paid {
  background: var(--green-soft);
  color: var(--green);
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.15s;
}
.btn svg {
  width: 15px;
  height: 15px;
  flex: 0 0 15px;
}
.btn-secondary {
  background: var(--surface, #fff);
  color: var(--text-primary);
  border: 1px solid var(--border);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}
.btn-secondary:hover {
  background: var(--surface-soft);
}

.card {
  background: var(--surface, #fff);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  margin-bottom: 16px;
}

.overview-card {
  display: grid;
  grid-template-columns: 1fr 1fr;
}
.overview-left {
  padding: 20px 24px;
  border-right: 1px solid var(--border, #e5e5e5);
}
.overview-right {
  padding: 20px 24px;
}
.overview-label {
  font-size: 13px;
  color: var(--text-sub);
  margin-bottom: 4px;
}
.overview-amount {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.5px;
  color: var(--text);
}
.overview-currency {
  font-size: 28px;
  font-weight: 300;
  color: var(--text-sub);
  margin-left: 4px;
}
.overview-provider {
  font-size: 13px;
  color: var(--text-sub);
  margin-top: 6px;
}
.overview-meta {
  display: flex;
  gap: 40px;
  margin-top: 16px;
}
.meta-item label {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: block;
  margin-bottom: 2px;
  font-weight: 400;
}
.meta-item span {
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
}
.trace-id {
  overflow-wrap: anywhere;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 11px !important;
}
.text-muted {
  color: var(--text-muted) !important;
}

.summary-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-sub);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
}
.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  font-size: 14px;
}
.summary-row:not(:last-child) {
  border-bottom: 1px solid var(--border);
}
.summary-label {
  color: var(--text-sub);
  display: flex;
  align-items: center;
  gap: 4px;
}
.summary-value {
  font-weight: 600;
  color: var(--text);
}
.summary-value.neg {
  color: var(--red);
}

.table-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border, #e5e5e5);
}
.tab-btn {
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  background: transparent;
  color: var(--text-sub);
}
.tab-btn.active {
  background: var(--surface-soft);
  color: var(--text);
}
.table-actions {
  margin-left: auto;
  display: flex;
  gap: 4px;
}
.icon-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  cursor: pointer;
  border: none;
  background: transparent;
  color: var(--text-sub);
}

table {
  width: 100%;
  border-collapse: collapse;
}
thead th {
  padding: 10px 16px;
  text-align: left;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-sub);
  border-bottom: 1px solid var(--border, #e5e5e5);
}
thead th.right {
  text-align: right;
}
tbody tr {
  border-bottom: 1px solid var(--border, #e5e5e5);
  transition: background 0.12s;
}
tbody tr:hover {
  background: var(--surface-soft);
}
td {
  padding: 12px 16px;
  font-size: 13px;
  color: var(--text);
}
td.right {
  text-align: right;
}
.td-date {
  color: var(--text-sub);
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
.td-order a {
  color: var(--text-link);
  font-weight: 500;
}
.card-brand {
  display: inline-flex;
  align-items: center;
  background: var(--blue);
  color: white !important;
  font-size: 9px;
  font-weight: 800;
  padding: 2px 5px;
  border-radius: 3px;
  text-transform: uppercase;
}
.td-fee {
  color: var(--red);
}
.empty {
  text-align: center;
  padding: 32px;
  color: var(--text-muted);
  font-size: 13px;
}
.pagination {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 10px 16px;
  border-top: 1px solid var(--border, #e5e5e5);
}
.pag-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: 1px solid var(--border, #e5e5e5);
  background: transparent;
  color: var(--text-sub);
}
</style>
