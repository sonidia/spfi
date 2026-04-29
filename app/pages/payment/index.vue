<template>
  <NuxtLayout name="shop">
    <template #title>
      <div class="breadcrumb">
        <span class="page-title">Payouts</span>
      </div>
    </template>

    <section class="page">
      <!-- ════════════════ LOADING STATE -->
      <div v-if="paymentStore.isLoading" class="empty">
        Loading payment data…
      </div>

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
      <div class="screen">
        <div class="page-header" style="justify-content: flex-end">
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
                  >${{
                    parseFloat(currentBalance.amount || 0).toFixed(2)
                  }}</span
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
          <div class="pagination">
            <button class="pag-btn" disabled>&#8592;</button>
            <button class="pag-btn" disabled>&#8594;</button>
          </div>
        </div>
      </div>

      <!-- Payout details have been moved to /payment/payout/[id] -->
    </section>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { usePaymentStore } from "../../stores/payment";

import { useRouter } from "vue-router";

// ── Store ────────────────────────────────────────────────
const paymentStore = usePaymentStore();
const router = useRouter();

onMounted(() => {
  // Logic handled by shop layout or persistent store
});

// ── Local UI state ───────────────────────────────────────
const payoutsFilter = ref<"all" | "paid" | "in_transit">("all");

// ── Computed from store ──────────────────────────────────
const filteredPayouts = computed(() =>
  paymentStore.payouts.filter(
    (p) => payoutsFilter.value === "all" || p.status === payoutsFilter.value,
  ),
);

const currentBalance = computed(() => {
  const b = paymentStore.balance;
  if (!b) return null;
  if (Array.isArray(b)) return b[0] ?? null;
  return b;
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

function getPayoutProcessedDate(payoutId: number) {
  const txs = paymentStore.transactionsByPayout[String(payoutId)] || [];
  const payoutTx = txs.find((t: any) => t.type === "charge");
  return payoutTx ? fmtDate(payoutTx.processed_at) : "—";
}

// ── Navigation ───────────────────────────────────────────
function filterPayouts(filter: "all" | "paid" | "in_transit") {
  payoutsFilter.value = filter;
}

function openPayoutDetail(payoutId: number) {
  router.push(`/payment/payout/${payoutId}`);
}
</script>

<style scoped>
/* ─── PAGE CONTAINER ─── */
.page {
  max-width: 1000px;
  margin: 0 auto;
  padding: 24px 20px;
  font-family: inherit;
  color: var(--text-primary);
  min-height: 100vh;
}

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
