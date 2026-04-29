<template>
  <NuxtLayout name="shop">
    <template #title>
      <div class="breadcrumb">
        <span class="page-title">Order transactions</span>
      </div>
    </template>

    <section class="page">
      <div v-if="paymentStore.isLoading" class="empty">Loading transactions…</div>
      <div v-else-if="paymentStore.error" class="empty error">{{ paymentStore.error }}</div>
      <div v-else class="screen">
        <div class="page-header" style="justify-content: flex-end">
          <button class="btn btn-secondary">Export</button>
        </div>

        <div class="card">
          <div class="table-header">
            <button class="tab-btn active">All</button>
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
                <th>Payout date</th>
                <th>Payout status</th>
                <th>Order</th>
                <th>Type</th>
                <th>Payment</th>
                <th class="right">Amount</th>
                <th class="right">Fee</th>
                <th class="right">Net</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="tx in paymentStore.balanceTransactions" :key="tx.id">
                <td class="td-date">{{ fmtDate(tx.processed_at) }}</td>
                <td class="td-date">
                  <NuxtLink
                    v-if="tx.payout_id"
                    :to="`/payment/payout/${tx.payout_id}`"
                    class="link"
                  >
                    {{ getPayoutDate(tx) }}
                  </NuxtLink>
                  <span v-else>{{ getPayoutDate(tx) }}</span>
                </td>
                <td>
                  <span
                    class="badge"
                    :class="
                      tx.payout_status === 'paid'
                        ? 'badge-deposited'
                        : 'badge-pending'
                    "
                  >
                    {{
                      tx.payout_status === "paid"
                        ? "Deposited"
                        : capitalize(tx.payout_status)
                    }}
                  </span>
                </td>
                <td class="td-order">
                  <a v-if="getOrderNumber(tx)" class="link"
                    >#{{ getOrderNumber(tx) }}</a
                  >
                  <span v-else>—</span>
                </td>
                <td class="td-type">{{ capitalize(tx.type) }}</td>
                <td>
                  <span class="payment-method">
                    <span class="card-brand" v-if="tx.type === 'charge'"
                      >Visa</span
                    >
                    <span v-else>—</span>
                  </span>
                </td>
                <td class="right td-amount">
                  ${{ Math.abs(parseFloat(tx.amount)).toFixed(2) }}
                  <span class="chevron-sm">▾</span>
                </td>
                <td class="right td-fee">
                  <template v-if="parseFloat(tx.fee)">
                    -${{ parseFloat(tx.fee).toFixed(2) }}
                    <span class="chevron-sm">▾</span>
                  </template>
                  <template v-else>—</template>
                </td>
                <td class="right td-net" style="font-weight: 700">
                  ${{ Math.abs(parseFloat(tx.net)).toFixed(2) }}
                  <span style="font-weight: normal; font-size: 11px">USD</span>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="paymentStore.balanceTransactions.length === 0" class="empty">
            No balance transactions found.
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
import { onMounted, watch } from "vue";
import { useFormStore } from "../../stores/form";
import { usePaymentStore } from "../../stores/payment";

const formStore = useFormStore();
const paymentStore = usePaymentStore();

onMounted(() => {
  if (formStore.storeId) {
    const token = resolveToken(formStore.storeId);
    if (token) paymentStore.fetchBalanceTransactions(formStore.storeId, token);
  }
});

watch(
  () => formStore.storeId,
  () => {
    if (formStore.storeId) {
      const token = resolveToken(formStore.storeId);
      if (token) paymentStore.fetchBalanceTransactions(formStore.storeId, token);
    }
  },
);

function resolveToken(sid: string): string | null {
  // Use raw document.cookie fallback if outside Nuxt context, but we are client side anyway
  const storeCookie = useCookie<any>(sid);
  const data = storeCookie.value;
  const now = Date.now();
  if (data?.accessToken && data?.expiresTime && now < data.expiresTime) {
    return data.accessToken;
  }
  return null;
}

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

function getPayoutDate(tx: any) {
  // Balance transactions might not have expected payout date natively embedded on them.
  // Using processed_at or a placeholder for now, Shopify API payout transactions usually
  // need combining with Payouts to get the exact scheduled date, or it may be omitted.
  if (tx.payout_id && tx.payout_status === "paid") {
    // A paid transaction's processed date is close to payout date
    // We just format a mock or available date.
    return fmtDate(tx.processed_at); // fallback
  }
  return "Pending...";
}

function capitalize(s: string) {
  if (!s) return "";
  return (
    String(s).charAt(0).toUpperCase() + String(s).slice(1).replace(/_/g, " ")
  );
}

function getOrderNumber(tx: any) {
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

/* Common table and page styles from payment */
.screen {
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
.page-title {
  font-size: 20px;
  font-weight: 600;
  color: #1a1a1a;
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
  background: #fff;
  color: #1a1a1a;
  border: 1px solid #e5e5e5;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}
.btn-secondary:hover {
  background: #f6f6f6;
}

.card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  margin-bottom: 16px;
}

.table-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e5e5;
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
  border-bottom: 1px solid #e5e5e5;
  white-space: nowrap;
}
thead th.right {
  text-align: right;
}
tbody tr {
  border-bottom: 1px solid #e5e5e5;
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

.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.6;
}
.badge-deposited {
  background: #f3f3f3;
  color: #6d6d6d;
}
.badge-pending {
  background: #e6f6fb;
  color: #02658c;
}

.td-date {
  color: #555;
}
.td-order a {
  color: #0070f3;
  font-weight: 500;
  cursor: pointer;
}
.td-order a:hover {
  text-decoration: underline;
}

.card-brand {
  display: inline-flex;
  align-items: center;
  background: #fff;
  border: 1px solid #e5e5e5;
  font-size: 9px;
  font-weight: 700;
  padding: 2px 5px;
  border-radius: 3px;
  color: #333;
  text-transform: uppercase;
}

.td-fee {
  color: #555;
  font-weight: 500;
}
.td-net {
  font-weight: 700;
}

.empty {
  text-align: center;
  padding: 32px;
  color: #8c8c8c;
  font-size: 13px;
}
.error {
  color: #e51c00;
}

.pagination {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 10px 16px;
  border-top: 1px solid #e5e5e5;
}
.pag-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: 1px solid #e5e5e5;
  background: transparent;
  color: #6d6d6d;
}
.link {
  color: #0070f3;
  cursor: pointer;
}
.link:hover {
  text-decoration: underline;
}
</style>
