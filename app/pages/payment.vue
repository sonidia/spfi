<template>
  <NuxtLayout name="shop">
    <template #title>
      <div v-if="currentScreen === 'list'" class="breadcrumb">
         <span class="page-title">Payouts</span>
      </div>
      <div v-else-if="currentScreen === 'detail' && currentPayout" class="breadcrumb">
        <button class="breadcrumb-back" @click="showScreen('list')">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M13 4l-6 6 6 6" />
          </svg>
        </button>
        <span class="page-title">Payout details</span>
        <span class="badge" :class="currentPayout.status === 'paid' ? 'badge-paid' : ''">
          {{ currentPayout.status === "paid" ? "Deposited" : capitalize(currentPayout.status) }}
        </span>
      </div>
      <div v-else-if="currentScreen === 'tx' && currentTx" class="breadcrumb">
        <button class="breadcrumb-back" @click="showScreen('detail')">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M13 4l-6 6 6 6" />
          </svg>
        </button>
        <span class="page-title">{{ capitalize(currentTx.type) }} details</span>
      </div>
    </template>

    <section class="page">
      <!-- ════════════════ LOADING STATE -->
      <div v-if="paymentStore.isLoading" class="empty">Loading payment data…</div>

      <!-- ════════════════ EMPTY / NOT FETCHED -->
      <div
        v-else-if="
          !paymentStore.isLoading &&
          paymentStore.payouts.length === 0 &&
          !paymentStore.error
        "
        class="empty"
      >
        Select a store from the selector above to view payment data.
      </div>

      <!-- ════════════════ SCREEN 1: PAYOUTS LIST -->
      <div v-if="currentScreen === 'list'" class="screen">
        <div class="page-header" style="justify-content: flex-end;">
          <button class="btn btn-secondary">
            <svg
              width="14"
              height="14"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M3 10h14M10 3l7 7-7 7" />
            </svg>
            Export
          </button>
        </div>

      <!-- Balance Card -->
      <div class="card" v-if="currentBalance">
        <div class="overview-card">
          <div
            class="overview-left"
            style="border-right: none; padding: 20px 24px"
          >
            <div class="overview-label">Current Balance</div>
            <div>
              <span class="overview-amount"
                >${{ parseFloat(currentBalance.amount || 0).toFixed(2) }}</span
              >
              <span class="overview-currency">{{
                currentBalance.currency
              }}</span>
            </div>
            <div class="overview-provider">Shopify Payments</div>
          </div>
        </div>
      </div>

      <!-- Payouts Table Card -->
      <div class="card">
        <div class="table-header">
          <button
            class="tab-btn"
            :class="{ active: payoutsFilter === 'all' }"
            @click="filterPayouts('all')"
          >
            All
          </button>
          <button
            class="tab-btn"
            :class="{ active: payoutsFilter === 'paid' }"
            @click="filterPayouts('paid')"
          >
            Paid
          </button>
          <button
            class="tab-btn"
            :class="{ active: payoutsFilter === 'in_transit' }"
            @click="filterPayouts('in_transit')"
          >
            In transit
          </button>
          <div class="table-actions">
            <button class="icon-btn" title="Search">
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
            <button class="icon-btn" title="Filter">
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
              <th>Status</th>
              <th>Bank account</th>
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
              <td class="td-bank">JPMORGAN CHASE... (2420)</td>
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
        <div class="pagination">
          <button class="pag-btn" disabled>&#8592;</button>
          <button class="pag-btn" disabled>&#8594;</button>
        </div>
      </div>
    </div>

    <!-- ════════════════ SCREEN 2: PAYOUT DETAIL -->
    <!-- ════════════════ SCREEN 2: PAYOUT DETAIL -->
    <div v-if="currentScreen === 'detail' && currentPayout" class="screen">
      <div class="page-header" style="justify-content: flex-end;">
        <div v-if="false"> <!-- Title moved to layout --> </div>
        <button class="btn btn-primary">Export</button>
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
                <span
                  >{{ currentPayout.bank_account.title }} ({{
                    currentPayout.bank_account.account_number
                  }})</span
                >
              </div>
              <div class="meta-item" v-else>
                <label>Bank account</label>
                <span>Default linked account</span>
              </div>
              <div class="meta-item">
                <label>Bank reference</label>
                <span class="text-muted">Not available</span>
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
            <tr
              v-for="tx in currentPayoutTransactions"
              :key="tx.id"
              @click="openTxDetail(tx.id)"
            >
              <td class="td-date">{{ fmtDate(tx.processed_at) }}</td>
              <td class="td-order">
                <a
                  v-if="getOrderNumber(tx)"
                  class="link"
                  @click.stop="openTxDetail(tx.id)"
                  >#{{ getOrderNumber(tx) }}</a
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

    <!-- ════════════════ SCREEN 3: TRANSACTION DETAIL -->
    <!-- ════════════════ SCREEN 3: TRANSACTION DETAIL -->
    <div v-if="currentScreen === 'tx' && currentTx" class="screen">
      <div class="page-header" style="justify-content: flex-end;">
        <div v-if="false"> <!-- Title moved to layout --> </div>
        <button class="btn btn-secondary">Export</button>
      </div>

      <div class="card">
        <div class="tx-header-block">
          <div class="tx-header-label">Net amount</div>
          <div class="tx-amount-row">
            <span class="tx-amount"
              >${{ Math.abs(parseFloat(currentTx.net)).toFixed(2) }}</span
            >
            <span class="tx-currency">{{ currentTx.currency }}</span>
          </div>
          <div class="tx-header-sub">
            {{ capitalize(currentTx.type) }} ·
            {{ fmtDate(currentTx.processed_at) }}
          </div>
        </div>

        <div class="tx-meta-grid">
          <div class="tx-meta-col">
            <div class="tx-meta-section-title">Transaction</div>
            <div class="tx-meta-row">
              <label>Transaction ID</label
              ><span class="mono">{{ currentTx.id }}</span>
            </div>
            <div class="tx-meta-row">
              <label>Type</label><span>{{ capitalize(currentTx.type) }}</span>
            </div>
            <div class="tx-meta-row">
              <label>Status</label>
              <span
                ><span class="badge badge-paid">{{
                  capitalize(currentTx.payout_status)
                }}</span></span
              >
            </div>
            <div class="tx-meta-row">
              <label>Processed at</label
              ><span>{{ fmtDate(currentTx.processed_at) }}</span>
            </div>
            <div class="tx-meta-row">
              <label>Currency</label><span>{{ currentTx.currency }}</span>
            </div>
            <div class="tx-meta-row">
              <label>Amount</label>
              <span class="td-amount"
                >${{ Math.abs(parseFloat(currentTx.amount)).toFixed(2) }}</span
              >
            </div>
            <div v-if="parseFloat(currentTx.fee)" class="tx-meta-row">
              <label>Fee</label>
              <span class="td-fee"
                >-${{ parseFloat(currentTx.fee).toFixed(2) }}</span
              >
            </div>
            <div class="tx-meta-row">
              <label>Net</label>
              <span class="td-net"
                >${{ Math.abs(parseFloat(currentTx.net)).toFixed(2) }}</span
              >
            </div>
          </div>

          <div class="tx-meta-col">
            <div class="tx-meta-section-title">Source</div>
            <div class="tx-meta-row">
              <label>Source type</label
              ><span>{{ capitalize(currentTx.source_type) }}</span>
            </div>
            <template v-if="currentTx.source_order_id">
              <div class="tx-meta-row">
                <label>Order</label>
                <span>
                  <a class="link" :href="`/order/${currentTx.source_order_id}`">
                    #{{
                      getOrderNumber(currentTx) || currentTx.source_order_id
                    }}
                  </a>
                </span>
              </div>
              <div class="tx-meta-row">
                <label>Order ID</label
                ><span class="mono">{{ currentTx.source_order_id }}</span>
              </div>
              <div class="tx-meta-row">
                <label>Payment method</label>
                <span
                  ><span class="card-brand" style="font-size: 10px">{{
                    currentTx.type === "charge" ? "Card" : "—"
                  }}</span></span
                >
              </div>
            </template>
            <template v-else>
              <div class="tx-meta-row">
                <label>Source ID</label
                ><span class="mono">{{ currentTx.source_id }}</span>
              </div>
            </template>
            <div class="tx-meta-row">
              <label>Payout ID</label
              ><span class="mono">{{ currentTx.payout_id }}</span>
            </div>
            <div class="tx-meta-row">
              <label>Payout status</label>
              <span
                ><span class="badge badge-paid">{{
                  capitalize(currentTx.payout_status)
                }}</span></span
              >
            </div>
          </div>
        </div>
      </div>
    </div>
    </section>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { Transaction } from "../stores/payment";
import { usePaymentStore } from "../stores/payment";

// ── Store ────────────────────────────────────────────────
const paymentStore = usePaymentStore();

onMounted(() => {
  // Logic handled by shop layout or persistent store
});

// ── Local UI state ───────────────────────────────────────
const currentScreen = ref<"list" | "detail" | "tx">("list");
const currentPayoutId = ref<number | null>(null);
const currentTxId = ref<number | null>(null);
const payoutsFilter = ref<"all" | "paid" | "in_transit">("all");

// ── Computed from store ──────────────────────────────────
const filteredPayouts = computed(() =>
  paymentStore.payouts.filter(
    (p) => payoutsFilter.value === "all" || p.status === payoutsFilter.value,
  ),
);

const currentPayout = computed(
  () =>
    paymentStore.payouts.find((p) => p.id === currentPayoutId.value) ?? null,
);

const currentBalance = computed(() => {
  const b = paymentStore.balance;
  if (!b) return null;
  if (Array.isArray(b)) return b[0] ?? null;
  return b;
});

const currentPayoutTransactions = computed(() => {
  if (!currentPayoutId.value) return [];
  // Show all except the aggregate 'payout' item itself
  return paymentStore
    .getTransactionsForPayout(currentPayoutId.value)
    .filter((t) => t.type !== "payout");
});

const currentTx = computed(() => {
  if (!currentPayoutId.value || !currentTxId.value) return null;
  return (
    paymentStore
      .getTransactionsForPayout(currentPayoutId.value)
      .find((t) => t.id === currentTxId.value) ?? null
  );
});

const currentPayoutSummaryRows = computed(() => {
  if (!currentPayout.value || !currentPayout.value.summary) return [];
  const s = currentPayout.value.summary;

  const charges = parseFloat(s.charges_gross_amount || "0");
  const refunds = parseFloat(s.refunds_gross_amount || "0");
  const adjustments = parseFloat(s.adjustments_gross_amount || "0");

  // Sum up all fee components
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
  // Extend this map as needed or derive from order data
  const orderMap: Record<number, string> = {};
  return orderMap[tx.source_order_id] || tx.source_order_id;
}

// ── Navigation ───────────────────────────────────────────
function showScreen(name: "list" | "detail" | "tx") {
  currentScreen.value = name;
}

function filterPayouts(filter: "all" | "paid" | "in_transit") {
  payoutsFilter.value = filter;
}

function openPayoutDetail(payoutId: number) {
  currentPayoutId.value = payoutId;
  showScreen("detail");
}

function openTxDetail(txId: number) {
  currentTxId.value = txId;
  showScreen("tx");
}
</script>

<style scoped>
/* ─── SCREEN ─── */
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

/* ─── PAGE HEADER ─── */
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
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.15s;
  color: var(--text-primary);
}
.breadcrumb-back:hover {
  background: #f6f6f6;
}
.page-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}
.page-date {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 2px;
}

/* ─── BADGE ─── */
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
  background: var(--green-bg);
  color: var(--green);
}

/* ─── BUTTONS ─── */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.15s;
  font-family: var(--font);
  line-height: 1.4;
}
.btn-secondary {
  background: var(--surface);
  color: var(--text-primary);
  border: 1px solid var(--border);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}
.btn-secondary:hover {
  background: #f6f6f6;
}
.btn-primary {
  background: #1a1a1a;
  color: white;
}
.btn-primary:hover {
  background: #333;
}

/* ─── CARD ─── */
.card {
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
  margin-bottom: 16px;
}

/* ─── OVERVIEW ─── */
.overview-card {
  display: grid;
  grid-template-columns: 1fr 1fr;
}
.overview-left {
  padding: 20px 24px;
  border-right: 1px solid var(--border);
}
.overview-right {
  padding: 20px 24px;
}
.overview-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}
.overview-amount {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.5px;
  color: var(--text-primary);
}
.overview-currency {
  font-size: 28px;
  font-weight: 300;
  color: var(--text-secondary);
  margin-left: 4px;
}
.overview-provider {
  font-size: 13px;
  color: var(--text-secondary);
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
  color: var(--text-primary);
}
.text-muted {
  color: var(--text-muted) !important;
}

/* ─── SUMMARY ─── */
.summary-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
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
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 4px;
}
.summary-value {
  font-weight: 600;
  color: var(--text-primary);
}
.summary-value.neg {
  color: var(--red);
}
.chevron-icon {
  color: var(--text-muted);
  font-size: 11px;
  cursor: pointer;
}
.chevron-sm {
  color: var(--text-muted);
  font-weight: 400;
  font-size: 12px;
  margin-left: 2px;
}

/* ─── TABLE HEADER ─── */
.table-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}
.tab-btn {
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font);
  transition: all 0.15s;
  line-height: 1.4;
}
.tab-btn.active {
  background: #e8e8e8;
  color: var(--text-primary);
}
.tab-btn:hover:not(.active) {
  background: #f0f0f0;
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
  color: var(--text-secondary);
  transition: background 0.15s;
}
.icon-btn:hover {
  background: #f0f0f0;
}

/* ─── TABLE ─── */
table {
  width: 100%;
  border-collapse: collapse;
}
thead th {
  padding: 10px 16px;
  text-align: left;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}
thead th.right {
  text-align: right;
}
tbody tr {
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: background 0.12s;
}
tbody tr:last-child {
  border-bottom: none;
}
tbody tr:hover {
  background: #fafafa;
}
td {
  padding: 12px 16px;
  font-size: 13px;
  vertical-align: middle;
  color: var(--text-primary);
}
td.right {
  text-align: right;
}
.td-date {
  color: var(--text-secondary);
  white-space: nowrap;
}
.td-bank {
  color: var(--text-secondary);
}
.td-order a {
  color: var(--blue);
  font-weight: 500;
  text-decoration: none;
}
.td-order a:hover {
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

/* ─── PAGINATION ─── */
.pagination {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 10px 16px;
  border-top: 1px solid var(--border);
}
.pag-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-secondary);
  font-family: var(--font);
  font-size: 14px;
  transition: all 0.15s;
  line-height: 1;
}
.pag-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.pag-btn:not(:disabled):hover {
  background: #f0f0f0;
}

/* ─── TX DETAIL ─── */
.tx-header-block {
  padding: 20px 24px;
  border-bottom: 1px solid var(--border);
}
.tx-header-label {
  font-size: 12px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}
.tx-amount-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin: 8px 0 4px;
}
.tx-amount {
  font-size: 32px;
  font-weight: 700;
  letter-spacing: -1px;
  color: var(--text-primary);
}
.tx-currency {
  font-size: 18px;
  color: var(--text-secondary);
  font-weight: 400;
}
.tx-header-sub {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 2px;
}
.tx-meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
}
.tx-meta-col {
  padding: 20px 24px;
}
.tx-meta-col:first-child {
  border-right: 1px solid var(--border);
}
.tx-meta-section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 10px;
}
.tx-meta-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 7px 0;
  font-size: 13px;
  border-bottom: 1px solid #f5f5f5;
}
.tx-meta-row:last-child {
  border-bottom: none;
}
.tx-meta-row label {
  color: var(--text-secondary);
  font-weight: 400;
}
.tx-meta-row span {
  font-weight: 500;
  text-align: right;
  color: var(--text-primary);
}
.mono {
  font-family: monospace !important;
  font-size: 12px !important;
}
.link {
  color: var(--blue);
  cursor: pointer;
  text-decoration: none;
}
.link:hover {
  text-decoration: underline;
}

/* ─── EMPTY ─── */
.empty {
  text-align: center;
  padding: 32px;
  color: var(--text-muted);
  font-size: 13px;
}

/* ─── RESPONSIVE ─── */
@media (max-width: 600px) {
  .overview-card {
    grid-template-columns: 1fr;
  }
  .overview-left {
    border-right: none;
    border-bottom: 1px solid var(--border);
  }
  .tx-meta-grid {
    grid-template-columns: 1fr;
  }
  .tx-meta-col:first-child {
    border-right: none;
    border-bottom: 1px solid var(--border);
  }
  .overview-meta {
    flex-direction: column;
    gap: 12px;
  }
}
</style>
