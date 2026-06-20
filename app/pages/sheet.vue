<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { defaultSheets } from "../../utils/sheets";
import { useLocalStorage } from "../composables/useLocalStorage";
import { useSheetService } from "../composables/useSheetService";

definePageMeta({ layout: false });

type StoredSheet = {
  source: string;
  label: string;
  ranges: string[];
};

type LegacyStoredSheet = {
  source?: string;
  label?: string;
  range?: string;
  ranges?: string[];
};

const { state: sheetList, set: setSheetList } = useLocalStorage<
  (StoredSheet | LegacyStoredSheet)[]
>("proxy:sheet-viewer:recent", []);

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
const sheetRangeInput = ref("");
const selectedSheetRanges = ref<Record<string, string>>({});
const isSheetModalOpen = ref(false);
const sheetModalTitle = ref("");

const recentSheets = computed<StoredSheet[]>(() =>
  normalizeSheetEntries(sheetList.value || []),
);

function truncateUrl(url: string): string {
  if (url.length <= 50) return url;
  return url.slice(0, 47) + "...";
}

function normalizeSheetNameFromRange(value: string): string {
  const beforeBang = value.split("!")[0]?.trim() || "";
  if (!beforeBang) return "";
  const unquoted = beforeBang.replace(/^'/, "").replace(/'$/, "");
  return unquoted.replace(/''/g, "'").trim();
}

function normalizeSheetEntries(
  items: (StoredSheet | LegacyStoredSheet)[],
): StoredSheet[] {
  const normalized = new Map<string, StoredSheet>();

  for (const item of items || []) {
    const source = String(item?.source || "").trim();
    if (!source) continue;

    const legacyRange = (item as LegacyStoredSheet)?.range;
    const rangesFromField = Array.isArray(item?.ranges)
      ? item.ranges
      : legacyRange
        ? [legacyRange]
        : [];

    const ranges = Array.from(
      new Set(
        rangesFromField
          .map((range) =>
            String(range || "").includes("!")
              ? normalizeSheetNameFromRange(String(range || ""))
              : String(range || "").trim(),
          )
          .filter(Boolean),
      ),
    );

    const prev = normalized.get(source);
    const mergedRanges = Array.from(
      new Set([...(prev?.ranges || []), ...ranges]),
    );

    normalized.set(source, {
      source,
      label:
        String(item?.label || "").trim() ||
        prev?.label ||
        buildSheetLabel(source) ||
        source.slice(0, 16) + "…",
      ranges: mergedRanges,
    });
  }

  return Array.from(normalized.values()).slice(0, 10);
}

function persistRecentSheets(items: StoredSheet[]) {
  setSheetList(items);
}

function upsertRecentSheet(entry: StoredSheet) {
  const existing = recentSheets.value.filter(
    (sheet) => sheet.source !== entry.source,
  );

  persistRecentSheets([
    {
      ...entry,
      ranges: Array.from(
        new Set(entry.ranges.map((r) => r.trim()).filter(Boolean)),
      ),
    },
    ...existing,
  ]);
}

function toRangeExpression(input?: string): string | undefined {
  const value = String(input || "").trim();
  if (!value) return undefined;
  if (value.includes("!")) return value;
  return buildRangeFromSheetName(value);
}

function getSelectedSheetName(sheet: StoredSheet): string {
  const selected = selectedSheetRanges.value[sheet.source];
  if (selected) return selected;
  return sheet.ranges[0] || "";
}

function setSelectedSheetName(source: string, sheetName: string) {
  selectedSheetRanges.value = {
    ...selectedSheetRanges.value,
    [source]: sheetName,
  };
}

function handleSheetRangeChange(source: string, event: Event) {
  const target = event.target as HTMLSelectElement | null;
  if (!target) return;
  setSelectedSheetName(source, target.value || "");
}

async function readSheetMetaSafe(source: string) {
  try {
    return await loadMetaByInput(source);
  } catch {
    return null;
  }
}

onMounted(async () => {
  const normalizedRecentSheets = normalizeSheetEntries(sheetList.value || []);
  const defaults = defaultSheets();

  if (
    JSON.stringify(normalizedRecentSheets) !==
    JSON.stringify(sheetList.value || [])
  ) {
    persistRecentSheets(normalizedRecentSheets);
  }

  // Load default sheets if no sheets in localStorage
  if (normalizedRecentSheets.length === 0) {
    const initialSheets: StoredSheet[] = [];

    for (const source of defaults) {
      const meta = await readSheetMetaSafe(source);
      if (meta) {
        const ranges = meta.sheets || [];
        initialSheets.push({
          source: source,
          label: String(meta.title || "").trim() || buildSheetLabel(source),
          ranges,
        });
      }
    }

    persistRecentSheets(initialSheets);
  }
});

async function addAndLoadSheet() {
  const source = sheetInputValue.value.trim();
  if (!source) return;

  await loadByInput(source);

  if (!sheetError.value) {
    const meta = await readSheetMetaSafe(source);
    const ranges = meta?.sheets?.length ? meta.sheets : [];

    upsertRecentSheet({
      source,
      label:
        String(meta?.title || "").trim() ||
        buildSheetLabel(source) ||
        source.slice(0, 16) + "…",
      ranges,
    });

    const firstRange = ranges[0];
    if (firstRange) {
      setSelectedSheetName(source, firstRange);
    }

    sheetInputValue.value = "";
  }
}

async function loadSheetViewerData(sheet: StoredSheet) {
  const selectedSheetName = getSelectedSheetName(sheet);
  const rangeToLoad = toRangeExpression(selectedSheetName);

  await loadByInput(sheet.source, rangeToLoad);
  if (!sheetError.value) {
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
}

function removeRecentSheet(source: string) {
  persistRecentSheets(
    recentSheets.value.filter((sheet) => sheet.source !== source),
  );

  const nextSelected = { ...selectedSheetRanges.value };
  delete nextSelected[source];
  selectedSheetRanges.value = nextSelected;
}
</script>

<template>
  <div class="sheet-page">
    <PageHeader
      title="Sheet Management"
      sub="Manage your Google Sheets to view data"
    >
      <IconsCopy />
    </PageHeader>

    <div class="sheet-add-form">
      <div class="sheet-field-wide">
        <input
          v-model="sheetInputValue"
          :class="[
            'sheet-inp',
            { 'sheet-inp--wide': recentSheets.length === 0 },
          ]"
          type="text"
          placeholder="Google Sheet URL hoặc Spreadsheet ID…"
          @keydown.enter="addAndLoadSheet"
        />
      </div>
      <button
        class="sheet-btn-primary"
        :disabled="sheetLoading || !sheetInputValue.trim()"
        @click="addAndLoadSheet"
      >
        <IconsSync v-if="sheetLoading" />
        <IconsAdd v-else />
        <span>{{ sheetLoading ? "Loading…" : "Load & Add" }}</span>
      </button>
    </div>

    <section :class="['card', { 'card--empty': recentSheets.length === 0 }]">
      <div v-if="sheetError" class="alert alert-err">{{ sheetError }}</div>

      <div v-if="recentSheets.length" class="sheet-row-wrapper">
        <div
          class="sheet-store-row"
          v-for="sheet in recentSheets"
          :key="sheet.source"
        >
          <div class="sheet-store-id">{{ sheet.label }}</div>
          <div class="sheet-store-meta">
            <a class="sheet-url" :href="sheet.source" target="_blank">{{
              truncateUrl(sheet.source)
            }}</a>
            <span v-if="sheet.ranges.length" class="sheet-expiry"
              >• {{ sheet.ranges.length }} tab(s)</span
            >
          </div>
          <div class="sheet-store-actions">
            <BaseSelect
              v-if="sheet.ranges.length"
              class-name="sheet-select-custom"
              :model-value="getSelectedSheetName(sheet)"
              :options="sheet.ranges.map((r) => ({ label: r, value: r }))"
              @change="setSelectedSheetName(sheet.source, $event)"
            />

            <button
              class="sheet-btn-outline"
              @click="loadSheetViewerData(sheet)"
            >
              <IconsCheck />
              View
            </button>
            <button
              class="sheet-btn-danger"
              @click="removeRecentSheet(sheet.source)"
            >
              <IconsDelete />
              Delete
            </button>
          </div>
        </div>
      </div>

      <div class="sheet-viewer-section">
        <div v-if="sheetLoading" class="sheet-status sheet-status--loading">
          <span class="sheet-spinner" />
          Đang tải dữ liệu...
        </div>
      </div>
    </section>

    <SheetDataModal
      :open="isSheetModalOpen"
      :title="sheetModalTitle"
      @close="isSheetModalOpen = false"
    >
      <div class="sheet-table-wrap">
        <table v-if="sheetFilteredRows && sheetFilteredRows.length">
          <thead>
            <tr>
              <th v-for="(h, i) in sheetHeaders" :key="i">
                {{ h }}
                <span v-if="i === 0" class="sheet-badge"
                  >{{ sheetFilteredRows.length }} dòng</span
                >
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in sheetFilteredRows" :key="i">
              <td v-for="(cell, j) in row" :key="j">{{ cell }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="sheet-empty-modal">
          Không có dữ liệu để hiển thị.
        </div>
      </div>
    </SheetDataModal>
  </div>
</template>

<style scoped>
.sheet-page {
  max-width: 960px;
  margin: 0 auto;
  padding: 28px 24px 60px;
  font-size: 14px;
}

.card {
  background: var(--surface);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  margin-bottom: 24px;
  border: 1px solid var(--border);
}

.card--empty {
  background: transparent;
  box-shadow: none;
  border: none;
}

.card-title {
  font-weight: 600;
  font-size: 15px;
}

.sheet-add-form {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.sheet-field-wide {
  flex: 2;
  min-width: 180px;
}

.sheet-inp {
  width: 100%;
  border: 1px solid var(--border);
  padding: 7px 10px;
  border-radius: 6px;
  font-family: inherit;
  font-size: 13px;
  box-sizing: border-box;
  transition: width 0.3s ease;
}
.sheet-inp--wide {
  width: 100%;
}

.sheet-inp:focus {
  outline: 2px solid var(--blue);
  outline-offset: 1px;
}

.sheet-btn-primary {
  height: 30px;
  padding: 0 16px;
  background: var(--text-primary, #1a1a1a);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: opacity 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.sheet-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sheet-btn-primary:hover:not(:disabled) {
  opacity: 0.85;
}

.sheet-row-wrapper {
  background: var(--surface);
  border-radius: 12px;
}

.sheet-store-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
  border-top: 1px solid var(--border);
  flex-wrap: wrap;
}
.sheet-store-row:nth-child(1) {
  border: none;
}

.sheet-store-id {
  font-weight: 600;
  font-size: 13px;
  color: var(--text-primary);
  width: fit-content;
}

.sheet-store-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  flex-wrap: wrap;
}

.sheet-expiry {
  font-size: 12px;
  color: var(--text-secondary, #6d6d6d);
}

.sheet-store-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}

.sheet-select-custom {
  min-width: 150px;
  max-width: 220px;
}

.sheet-select {
  min-width: 150px;
  max-width: 220px;
  border: 1px solid var(--border);
  background: #fff;
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 12px;
  font-family: inherit;
  color: var(--text-primary);
}

.sheet-btn-outline {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  transition:
    background 0.15s,
    opacity 0.15s;
}

.sheet-btn-outline:hover:not(:disabled) {
  background: var(--bg);
}

.sheet-btn-danger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border: 1px solid #fcc;
  border-radius: 6px;
  background: #fff;
  color: var(--red);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s;
}

.sheet-btn-danger:hover {
  background: #fce8e8;
}

.sheet-btn-primary :deep(svg),
.sheet-btn-outline :deep(svg),
.sheet-btn-danger :deep(svg) {
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
}

.sheet-viewer-section {
  margin-top: 8px;
}

.sheet-status {
  font-size: 13px;
  margin: 0 18px 14px;
  padding: 10px 14px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.sheet-status--loading {
  background: #f5f5f5;
  color: #666;
  border: 1px solid #e5e5e5;
}

.sheet-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid #ddd;
  border-top-color: #534ab7;
  border-radius: 50%;
  animation: sheet-spin 0.7s linear infinite;
  flex-shrink: 0;
}

@keyframes sheet-spin {
  to {
    transform: rotate(360deg);
  }
}

.sheet-table-wrap {
  width: 100%;
  border-top: 1px solid var(--border);
  background: var(--surface);
  overflow-x: auto;
}

.sheet-table-wrap table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 13px;
}

.sheet-table-wrap thead tr {
  background: var(--surface-low, #fcfcfd);
  position: sticky;
  top: 0;
  z-index: 10;
}

.sheet-table-wrap th {
  padding: 12px 20px;
  text-align: left;
  font-weight: 600;
  color: #475467;
  font-size: 12px;
  text-transform: none;
  letter-spacing: 0px;
  border-bottom: 2px solid #eaecf0;
  white-space: nowrap;
  background: #f9fafb;
}

.sheet-table-wrap td {
  padding: 12px 20px;
  color: #344054;
  border-bottom: 1px solid #eaecf0;
  transition: background-color 0.2s;
}

.sheet-table-wrap tbody tr:nth-child(even) {
  background-color: #f9fafb;
}

.sheet-table-wrap tbody tr:hover td {
  background: #f2f4f7;
}

.sheet-table-wrap tbody tr:last-child td {
  border-bottom: none;
}

.sheet-badge {
  display: inline-block;
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 99px;
  background: #ede9ff;
  color: #534ab7;
  margin-left: 6px;
  font-weight: 500;
  text-transform: none;
  letter-spacing: 0;
}

.sheet-empty-modal {
  padding: 18px;
  color: var(--text-secondary, #6d6d6d);
  font-size: 13px;
}

.alert {
  margin: 0 20px 20px;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 13px;
}

.sheet-url {
  color: #007bff;
  text-decoration: none;
}

.sheet-url:hover {
  text-decoration: underline;
}
</style>
