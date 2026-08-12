<script setup lang="ts">
import {
  ExternalLink,
  FileSpreadsheet,
  Plus,
  TableProperties,
  Trash2,
} from "@lucide/vue";
import {
  defaultSheets,
  normalizeSheetEntries as normalizeStoredSheetEntries,
  SHEET_RECENT_STORAGE_KEY,
  type LegacyStoredSheet,
  type StoredSheet,
} from "~~/utils/sheets";

definePageMeta({ layout: false });

const { t } = useLocalization();
const { requestConfirmation } = useConfirmDialog();
const { state: sheetList, set: setSheetList } = useLocalStorage<
  (StoredSheet | LegacyStoredSheet)[]
>(SHEET_RECENT_STORAGE_KEY, []);
const {
  loading: sheetLoading,
  error: sheetError,
  headers: sheetHeaders,
  filteredRows: sheetFilteredRows,
  loadByInput,
  buildSheetLabel,
  buildRangeFromSheetName,
  loadMetaByInput,
} = useSheetService();

const sheetInputValue = ref("");
const selectedSheetRanges = ref<Record<string, string>>({});
const isSheetModalOpen = ref(false);
const sheetModalTitle = ref("");
const recentSheets = computed<StoredSheet[]>(() =>
  normalizeStoredSheetEntries(sheetList.value || [], buildSheetLabel),
);

function truncateUrl(url: string) {
  if (url.length <= 58) return url;
  return `${url.slice(0, 55)}…`;
}

function persistRecentSheets(items: StoredSheet[]) {
  setSheetList(items);
}

function upsertRecentSheet(entry: StoredSheet) {
  const existing = recentSheets.value.filter((sheet) => sheet.source !== entry.source);
  persistRecentSheets([
    {
      ...entry,
      ranges: Array.from(
        new Set(entry.ranges.map((range) => range.trim()).filter(Boolean)),
      ),
    },
    ...existing,
  ]);
}

function toRangeExpression(input?: string) {
  const value = String(input || "").trim();
  if (!value) return undefined;
  return value.includes("!") ? value : buildRangeFromSheetName(value);
}

function getSelectedSheetName(sheet: StoredSheet) {
  return selectedSheetRanges.value[sheet.source] || sheet.ranges[0] || "";
}

function setSelectedSheetName(source: string, sheetName: unknown) {
  selectedSheetRanges.value = {
    ...selectedSheetRanges.value,
    [source]: typeof sheetName === "string" ? sheetName : String(sheetName || ""),
  };
}

async function readSheetMetaSafe(source: string) {
  try {
    return await loadMetaByInput(source);
  } catch {
    return null;
  }
}

async function initializeDefaultSheets() {
  const normalized = normalizeStoredSheetEntries(
    sheetList.value || [],
    buildSheetLabel,
  );
  if (JSON.stringify(normalized) !== JSON.stringify(sheetList.value || [])) {
    persistRecentSheets(normalized);
  }
  if (normalized.length) return;

  const initialSheets: StoredSheet[] = [];
  for (const source of defaultSheets()) {
    const meta = await readSheetMetaSafe(source);
    if (!meta) continue;
    initialSheets.push({
      source,
      label: String(meta.title || "").trim() || buildSheetLabel(source),
      ranges: meta.sheets || [],
    });
  }
  persistRecentSheets(initialSheets);
}

async function addAndLoadSheet() {
  const source = sheetInputValue.value.trim();
  if (!source) return;

  await loadByInput(source);
  if (sheetError.value) return;

  const meta = await readSheetMetaSafe(source);
  const ranges = meta?.sheets?.length ? meta.sheets : [];
  upsertRecentSheet({
    source,
    label:
      String(meta?.title || "").trim() ||
      buildSheetLabel(source) ||
      `${source.slice(0, 16)}…`,
    ranges,
  });
  if (ranges[0]) setSelectedSheetName(source, ranges[0]);
  sheetInputValue.value = "";
}

async function loadSheetViewerData(sheet: StoredSheet) {
  const selectedSheetName = getSelectedSheetName(sheet);
  await loadByInput(sheet.source, toRangeExpression(selectedSheetName));
  if (sheetError.value) return;

  const meta = await readSheetMetaSafe(sheet.source);
  const ranges = meta?.sheets?.length
    ? meta.sheets
    : sheet.ranges.length
      ? sheet.ranges
      : [];
  upsertRecentSheet({
    source: sheet.source,
    label: String(meta?.title || "").trim() || sheet.label,
    ranges,
  });

  const nextSelectedSheetName = selectedSheetName || ranges[0];
  if (nextSelectedSheetName) {
    setSelectedSheetName(sheet.source, nextSelectedSheetName);
  }
  sheetModalTitle.value = selectedSheetName
    ? `${String(meta?.title || sheet.label)} • ${selectedSheetName}`
    : String(meta?.title || sheet.label);
  isSheetModalOpen.value = true;
}

async function removeRecentSheet(source: string) {
  const confirmed = await requestConfirmation({
    title: t("confirm.deleteTitle"),
    message: t("sheet.deleteRecentConfirm"),
    confirmLabel: t("common.delete"),
  });
  if (!confirmed) return;

  persistRecentSheets(recentSheets.value.filter((sheet) => sheet.source !== source));
  const nextSelected = { ...selectedSheetRanges.value };
  delete nextSelected[source];
  selectedSheetRanges.value = nextSelected;
}

onMounted(initializeDefaultSheets);
</script>

<template>
  <AdminPageShell
    title="Google Sheets"
    sub="Manage saved spreadsheets, selected tabs, and row previews"
    size="wide"
  >
    <template #icon>
      <FileSpreadsheet />
    </template>
    <template #actions>
      <span class="sheet-count">{{ recentSheets.length }} saved</span>
    </template>

    <section id="sheets" class="settings-sheet-card">
      <header class="sheet-card-heading">
        <span class="sheet-card-icon"><FileSpreadsheet /></span>
        <div>
          <h2>Google Sheets</h2>
          <p>Manage saved spreadsheets, select tabs and preview row data.</p>
        </div>
        <span class="sheet-count">{{ recentSheets.length }} saved</span>
      </header>

      <div class="sheet-card-body">
        <form class="sheet-add-form" @submit.prevent="addAndLoadSheet">
          <label>
            <span class="sr-only">Google Sheet URL or spreadsheet ID</span>
            <input
              v-model="sheetInputValue"
              type="text"
              autocomplete="off"
              spellcheck="false"
              placeholder="Google Sheet URL or Spreadsheet ID…"
            />
          </label>
          <BaseButton
            type="submit"
            variant="primary"
            size="medium"
            :loading="sheetLoading"
            :disabled="!sheetInputValue.trim()"
          >
            <template #icon><Plus /></template>
            Import sheet
          </BaseButton>
        </form>

        <p v-if="sheetError" class="sheet-alert" role="alert">{{ sheetError }}</p>

        <div v-if="recentSheets.length" class="sheet-list">
          <article v-for="sheet in recentSheets" :key="sheet.source" class="sheet-row">
            <span class="sheet-row-icon"><FileSpreadsheet /></span>
            <div class="sheet-copy">
              <strong>{{ sheet.label }}</strong>
              <span>
                <a :href="sheet.source" target="_blank" rel="noopener noreferrer">
                  {{ truncateUrl(sheet.source) }} <ExternalLink />
                </a>
                <small v-if="sheet.ranges.length">
                  {{ sheet.ranges.length }} tab{{
                    sheet.ranges.length === 1 ? "" : "s"
                  }}
                </small>
              </span>
            </div>
            <div class="sheet-actions">
              <BaseSelect
                v-if="sheet.ranges.length"
                class-name="sheet-tab-select"
                :model-value="getSelectedSheetName(sheet)"
                :options="sheet.ranges.map((range) => ({ label: range, value: range }))"
                :aria-label="`Select tab for ${sheet.label}`"
                @change="setSelectedSheetName(sheet.source, $event)"
              >
                <template #icon><TableProperties /></template>
              </BaseSelect>
              <BaseButton size="medium" @click="loadSheetViewerData(sheet)">
                <template #icon><TableProperties /></template>
                View
              </BaseButton>
              <BaseButton
                variant="danger-ghost"
                size="medium"
                @click="removeRecentSheet(sheet.source)"
              >
                <template #icon><Trash2 /></template>
                Delete
              </BaseButton>
            </div>
          </article>
        </div>

        <div v-else-if="!sheetLoading" class="sheet-empty">
          <FileSpreadsheet />
          <strong>No saved sheets</strong>
          <span>Import a Google Sheet URL or spreadsheet ID to get started.</span>
        </div>

        <div v-if="sheetLoading" class="sheet-loading" aria-live="polite">
          Loading sheet data…
        </div>
      </div>
    </section>

    <SheetDataModal
      :open="isSheetModalOpen"
      :title="sheetModalTitle"
      @close="isSheetModalOpen = false"
    >
      <div class="sheet-table-wrap">
        <table v-if="sheetFilteredRows?.length">
          <thead>
            <tr>
              <th v-for="(header, index) in sheetHeaders" :key="index">
                {{ header }}
                <span v-if="index === 0" class="sheet-badge">
                  {{ sheetFilteredRows.length }} rows
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, rowIndex) in sheetFilteredRows" :key="rowIndex">
              <td v-for="(cell, cellIndex) in row" :key="cellIndex">
                {{ cell }}
              </td>
            </tr>
          </tbody>
        </table>
        <div v-else class="sheet-empty-modal">No data to display.</div>
      </div>
    </SheetDataModal>
  </AdminPageShell>
</template>

<style scoped>
.settings-sheet-card {
  grid-column: 1 / -1;
  scroll-margin-top: 76px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  box-shadow: var(--shadow-soft);
}

.sheet-card-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--border);
}

.sheet-card-heading > div {
  min-width: 0;
  flex: 1;
}

.sheet-card-heading h2 {
  color: var(--text);
  font-size: 16px;
}

.sheet-card-heading p {
  margin-top: 4px;
  color: var(--muted);
  font-size: 12px;
}

.sheet-card-icon,
.sheet-row-icon {
  display: inline-grid;
  flex: 0 0 auto;
  place-items: center;
  background: var(--green-soft);
  color: var(--green);
}

.sheet-card-icon {
  width: 36px;
  height: 36px;
  border-radius: 9px;
}

.sheet-card-icon svg,
.sheet-row-icon svg {
  width: 18px;
  height: 18px;
}

.sheet-count {
  flex: 0 0 auto;
  padding: 6px 9px;
  border-radius: 999px;
  background: var(--surface-soft);
  color: var(--muted);
  font-size: 10px;
  font-weight: 600;
}

.sheet-card-body {
  padding: 20px;
}

.sheet-add-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 9px;
}

.sheet-add-form label,
.sheet-add-form input {
  width: 100%;
}

.sheet-add-form input {
  min-height: 36px;
  padding: 0 11px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--surface-raised);
  color: var(--text);
  font: inherit;
  font-size: 12px;
}

.sheet-add-form input:focus {
  border-color: var(--green);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--green) 16%, transparent);
  outline: none;
}

.sheet-alert,
.sheet-loading {
  margin-top: 12px;
  padding: 9px 11px;
  border-radius: 7px;
  font-size: 12px;
}

.sheet-alert {
  border: 1px solid color-mix(in srgb, var(--red) 24%, transparent);
  background: var(--red-soft);
  color: var(--red);
}

.sheet-loading {
  background: var(--surface-soft);
  color: var(--muted);
}

.sheet-list {
  display: grid;
  margin-top: 16px;
  border: 1px solid var(--border);
  border-radius: 10px;
}

.sheet-row {
  display: grid;
  grid-template-columns: 34px minmax(180px, 1fr) auto;
  align-items: center;
  gap: 11px;
  padding: 12px;
  border-top: 1px solid var(--border);
}

.sheet-row:first-child {
  border-top: 0;
}

.sheet-row-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
}

.sheet-copy {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.sheet-copy > strong {
  overflow: hidden;
  color: var(--text);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sheet-copy > span {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.sheet-copy a {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 4px;
  overflow: hidden;
  color: var(--text-link);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sheet-copy a svg {
  width: 11px;
  height: 11px;
  flex: 0 0 auto;
}

.sheet-copy small {
  flex: 0 0 auto;
  color: var(--muted);
  font-size: 10px;
}

.sheet-actions {
  display: flex;
  align-items: center;
  gap: 7px;
}

:deep(.sheet-tab-select) {
  width: 180px;
}

:deep(.sheet-tab-select .select-dropdown) {
  z-index: 1010;
}

.sheet-empty {
  display: grid;
  min-height: 150px;
  margin-top: 16px;
  place-items: center;
  align-content: center;
  gap: 5px;
  border: 1px dashed var(--border);
  border-radius: 10px;
  color: var(--muted);
  text-align: center;
}

.sheet-empty svg {
  width: 24px;
  height: 24px;
  margin-bottom: 3px;
  color: var(--green);
}

.sheet-empty strong {
  color: var(--text);
  font-size: 13px;
}

.sheet-empty span {
  font-size: 11px;
}

.sheet-table-wrap {
  width: 100%;
  overflow-x: auto;
  background: var(--surface);
}

.sheet-table-wrap table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 12px;
}

.sheet-table-wrap th,
.sheet-table-wrap td {
  padding: 11px 16px;
  border-bottom: 1px solid var(--border);
  text-align: left;
  white-space: nowrap;
}

.sheet-table-wrap th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--surface-soft);
  color: var(--text-sub);
  font-size: 11px;
}

.sheet-table-wrap tbody tr:hover td {
  background: var(--surface-soft);
}

.sheet-badge {
  margin-left: 5px;
  padding: 2px 6px;
  border-radius: 999px;
  background: var(--blue-soft);
  color: var(--blue);
  font-size: 9px;
}

.sheet-empty-modal {
  padding: 22px;
  color: var(--muted);
  font-size: 12px;
}

@media (max-width: 820px) {
  .sheet-row {
    grid-template-columns: 34px minmax(0, 1fr);
  }

  .sheet-actions {
    grid-column: 1 / -1;
    justify-content: flex-end;
  }
}

@media (max-width: 560px) {
  .sheet-card-heading {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .sheet-count {
    margin-left: 48px;
  }

  .sheet-card-body {
    padding: 14px;
  }

  .sheet-add-form {
    grid-template-columns: 1fr;
  }

  .sheet-add-form :deep(.base-button) {
    width: 100%;
  }

  .sheet-actions {
    align-items: stretch;
    flex-direction: column;
  }

  :deep(.sheet-tab-select),
  .sheet-actions :deep(.base-button) {
    width: 100%;
  }
}
</style>
