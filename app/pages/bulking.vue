<script lang="ts" setup>
import { useFormStore } from "~/stores/form";
import { ref, watch, onMounted } from "vue";
import { useCookie } from "#imports";
import { useSheetService } from "~/composables/useSheetService";
import {
  BUFF1_SHEET_URL,
  BUFF2_SHEET_URL,
  QUAN_LY_SHEET_URL,
} from "~~/utils/sheets";

definePageMeta({ layout: false });

const formStore = useFormStore();
const { readSheetValues, updateSheetValues, normalizeSpreadsheetId } = useSheetService();

onMounted(() => {
  formStore.loadKnownStores();
});

// Model for our store table representation
function getStoreInfo(id: string) {
  const cookie = useCookie<any>(id);
  const data = cookie.value;
  return {
    id,
    domain: data?.domain || "",
    accessToken: data?.accessToken || "",
    payoutDate: "",
    payoutStatus: "",
  };
}

const storeList = ref<ReturnType<typeof getStoreInfo>[]>([]);

// Sync internal storeList with knownStores
watch(
  () => formStore.knownStores,
  (newStores) => {
    storeList.value = newStores.map(getStoreInfo);
  },
  { immediate: true }
);

const isUpdatingDate = ref(false);
const isUpdatingStatus = ref(false);

async function updatePayoutDate() {
  isUpdatingDate.value = true;
  for (const store of storeList.value) {
    if (!store.accessToken) {
      store.payoutDate = "No token";
      continue;
    }
    store.payoutDate = "Fetching...";
    try {
      const res: any = await $fetch("/api/payment/payout/all", {
        method: "POST",
        body: { storeId: store.id, token: store.accessToken },
      });
      if (res.payouts && res.payouts.length > 0) {
        const payoutDate = res.payouts[0].date;
        store.payoutDate = payoutDate;

        // Sync with Google Sheets
        let foundIndex = -1;
        let targetRangeSheet = "";
        let usedSpreadsheetId = "";

        const buff1Rows = await readSheetValues({ 
          spreadsheetId: normalizeSpreadsheetId(BUFF1_SHEET_URL), 
          range: "'order 1'!A:Z" 
        });
        
        foundIndex = buff1Rows.findIndex(r => r[3]?.trim().toLowerCase() === store.domain.toLowerCase());
        
        if (foundIndex !== -1) {
          targetRangeSheet = "'order 1'";
          usedSpreadsheetId = BUFF1_SHEET_URL;
        } else {
          const buff2Rows = await readSheetValues({ 
            spreadsheetId: normalizeSpreadsheetId(BUFF2_SHEET_URL), 
            range: "'Sheet1'!A:Z" 
          });
          foundIndex = buff2Rows.findIndex(r => r[3]?.trim().toLowerCase() === store.domain.toLowerCase());
          if (foundIndex !== -1) {
            targetRangeSheet = "'Sheet1'";
            usedSpreadsheetId = BUFF2_SHEET_URL;
          }
        }

        if (foundIndex !== -1 && targetRangeSheet) {
          const actualRow = foundIndex + 1; // Convert to 1-indexed Google Sheet row
          await updateSheetValues({
            spreadsheetId: normalizeSpreadsheetId(usedSpreadsheetId),
            range: `${targetRangeSheet}!B${actualRow}:B${actualRow}`,
            values: [["Ordered"]]
          });
          await updateSheetValues({
            spreadsheetId: normalizeSpreadsheetId(usedSpreadsheetId),
            range: `${targetRangeSheet}!L${actualRow}:L${actualRow}`,
            values: [[payoutDate]]
          });
        }
      } else {
        store.payoutDate = "No payouts";
      }
    } catch (e: any) {
      store.payoutDate = "Error";
    }
  }
  isUpdatingDate.value = false;
}

async function updatePayoutStatus() {
  isUpdatingStatus.value = true;
  for (const store of storeList.value) {
    if (!store.accessToken) {
      store.payoutStatus = "No token";
      continue;
    }
    store.payoutStatus = "Fetching...";
    try {
      const res: any = await $fetch("/api/payment/payout/all", {
        method: "POST",
        body: { storeId: store.id, token: store.accessToken },
      });
      if (res.payouts && res.payouts.length > 0) {
        const payoutStatus = res.payouts[0].status;
        store.payoutStatus = payoutStatus;

        // Update Quản Lý sheet
        const quanLyRows = await readSheetValues({
          spreadsheetId: normalizeSpreadsheetId(QUAN_LY_SHEET_URL),
          range: "'quản lý'!A:Z"
        });

        // Domain is in col C (index 2)
        const foundIndex = quanLyRows.findIndex(r => r[2]?.trim().toLowerCase() === store.domain.toLowerCase());
        if (foundIndex !== -1) {
          const actualRow = foundIndex + 1;
          await updateSheetValues({
            spreadsheetId: normalizeSpreadsheetId(QUAN_LY_SHEET_URL),
            range: `'quản lý'!J${actualRow}:J${actualRow}`,
            values: [[payoutStatus]] // Col J
          });
        }
      } else {
        store.payoutStatus = "No Payouts";
      }
    } catch (e: any) {
      store.payoutStatus = "Error";
    }
  }
  isUpdatingStatus.value = false;
}
</script>

<template>
  <div class="bulking-page">
    <div class="page-header">
      <h1 class="page-title">Bulking Payouts</h1>
      <p class="page-sub">Bulk view/update payouts for all active stores</p>
    </div>

    <!-- Actions and Table -->
    <section class="card">
      <div class="card-head">
        <div class="card-actions-row">
          <button class="btn-primary bulk-action-btn" :disabled="isUpdatingDate" @click="updatePayoutDate">
            <span v-if="isUpdatingDate" class="spinner-sm" />
            <span v-else>📅</span>
            {{ isUpdatingDate ? 'Fetching & Updating Date...' : 'Update Payout Date' }}
          </button>
          <button class="btn-secondary bulk-action-btn" :disabled="isUpdatingStatus" @click="updatePayoutStatus">
            <span v-if="isUpdatingStatus" class="spinner-sm" />
            <span v-else>✓</span>
            {{ isUpdatingStatus ? 'Fetching & Updating Status...' : 'Update Payout Status' }}
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
              <th>Processed At</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="store in storeList" :key="store.id">
              <td>{{ store.id }}</td>
              <td>{{ store.domain || "(No domain)" }}</td>
              <td>
                <span 
                  v-if="store.payoutDate"
                  class="tag" 
                  :class="{
                    'tag-ok': store.payoutDate && store.payoutDate !== 'Error' && !store.payoutDate.includes('No'), 
                    'tag-err': store.payoutDate === 'Error' || store.payoutDate.includes('No')
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
                    'tag-ok': store.payoutStatus && store.payoutStatus !== 'Error' && !store.payoutStatus.includes('No'), 
                    'tag-err': store.payoutStatus === 'Error' || store.payoutStatus.includes('No')
                  }"
                >
                  {{ store.payoutStatus }}
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
  </div>
</template>

<style scoped>
.bulking-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 28px 20px 48px;
  font-size: 14px;
}
.page-header {
  margin-bottom: 24px;
}
.page-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 4px;
}
.page-sub {
  font-size: 13px;
  color: var(--text-secondary, #6d6d6d);
}
.card {
  background: var(--surface);
  border-radius: var(--radius, 8px);
  box-shadow: var(--shadow);
  margin-bottom: 20px;
}
.card-head {
  padding: 16px 18px;
  border-bottom: 1px solid var(--border);
}
.card-actions-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.bulk-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  padding: 10px 20px;
  border-radius: 6px;
  transition: all 0.2s ease;
  font-size: 14px;
}
.btn-secondary {
  background: var(--surface-hover, #f0f0f0);
  color: var(--text-primary);
  border: 1px solid var(--border);
  cursor: pointer;
}
.btn-secondary:hover:not(:disabled) {
  background: var(--border);
}
.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.table-container {
  overflow-x: auto;
}
.spinner-sm {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  display: inline-block;
}
.btn-secondary .spinner-sm {
  border: 2px solid rgba(0, 0, 0, 0.2);
  border-top-color: currentColor;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.bulking-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}
.bulking-table th, .bulking-table td {
  padding: 12px 18px;
  border-bottom: 1px solid var(--border);
}
.bulking-table th {
  font-weight: 600;
  color: var(--text-secondary);
}
.empty-state {
  padding: 30px;
  text-align: center;
  color: var(--text-secondary);
}
</style>
