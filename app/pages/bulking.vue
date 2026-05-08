<script lang="ts" setup>
import { useCookie } from "#imports";
import { onMounted, ref } from "vue";
import { useSheetService } from "~/composables/useSheetService";
import { useFormStore } from "~/stores/form";
import { usePaymentStore } from "~/stores/payment";
import {
  BUFF1_SHEET_URL,
  BUFF2_SHEET_URL,
  QUAN_LY_SHEET_URL,
} from "~~/utils/sheets";

definePageMeta({ layout: false });

const formStore = useFormStore();
const paymentStore = usePaymentStore();
const { readSheetValues, updateSheetValues, normalizeSpreadsheetId } =
  useSheetService();

onMounted(() => {
  formStore.loadKnownStores();
});

// Sync internal storeList with knownStores and paymentStore
const storeList = computed(() => {
  return formStore.knownStores.map((id) => {
    const cookie = useCookie<any>(id);
    const data = cookie.value;
    const cached: any = paymentStore.bulkingPayouts[id] || {};
    return {
      id,
      domain: data?.domain || "",
      accessToken: data?.accessToken || "",
      payoutDate: cached.date || "",
      payoutStatus: cached.status || "",
    };
  });
});

const isUpdating = ref(false);
const isLoadingPayouts = ref(false);

// Modal and Transaction State
const isModalOpen = ref(false);
const selectedStore = ref<any>(null);
const transactions = ref<any[]>([]);
const isLoadingTransactions = ref(false);

async function openPayoutDetails(store: any) {
  if (!store.accessToken) return;
  selectedStore.value = store;
  isModalOpen.value = true;
  isLoadingTransactions.value = true;
  transactions.value = [];

  try {
    // Fetch both transactions and orders in parallel
    const [txRes, orderRes]: any = await Promise.all([
      $fetch("/api/payment/payout/transactions", {
        method: "POST",
        body: { storeId: store.id, token: store.accessToken },
      }),
      $fetch("/api/order/all", {
        method: "POST",
        body: { storeId: store.id, token: store.accessToken },
      }),
    ]);

    // Create a map of order ID to order details
    const orderMap = new Map();
    if (orderRes && orderRes.orders) {
      orderRes.orders.forEach((o: any) => {
        const customerName = o.customer
          ? `${o.customer.first_name || ""} ${o.customer.last_name || ""}`.trim()
          : "Guest";
        orderMap.set(String(o.id), {
          name: o.name,
          customer: customerName,
        });
      });
    }

    // Filter and map transactions
    transactions.value = (txRes.transactions || [])
      .filter((tx: any) => tx.type !== "payout")
      .map((tx: any) => {
        const orderData = orderMap.get(String(tx.source_order_id));
        return {
          ...tx,
          orderName: orderData?.name || tx.source_order_id || tx.source_id || "N/A",
          customerName: orderData?.customer || "-",
        };
      });
  } catch (err) {
    console.error("Error fetching transactions:", err);
  } finally {
    isLoadingTransactions.value = false;
  }
}

async function loadPayouts() {
  isLoadingPayouts.value = true;
  try {
    const buff1Rows = await readSheetValues({
      spreadsheetId: normalizeSpreadsheetId(BUFF1_SHEET_URL),
      range: "'order 1'!A:Z",
    }).catch(() => []);

    const buff2Rows = await readSheetValues({
      spreadsheetId: normalizeSpreadsheetId(BUFF2_SHEET_URL),
      range: "'Sheet1'!A:Z",
    }).catch(() => []);

    const quanLyRows = await readSheetValues({
      spreadsheetId: normalizeSpreadsheetId(QUAN_LY_SHEET_URL),
      range: "'quản lý'!A:Z",
    }).catch(() => []);

    for (const store of storeList.value) {
      if (!store.domain) continue;

      const domainLower = store.domain.toLowerCase();

      // Read payout date
      let date = "";
      let foundDate = buff1Rows.find(
        (r) => r[3]?.trim().toLowerCase() === domainLower,
      );
      if (foundDate) {
        date = foundDate[11] || ""; // L is 11
      } else {
        foundDate = buff2Rows.find(
          (r) => r[3]?.trim().toLowerCase() === domainLower,
        );
        if (foundDate) {
          date = foundDate[11] || "";
        }
      }

      // Read payout status
      let status = "";
      const foundStatus = quanLyRows.find(
        (r) => r[2]?.trim().toLowerCase() === domainLower,
      );
      if (foundStatus && foundStatus[9]) {
        // J is 9
        status = foundStatus[9];
      }

      // Save to store for persistence
      paymentStore.setBulkingPayout(store.id, {
        date: date || store.payoutDate,
        status: status || store.payoutStatus,
      });
    }
  } catch (err) {
    console.error("Error loading payouts from spreadsheet:", err);
  } finally {
    isLoadingPayouts.value = false;
  }
}

async function updatePayouts() {
  isUpdating.value = true;

  // Load sheets once to avoid rate limits
  let buff1Rows: any[] = [];
  let buff2Rows: any[] = [];
  let quanLyRows: any[] = [];

  try {
    buff1Rows = await readSheetValues({
      spreadsheetId: normalizeSpreadsheetId(BUFF1_SHEET_URL),
      range: "'order 1'!A:Z",
    });
    buff2Rows = await readSheetValues({
      spreadsheetId: normalizeSpreadsheetId(BUFF2_SHEET_URL),
      range: "'Sheet1'!A:Z",
    });
    quanLyRows = await readSheetValues({
      spreadsheetId: normalizeSpreadsheetId(QUAN_LY_SHEET_URL),
      range: "'quản lý'!A:Z",
    });
  } catch (e) {
    console.error("Failed to load sheets for syncing", e);
  }

  for (const store of storeList.value) {
    if (!store.accessToken) {
      paymentStore.setBulkingPayout(store.id, {
        date: "No token",
        status: "No token",
      });
      continue;
    }
    paymentStore.setBulkingPayout(store.id, {
      date: "Fetching...",
      status: "Fetching...",
    });
    try {
      const res: any = await $fetch("/api/payment/payout/all", {
        method: "POST",
        body: { storeId: store.id, token: store.accessToken },
      });
      if (res.payouts && res.payouts.length > 0) {
        // Sort by date descending to get the most recent payout
        const sortedPayouts = [...res.payouts].sort(
          (a: any, b: any) =>
            new Date(b.date).getTime() - new Date(a.date).getTime(),
        );
        const payout = sortedPayouts[0];
        const payoutDate = payout.date;
        let payoutStatus = payout.status.toLowerCase();

        if (payoutStatus === "paid") {
          payoutStatus = "Deposited";
        } else {
          payoutStatus =
            payoutStatus.charAt(0).toUpperCase() + payoutStatus.slice(1);
        }

        // Save to store for persistence
        paymentStore.setBulkingPayout(store.id, {
          date: payoutDate,
          status: payoutStatus,
        });

        // 1. Sync Date with Buff Sheets
        let foundIndex = -1;
        let targetRangeSheet = "";
        let usedSpreadsheetId = "";

        foundIndex = buff1Rows.findIndex(
          (r) => r[3]?.trim().toLowerCase() === store.domain.toLowerCase(),
        );

        if (foundIndex !== -1) {
          targetRangeSheet = "'order 1'";
          usedSpreadsheetId = BUFF1_SHEET_URL;
        } else {
          foundIndex = buff2Rows.findIndex(
            (r) => r[3]?.trim().toLowerCase() === store.domain.toLowerCase(),
          );
          if (foundIndex !== -1) {
            targetRangeSheet = "'Sheet1'";
            usedSpreadsheetId = BUFF2_SHEET_URL;
          }
        }

        if (foundIndex !== -1 && targetRangeSheet) {
          const actualRow = foundIndex + 1;
          await updateSheetValues({
            spreadsheetId: normalizeSpreadsheetId(usedSpreadsheetId),
            range: `${targetRangeSheet}!B${actualRow}:B${actualRow}`,
            values: [["Ordered"]],
          });
          await updateSheetValues({
            spreadsheetId: normalizeSpreadsheetId(usedSpreadsheetId),
            range: `${targetRangeSheet}!L${actualRow}:L${actualRow}`,
            values: [[payoutDate]],
          });
        }

        // 2. Sync Status with Quản Lý sheet
        const qlIndex = quanLyRows.findIndex(
          (r) => r[2]?.trim().toLowerCase() === store.domain.toLowerCase(),
        );
        if (qlIndex !== -1) {
          const actualRow = qlIndex + 1;
          await updateSheetValues({
            spreadsheetId: normalizeSpreadsheetId(QUAN_LY_SHEET_URL),
            range: `'quản lý'!J${actualRow}:J${actualRow}`,
            values: [[payoutStatus]],
          });
        }
      } else {
        paymentStore.setBulkingPayout(store.id, {
          date: "No payouts",
          status: "No Payouts",
        });
      }
    } catch (e: any) {
      paymentStore.setBulkingPayout(store.id, {
        date: "Error",
        status: "Error",
      });
    }
  }
  isUpdating.value = false;
}
</script>

<template>
  <div class="bulking-page">
    <PageHeader
      title="Bulking Payouts"
      sub="Bulk view and update payouts across all active stores"
    >
      <IconsBulking />
    </PageHeader>

    <!-- Actions and Table -->
    <section class="card">
      <div class="card-head">
        <div class="card-head-title">
          <span class="card-title">Payout Overview</span>
          <span v-if="storeList.length" class="count-badge">{{
            storeList.length
          }}</span>
        </div>
        <div class="card-actions-row">
          <button
            class="btn-outline bulk-action-btn"
            :disabled="isLoadingPayouts"
            @click="loadPayouts"
          >
            <span v-if="isLoadingPayouts" class="spinner-sm" />
            <svg
              v-else
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M23 4v6h-6"></path>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
            {{ isLoadingPayouts ? "Loading..." : "Load Payouts" }}
          </button>
          <button
            class="btn-primary bulk-action-btn"
            :disabled="isUpdating"
            @click="updatePayouts"
          >
            <span v-if="isUpdating" class="spinner-sm" />
            <svg
              v-else
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            {{ isUpdating ? "Syncing Payouts..." : "Sync Payouts" }}
          </button>
        </div>
      </div>
      <div v-if="storeList.length" class="table-container">
        <table class="bulking-table">
          <thead>
            <tr>
              <th>Store ID</th>
              <th>Domain</th>
              <th>Payout Date</th>
              <th>Payout Status</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="store in storeList"
              :key="store.id"
              class="clickable-row"
              @click="openPayoutDetails(store)"
            >
              <td>{{ store.id }}</td>
              <td>{{ store.domain || "(No domain)" }}</td>
              <td>
                <span
                  v-if="store.payoutDate"
                  class="tag"
                  :class="{
                    'tag-ok':
                      store.payoutDate &&
                      store.payoutDate !== 'Error' &&
                      !store.payoutDate.includes('No'),
                    'tag-err':
                      store.payoutDate === 'Error' ||
                      store.payoutDate.includes('No'),
                  }"
                >
                  {{ store.payoutDate }}
                </span>
                <span v-else>-</span>
              </td>
              <td>
                <span
                  v-if="store.payoutStatus"
                  class="tag"
                  :class="{
                    'tag-ok':
                      store.payoutStatus.toLowerCase() === 'paid' ||
                      store.payoutStatus.toLowerCase() === 'deposited',
                    'tag-pending':
                      store.payoutStatus.toLowerCase() === 'pending' ||
                      store.payoutStatus.toLowerCase() === 'scheduled',
                    'tag-err':
                      store.payoutStatus === 'Error' ||
                      store.payoutStatus.includes('No'),
                  }"
                >
                  {{
                    store.payoutStatus.toLowerCase() === "paid"
                      ? "Deposited"
                      : store.payoutStatus.charAt(0).toUpperCase() +
                        store.payoutStatus.slice(1).toLowerCase()
                  }}
                </span>
                <span v-else>-</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="empty-state">
        No stores configured yet. Please add a store in the connection manager.
      </div>
    </section>

    <!-- Payout Details Modal -->
    <SheetDataModal
      :open="isModalOpen"
      :title="`Payout Details: ${selectedStore?.domain || ''}`"
      @close="isModalOpen = false"
    >
      <div class="modal-content-inner">
        <div v-if="isLoadingTransactions" class="modal-loading">
          <span class="spinner" />
          <p>Loading transactions...</p>
        </div>
        <div v-else-if="transactions.length" class="modal-table-container">
          <table class="details-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Payout ID</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="tx in transactions" :key="tx.id">
                <td>
                  <span class="order-link">
                    {{ tx.orderName }}
                  </span>
                </td>
                <td class="customer-cell">{{ tx.customerName }}</td>
                <td>{{ tx.type }}</td>
                <td>{{ tx.amount }} {{ tx.currency }}</td>
                <td>
                  <span class="payout-id-tag">{{ tx.payout_id || "-" }}</span>
                </td>
                <td>{{ new Date(tx.processed_at).toLocaleDateString() }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="modal-empty">No transactions found for this store.</div>
      </div>
    </SheetDataModal>
  </div>
</template>

<style scoped>
.bulking-page {
  max-width: 1028px;
  margin: 0 auto;
  padding: 48px 24px;
}

.card {
  background: var(--surface);
  border-radius: 12px;
  box-shadow: var(--shadow);
  border: 1px solid var(--border);
  overflow: hidden;
}

.card-head {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
}

.card-head-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-title {
  font-weight: 600;
  font-size: 15px;
  color: #111;
}

.count-badge {
  background: #f0f0f4;
  color: #6b7280;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
}

.card-actions-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.bulk-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  padding: 8px 16px;
  border-radius: 8px;
  transition: all 0.2s ease;
  font-size: 13px;
  cursor: pointer;
  border: 1px solid transparent;
}

.btn-primary {
  background: var(--blue, #005bd3);
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  background: #004bb1;
}

.btn-outline {
  background: #fff;
  border: 1px solid var(--border);
  color: var(--text-primary);
}

.btn-outline:hover:not(:disabled) {
  background: #f9f9f9;
  border-color: #d1d1d1;
}

.bulk-action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.table-container {
  overflow-x: auto;
}

.bulking-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.bulking-table th {
  padding: 12px 20px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #6b7280;
  background: #f9f9fc;
  border-bottom: 1px solid var(--border);
}

.bulking-table td {
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
  font-size: 13.5px;
  color: #374151;
}

.bulking-table tr:last-child td {
  border-bottom: none;
}

.bulking-table tr:hover td {
  background: #f9f9fc;
}

.clickable-row {
  cursor: pointer;
}

.clickable-row:hover td {
  background: #f0f4ff !important;
}

/* Modal Table Styles */
.modal-content-inner {
  min-height: 200px;
  position: relative;
}

.modal-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #6b7280;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(0, 0, 0, 0.1);
  border-top-color: var(--blue, #005bd3);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 12px;
}

.modal-table-container {
  padding: 0;
}

.details-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.details-table th {
  text-align: left;
  padding: 12px 16px;
  background: #f9f9fc;
  border-bottom: 1px solid var(--border);
  color: #6b7280;
  font-weight: 600;
  position: sticky;
  top: 0;
}

.details-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  color: #374151;
}

.order-link {
  color: var(--blue, #005bd3);
  font-weight: 500;
}

.customer-cell {
  font-weight: 500;
  color: #111;
}

.payout-id-tag {
  font-family: monospace;
  font-size: 11px;
  background: #f3f4f6;
  padding: 2px 6px;
  border-radius: 4px;
}

.modal-empty {
  padding: 40px;
  text-align: center;
  color: #6b7280;
}

.tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.tag-ok {
  background: var(--badge-paid, #e4f2e8);
  color: var(--badge-paid-text, #1a7f37);
}

.tag-pending {
  background: var(--badge-scheduled, #fbf1e6);
  color: var(--badge-scheduled-text, #d97706);
}

.tag-err {
  background: var(--badge-cancelled, #fce8e8);
  color: var(--badge-cancelled-text, #c0392b);
}

.spinner-sm {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.btn-outline .spinner-sm {
  border-color: rgba(0, 0, 0, 0.1);
  border-top-color: #5b47e0;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.empty-state {
  padding: 64px 24px;
  text-align: center;
  color: #6b7280;
}
</style>
