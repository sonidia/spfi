<script lang="ts" setup>
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
const {
  readSheetValues,
  updateSheetValues,
  batchUpdateSheetValues,
  normalizeSpreadsheetId,
} = useSheetService();

onMounted(() => {
  formStore.loadKnownStores();
  // Automatically load sheet names after 3 seconds
  setTimeout(() => {
    loadPayouts();
  }, 3000);
});

// Sync internal storeList with knownStores and paymentStore
const storeList = computed(() => {
  return formStore.knownStores.map((id) => {
    const cookie = useLocalStorage<any>(id, {}).state;
    const data = cookie.value;
    const cached: any = paymentStore.bulkingPayouts[id] || {};
    return {
      id,
      domain: data?.domain || "",
      accessToken: data?.accessToken || "",
      proxy: data?.sock || "",
      sheet: data?.sheet || cached.sheet || "",
    };
  });
});

const isUpdating = ref(false);
const isSyncingDate = ref(false);
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

  // Check cache first
  const cached = paymentStore.bulkingTransactions[store.id];
  if (cached) {
    transactions.value = cached;
    return;
  }

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
    const mappedTransactions = (txRes.transactions || [])
      .filter((tx: any) => tx.type !== "payout")
      .map((tx: any) => {
        const orderData = orderMap.get(String(tx.source_order_id));
        return {
          ...tx,
          orderName:
            orderData?.name || tx.source_order_id || tx.source_id || "N/A",
          customerName: orderData?.customer || "-",
        };
      });

    transactions.value = mappedTransactions;
    // Save to store for reuse
    paymentStore.setBulkingTransactions(store.id, mappedTransactions);
  } catch (err) {
    console.error("Error fetching transactions:", err);
  } finally {
    isLoadingTransactions.value = false;
  }
}

async function loadPayouts() {
  // Only load if there are stores without a sheet name in cookie
  const missingSheetStores = storeList.value.filter((s) => !s.sheet && s.domain);
  if (missingSheetStores.length === 0) return;

  isLoadingPayouts.value = true;
  try {
    const [b1Results, b2Results] = await Promise.allSettled([
      readSheetValues({
        spreadsheetId: normalizeSpreadsheetId(BUFF1_SHEET_URL),
        range: "'order 1'!A:Z",
      }),
      readSheetValues({
        spreadsheetId: normalizeSpreadsheetId(BUFF2_SHEET_URL),
        range: "'Sheet1'!A:Z",
      }),
    ]);

    const buff1Rows = b1Results.status === "fulfilled" ? b1Results.value : [];
    const buff2Rows = b2Results.status === "fulfilled" ? b2Results.value : [];

    for (const store of missingSheetStores) {
      const domainLower = store.domain.toLowerCase();

      // Find which sheet contains the domain
      let sheetName = "";
      const inBuff1 = buff1Rows.some(
        (r) => r[3]?.trim().toLowerCase() === domainLower,
      );
      if (inBuff1) {
        sheetName = "$ buff1";
      } else {
        const inBuff2 = buff2Rows.some(
          (r) => r[3]?.trim().toLowerCase() === domainLower,
        );
        if (inBuff2) {
          sheetName = "$ buff2";
        }
      }

      if (sheetName) {
        // Save to cookie for persistence across sessions
        const cookie = useLocalStorage<any>(store.id, {}, { ttl: 60 * 60 * 24 * 365 * 10 * 1000 }).state;
        cookie.value = { ...cookie.value, sheet: sheetName };

        // Also update local store for immediate UI update if needed
        paymentStore.setBulkingPayout(store.id, {
          date: "",
          status: "",
          sheet: sheetName,
        });
      }
    }
  } catch (err) {
    console.error("Error loading payouts from spreadsheet:", err);
  } finally {
    isLoadingPayouts.value = false;
  }
}

async function updatePayouts() {
  isUpdating.value = true;

  // Load sheets selectively based on what's needed
  const needsBuff1 = storeList.value.some((s) => s.sheet === "$ buff1");
  const needsBuff2 = storeList.value.some((s) => s.sheet === "$ buff2");

  let buff1Rows: any[] = [];
  let buff2Rows: any[] = [];
  let quanLyRows: any[] = [];

  try {
    const sheetPromises = [
      readSheetValues({
        spreadsheetId: normalizeSpreadsheetId(QUAN_LY_SHEET_URL),
        range: "'quản lý'!A:Z",
      }),
    ];

    if (needsBuff1) {
      sheetPromises.push(
        readSheetValues({
          spreadsheetId: normalizeSpreadsheetId(BUFF1_SHEET_URL),
          range: "'order 1'!A:Z",
        }),
      );
    }

    if (needsBuff2) {
      sheetPromises.push(
        readSheetValues({
          spreadsheetId: normalizeSpreadsheetId(BUFF2_SHEET_URL),
          range: "'Sheet1'!A:Z",
        }),
      );
    }

    const results = await Promise.allSettled(sheetPromises);

    let idx = 0;
    if (results[idx]?.status === "fulfilled") {
      quanLyRows = (results[idx] as PromiseFulfilledResult<any>).value;
    }
    idx++;

    if (needsBuff1) {
      if (results[idx]?.status === "fulfilled") {
        buff1Rows = (results[idx] as PromiseFulfilledResult<any>).value;
      }
      idx++;
    }

    if (needsBuff2) {
      if (results[idx]?.status === "fulfilled") {
        buff2Rows = (results[idx] as PromiseFulfilledResult<any>).value;
      }
      idx++;
    }
  } catch (e) {
    console.error("Failed to load some sheets for syncing", e);
  }

  const buff1Updates: any[] = [];
  const buff2Updates: any[] = [];
  const quanLyUpdates: any[] = [];

  for (const store of storeList.value) {
    if (!store.accessToken) {
      paymentStore.setBulkingPayout(store.id, {
        date: "No token",
        status: "No token",
        sheet: store.sheet,
      });
      continue;
    }
    paymentStore.setBulkingPayout(store.id, {
      date: "Fetching...",
      status: "Fetching...",
      sheet: store.sheet,
    });
    try {
      const res: any = await $fetch("/api/payment/payout/all", {
        method: "POST",
        body: { storeId: store.id, token: store.accessToken },
      });
      if (res.payouts && res.payouts.length > 0) {
        // 1. Process all payouts to sync with sheets
        for (const payout of res.payouts) {
          const payoutDate = payout.date;
          let payoutStatus = payout.status.toLowerCase();

          if (payoutStatus === "paid") {
            payoutStatus = "Deposited";
          } else {
            payoutStatus =
              payoutStatus.charAt(0).toUpperCase() + payoutStatus.slice(1);
          }

          // B. Sync with Management Sheet
          // Format payout date from YYYY-MM-DD to DD/MM
          const [p_year, p_month, p_day] = payoutDate.split("-");
          const formattedDate = `${p_day}/${p_month}`;

          const quanLyIndex = quanLyRows.findIndex(
            (r) =>
              r[2]?.trim().toLowerCase() === store.domain.toLowerCase() &&
              r[0]?.trim() === formattedDate,
          );

          if (quanLyIndex !== -1) {
            const actualRow = quanLyIndex + 1;
            quanLyUpdates.push({
              range: `'quản lý'!J${actualRow}:J${actualRow}`,
              values: [[payoutStatus]],
            });

            // Check if domain is in Buff1 or Buff2 to determine column
            const inBuff1 = buff1Rows.some(
              (r) => r[3]?.trim().toLowerCase() === store.domain.toLowerCase(),
            );
            const inBuff2 = buff2Rows.some(
              (r) => r[3]?.trim().toLowerCase() === store.domain.toLowerCase(),
            );

            if (inBuff1) {
              quanLyUpdates.push({
                range: `'quản lý'!E${actualRow}:E${actualRow}`,
                values: [[payout.amount]],
              });
            } else if (inBuff2) {
              quanLyUpdates.push({
                range: `'quản lý'!F${actualRow}:F${actualRow}`,
                values: [[payout.amount]],
              });
            }
          }
        }

        // 2. Update store with the most recent payout for UI display
        const sortedPayouts = [...res.payouts].sort(
          (a: any, b: any) =>
            new Date(b.date).getTime() - new Date(a.date).getTime(),
        );
        const latestPayout = sortedPayouts[0];
        let latestStatus = latestPayout.status.toLowerCase();
        if (latestStatus === "paid") {
          latestStatus = "Deposited";
        } else {
          latestStatus =
            latestStatus.charAt(0).toUpperCase() + latestStatus.slice(1);
        }

        paymentStore.setBulkingPayout(store.id, {
          date: latestPayout.date,
          status: latestStatus,
          sheet: store.sheet,
        });
      } else {
        paymentStore.setBulkingPayout(store.id, {
          date: "No payouts",
          status: "No Payouts",
          sheet: store.sheet,
        });
      }
    } catch (e: any) {
      paymentStore.setBulkingPayout(store.id, {
        date: "Error",
        status: "Error",
        sheet: store.sheet,
      });
    }
  }

  // Final batch updates to reduce API requests
  try {
    const batchPromises = [];
    if (quanLyUpdates.length > 0) {
      batchPromises.push(
        batchUpdateSheetValues({
          spreadsheetId: normalizeSpreadsheetId(QUAN_LY_SHEET_URL),
          data: quanLyUpdates,
        }),
      );
    }
    await Promise.allSettled(batchPromises);
  } catch (e) {
    console.error("Failed to execute some batch updates", e);
  }

  isUpdating.value = false;
}

async function syncPayoutDates() {
  isSyncingDate.value = true;

  const needsBuff1 = storeList.value.some((s) => s.sheet === "$ buff1");
  const needsBuff2 = storeList.value.some((s) => s.sheet === "$ buff2");

  let buff1Rows: any[] = [];
  let buff2Rows: any[] = [];

  try {
    const sheetPromises = [];
    if (needsBuff1) {
      sheetPromises.push(
        readSheetValues({
          spreadsheetId: normalizeSpreadsheetId(BUFF1_SHEET_URL),
          range: "'order 1'!A:Z",
        }),
      );
    }
    if (needsBuff2) {
      sheetPromises.push(
        readSheetValues({
          spreadsheetId: normalizeSpreadsheetId(BUFF2_SHEET_URL),
          range: "'Sheet1'!A:Z",
        }),
      );
    }

    const results = await Promise.allSettled(sheetPromises);
    let idx = 0;
    if (needsBuff1) {
      if (results[idx]?.status === "fulfilled") {
        buff1Rows = (results[idx] as PromiseFulfilledResult<any>).value;
      }
      idx++;
    }
    if (needsBuff2) {
      if (results[idx]?.status === "fulfilled") {
        buff2Rows = (results[idx] as PromiseFulfilledResult<any>).value;
      }
      idx++;
    }
  } catch (e) {
    console.error("Failed to load Buff sheets for date syncing", e);
  }

  const buff1Updates: any[] = [];
  const buff2Updates: any[] = [];

  for (const store of storeList.value) {
    if (!store.accessToken) continue;

    try {
      // Fetch payouts, transactions, and orders in parallel for efficiency
      const [payoutRes, txRes, orderRes]: any = await Promise.all([
        $fetch("/api/payment/payout/all", {
          method: "POST",
          body: { storeId: store.id, token: store.accessToken },
        }),
        $fetch("/api/payment/payout/transactions", {
          method: "POST",
          body: { storeId: store.id, token: store.accessToken },
        }),
        $fetch("/api/order/all", {
          method: "POST",
          body: { storeId: store.id, token: store.accessToken },
        }),
      ]);

      if (!payoutRes.payouts || payoutRes.payouts.length === 0) continue;

      // Map orders for customer names
      const orderMap = new Map();
      if (orderRes && orderRes.orders) {
        orderRes.orders.forEach((o: any) => {
          const customerName = o.customer
            ? `${o.customer.first_name || ""} ${o.customer.last_name || ""}`.trim()
            : "";
          orderMap.set(String(o.id), customerName);
        });
      }

      // Group payouts by ID for easy access to their date
      const payoutMap = new Map();
      payoutRes.payouts.forEach((p: any) => {
        payoutMap.set(String(p.id), p.date);
      });

      // Filter transactions that have a payout_id and map to customer
      const transactions = (txRes.transactions || [])
        .filter((tx: any) => tx.payout_id)
        .map((tx: any) => {
          return {
            payoutId: String(tx.payout_id),
            customerName: orderMap.get(String(tx.source_order_id)) || "",
          };
        })
        .filter((tx: any) => tx.customerName);

      // Determine which buff rows to search
      let targetRows = [];
      let targetRangeSheet = "";
      let isBuff1 = false;
      let isBuff2 = false;

      if (store.sheet === "$ buff1") {
        targetRows = buff1Rows;
        targetRangeSheet = "'order 1'";
        isBuff1 = true;
      } else if (store.sheet === "$ buff2") {
        targetRows = buff2Rows;
        targetRangeSheet = "'Sheet1'";
        isBuff2 = true;
      } else {
        // Fallback search if sheet not set
        const inBuff1 = buff1Rows.some(
          (r) => r[3]?.trim().toLowerCase() === store.domain.toLowerCase(),
        );
        if (inBuff1) {
          targetRows = buff1Rows;
          targetRangeSheet = "'order 1'";
          isBuff1 = true;
        } else {
          targetRows = buff2Rows;
          targetRangeSheet = "'Sheet1'";
          isBuff2 = true;
        }
      }

      for (const tx of transactions) {
        const payoutDate = payoutMap.get(tx.payoutId);
        if (!payoutDate) continue;

        // Search in targetRows (index 7 is Column H: INFO/Customer details)
        // Find ALL rows that contain the customer name
        targetRows.forEach((row, index) => {
          const customerInSheet = String(row[7] || "").toLowerCase();
          if (
            tx.customerName &&
            customerInSheet.includes(tx.customerName.toLowerCase())
          ) {
            const actualRow = index + 1;
            const updateItem = {
              range: `${targetRangeSheet}!L${actualRow}:L${actualRow}`,
              values: [[payoutDate]],
            };

            if (isBuff1) {
              buff1Updates.push(updateItem);
            } else if (isBuff2) {
              buff2Updates.push(updateItem);
            }
          }
        });
      }
    } catch (e) {
      console.error(`Error syncing dates for store ${store.domain}:`, e);
    }
  }

  // Final batch updates
  try {
    const batchPromises = [];
    if (buff1Updates.length > 0) {
      batchPromises.push(
        batchUpdateSheetValues({
          spreadsheetId: normalizeSpreadsheetId(BUFF1_SHEET_URL),
          data: buff1Updates,
        }),
      );
    }
    if (buff2Updates.length > 0) {
      batchPromises.push(
        batchUpdateSheetValues({
          spreadsheetId: normalizeSpreadsheetId(BUFF2_SHEET_URL),
          data: buff2Updates,
        }),
      );
    }
    await Promise.allSettled(batchPromises);
  } catch (e) {
    console.error("Failed to execute date batch updates", e);
  }

  isSyncingDate.value = false;
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
            class="btn-primary bulk-action-btn"
            :class="{ 'blur-effect': isLoadingPayouts }"
            :disabled="isUpdating || isSyncingDate || isLoadingPayouts"
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
          <button
            class="btn-outline bulk-action-btn"
            :class="{ 'blur-effect': isLoadingPayouts }"
            :disabled="isUpdating || isSyncingDate || isLoadingPayouts"
            @click="syncPayoutDates"
          >
            <span v-if="isSyncingDate" class="spinner-sm" />
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
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            {{ isSyncingDate ? "Syncing Date..." : "Sync Date" }}
          </button>
        </div>
      </div>
      <div v-if="storeList.length" class="table-container">
        <table class="bulking-table">
          <thead>
            <tr>
              <th>Domain</th>
              <th>Proxy</th>
              <th>Sheet</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="store in storeList"
              :key="store.id"
              class="clickable-row"
              @click="openPayoutDetails(store)"
            >
              <td>{{ store.domain || "(No domain)" }}</td>
              <td>{{ store.proxy || "-" }}</td>
              <td>
                <span v-if="isLoadingPayouts" class="tag tag-pending">Loading...</span>
                <span v-else-if="store.sheet" class="tag tag-ok">{{
                  store.sheet
                }}</span>
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
                <th>Net</th>
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
                <td>{{ tx.net }} {{ tx.currency }}</td>
                <td>
                  <span class="payout-id-tag">{{ tx.payout_id || "-" }}</span>
                </td>
                <td>{{ new Date(tx.processed_at).toLocaleDateString() }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="modal-empty">
          No transactions found for this store.
        </div>
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

.blur-effect {
  filter: blur(1.5px);
  opacity: 0.6;
  pointer-events: none;
}
</style>
