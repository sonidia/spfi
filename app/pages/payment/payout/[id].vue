<template>
  <NuxtLayout name="shop">
    <template #title>
      <div v-if="currentPayout" class="breadcrumb">
        <NuxtLink to="/payment" class="breadcrumb-back">
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
        <NuxtLink to="/payment" class="breadcrumb-back">
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
          <button class="btn btn-secondary">Export</button>
        </div>

        <!-- Overview Card -->
        <div class="card">
          <div class="overview-card">
            <div class="overview-left">
              <div class="overview-label">Total</div>
              <div>
                <span class="overview-amount"
                  >${{ parseFloat(currentPayout.amount).toFixed(2) }}</span
                >
                <span class="overview-currency">{{
                  currentPayout.currency
                }}</span>
              </div>
              <div class="overview-provider">Shopify Payments</div>
              <div class="overview-meta">
                <div class="meta-item" v-if="currentPayout.bank_account">
                  <label>Bank account</label>
                  <span>
                    {{
                      currentPayout.bank_account.bank_name ||
                      currentPayout.bank_account.title
                    }}
                    ({{ currentPayout.bank_account.account_number }})
                  </span>
                </div>
                <div class="meta-item" v-else>
                  <label>Bank account</label>
                  <span>Unknown bank account</span>
                </div>
                <div
                  class="meta-item"
                  v-if="currentPayout.bank_account?.routing_number"
                >
                  <label>Routing</label>
                  <span>{{ currentPayout.bank_account.routing_number }}</span>
                </div>
                <div class="meta-item">
                  <label>Schedule</label>
                  <span>{{
                    currentPayout.date ? fmtDate(currentPayout.date) : "N/A"
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
                    v-if="getOrderNumber(tx)"
                    class="link"
                    :to="`/order/${getOrderNumber(tx)}`"
                  >
                    #{{ getOrderNumber(tx) }}</NuxtLink
                  >
                  <span v-else>—</span>
                </td>
                <td class="td-type">{{ capitalize(tx.type) }}</td>
                <td>
                  <span class="payment-method">
                    <span class="card-brand">{{
                      tx.type === "charge" ? "Card" : "—"
                    }}</span>
                  </span>
                </td>
                <td class="right td-amount">
                  ${{ parseFloat(tx.amount).toFixed(2) }}
                  <span class="chevron-sm">▾</span>
                </td>
                <td class="right td-fee">
                  <template v-if="parseFloat(tx.fee)">
                    -${{ parseFloat(tx.fee).toFixed(2) }}
                    <span class="chevron-sm">▾</span>
                  </template>
                  <template v-else>—</template>
                </td>
                <td class="right td-net">
                  ${{ parseFloat(tx.net).toFixed(2) }} {{ tx.currency }}
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
import { computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useFormStore } from "../../../stores/form";
import type { Transaction } from "../../../stores/payment";
import { usePaymentStore } from "../../../stores/payment";

const route = useRoute();
const formStore = useFormStore();
const paymentStore = usePaymentStore();

const payoutId = Number(route.params.id);

onMounted(() => {
  if (formStore.storeId && payoutId) {
    const token = resolveToken(formStore.storeId);
    if (token) {
      paymentStore.fetchPayoutDetail(formStore.storeId, token, payoutId, false);
    }
  }
});

function resolveToken(sid: string): string | null {
  const storeCookie = useCookie<any>(sid);
  const data = storeCookie.value;
  const now = Date.now();
  if (data?.accessToken && data?.expiresTime && now < data.expiresTime) {
    return data.accessToken;
  }
  return null;
}

const currentPayout = computed(
  () =>
    paymentStore.payoutDetails[String(payoutId)] ||
    paymentStore.payouts.find((p) => p.id === payoutId) ||
    null,
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

function getOrderNumber(tx: Transaction) {
  if (!tx.source_order_id) return null;
  const orderMap: Record<number, string> = {};
  return orderMap[tx.source_order_id] || tx.source_order_id;
}
</script>

<style scoped>
/* ─── PAGE CONTAINER ─── */
.page {
  max-width: 1000px;
  margin: 0 auto;
  padding: 24px 20px;
  font-family: inherit;
  color: var(--text-primary, #1a1a1a);
  min-height: 100vh;
}

/* Copied and adjusted from payment.vue styles as needed */
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
  background: #f6f6f6;
}
.page-title {
  font-size: 20px;
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
  background: #e3f2e1;
  color: #128200;
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
.btn-secondary {
  background: var(--surface, #fff);
  color: var(--text-primary);
  border: 1px solid var(--border);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}
.btn-secondary:hover {
  background: #f6f6f6;
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
  color: #6d6d6d;
  margin-bottom: 4px;
}
.overview-amount {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.5px;
  color: #1a1a1a;
}
.overview-currency {
  font-size: 28px;
  font-weight: 300;
  color: #6d6d6d;
  margin-left: 4px;
}
.overview-provider {
  font-size: 13px;
  color: #6d6d6d;
  margin-top: 6px;
}
.overview-meta {
  display: flex;
  gap: 40px;
  margin-top: 16px;
}
.meta-item label {
  font-size: 11px;
  color: #8c8c8c;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: block;
  margin-bottom: 2px;
  font-weight: 400;
}
.meta-item span {
  font-size: 13px;
  font-weight: 500;
  color: #1a1a1a;
}
.text-muted {
  color: #8c8c8c !important;
}

.summary-title {
  font-size: 13px;
  font-weight: 600;
  color: #6d6d6d;
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
  border-bottom: 1px solid #f5f5f5;
}
.summary-label {
  color: #6d6d6d;
  display: flex;
  align-items: center;
  gap: 4px;
}
.summary-value {
  font-weight: 600;
  color: #1a1a1a;
}
.summary-value.neg {
  color: #e51c00;
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
  color: #6d6d6d;
}
.tab-btn.active {
  background: #e8e8e8;
  color: #1a1a1a;
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
  color: #6d6d6d;
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
  color: #6d6d6d;
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
  background: #fafafa;
}
td {
  padding: 12px 16px;
  font-size: 13px;
  color: #1a1a1a;
}
td.right {
  text-align: right;
}
.td-date {
  color: #6d6d6d;
}
.td-order a {
  color: #0070f3;
  font-weight: 500;
}
.card-brand {
  display: inline-flex;
  align-items: center;
  background: #3535ff;
  color: white !important;
  font-size: 9px;
  font-weight: 800;
  padding: 2px 5px;
  border-radius: 3px;
  text-transform: uppercase;
}
.td-fee {
  color: #e51c00;
}
.empty {
  text-align: center;
  padding: 32px;
  color: #8c8c8c;
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
  color: #6d6d6d;
}
</style>
