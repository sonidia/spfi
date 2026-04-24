<script setup lang="ts">
import { ref } from "vue";
import { useGoogleSheet } from "../composables/useGoogleSheet";
import { useLocalStorage } from "../composables/useLocalStorage";

// Recent sheets stored in localStorage
const { state: sheetList, set: setSheetList } = useLocalStorage<
  { url: string; label: string }[]
>("sheet-viewer:recent", []);

const inputValue = ref("");
const sheetUrl = ref("");

// Normalize: accept full URL or just a Sheet ID
function normalizeInput(raw: string): string {
  const trimmed = raw.trim();

  // Already a full export URL
  if (trimmed.includes("export?format=csv")) return trimmed;

  // Full spreadsheet URL → extract ID and convert
  const urlMatch = trimmed.match(/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (urlMatch) {
    return `https://docs.google.com/spreadsheets/d/${urlMatch[1]}/export?format=csv&gid=0`;
  }

  // Bare Sheet ID (alphanumeric + dash/underscore, 20+ chars)
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) {
    return `https://docs.google.com/spreadsheets/d/${trimmed}/export?format=csv&gid=0`;
  }

  return trimmed;
}

function extractLabel(url: string): string {
  const match = url.match(/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match && match[1]
    ? match[1].slice(0, 16) + "…"
    : url.slice(0, 24) + "…";
}

function saveToRecent(url: string) {
  const label = extractLabel(url);
  const existing = sheetList.value.filter(
    (s: { url: string }) => s.url !== url,
  );
  setSheetList([{ url, label }, ...existing].slice(0, 10));
}

const {
  loading,
  error,
  headers,
  filteredRows,
  load: loadSheet,
} = useGoogleSheet(sheetUrl);

async function addAndLoadSheet() {
  if (!inputValue.value) return;
  const normalized = normalizeInput(inputValue.value);
  sheetUrl.value = normalized;
  await loadSheet();
  if (!error.value) {
    saveToRecent(normalized);
    inputValue.value = ""; // clear input on success
  }
}

function loadSheetData(url: string) {
  sheetUrl.value = url;
  loadSheet().then(() => {
    if (!error.value) saveToRecent(url);
  });
}

function removeSheet(url: string) {
  setSheetList(
    sheetList.value.filter((s: { url: string }) => s.url !== url),
  );
}
</script>

<template>
  <div class="sheet-page">
    <div class="page-header">
      <h1 class="page-title">Sheet Management</h1>
      <p class="page-sub">Manage your Google Sheets to view data</p>
    </div>

    <!-- ── Configured sheets ── -->
    <section class="card" v-if="sheetList.length">
      <div class="card-head">
        <span class="card-title">Configured Sheets</span>
        <span class="count-badge">{{ sheetList.length }}</span>
      </div>
      <div class="store-row" v-for="sheet in sheetList" :key="sheet.url">
        <div class="store-id">{{ sheet.label }}</div>
        <div class="store-meta">
          <span class="expiry">{{ sheet.url.slice(0, 50) + "..." }}</span>
        </div>
        <div class="store-actions">
          <button class="btn-outline" @click="loadSheetData(sheet.url)">
            View
          </button>
          <button class="btn-danger" @click="removeSheet(sheet.url)">
            Delete
          </button>
        </div>
      </div>
    </section>

    <!-- ── Add new sheet ── -->
    <section class="card">
      <div class="card-head">
        <span class="card-title">Add Sheet</span>
      </div>
      <div class="add-form">
        <div class="field field-wide">
          <input
            v-model="inputValue"
            class="inp"
            type="text"
            placeholder="URL, link Google Sheet, hoặc Sheet ID…"
            @keydown.enter="addAndLoadSheet"
          />
        </div>
        <button
          class="btn-primary"
          :disabled="loading || !inputValue.trim()"
          @click="addAndLoadSheet"
        >
          {{ loading ? "Loading…" : "Load & Add" }}
        </button>
      </div>
      <div v-if="error" class="alert alert-err">{{ error }}</div>
    </section>

    <!-- ── Status & Table Viewer ── -->
    <div class="viewer-section">
      <div v-if="loading" class="status status--loading">
        <span class="spinner" />
        Đang tải dữ liệu...
      </div>

      <div v-if="filteredRows && filteredRows.length" class="table-wrap">
        <table>
          <thead>
            <tr>
              <th v-for="(h, i) in headers" :key="i">
                {{ h }}
                <span v-if="i === 0" class="badge"
                  >{{ filteredRows.length }} dòng</span
                >
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in filteredRows" :key="i">
              <td v-for="(cell, j) in row" :key="j">{{ cell }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sheet-page {
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

/* Card */
.card {
  background: var(--surface);
  border-radius: var(--radius, 8px);
  box-shadow: var(--shadow);
  margin-bottom: 20px;
  overflow: hidden;
}
.card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
}
.card-title {
  font-weight: 600;
  font-size: 14px;
}
.count-badge {
  background: #e8e8e8;
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 20px;
}

/* Store rows */
.store-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}
.store-row:last-child {
  border-bottom: none;
}
.store-id {
  font-weight: 600;
  font-size: 13px;
  color: var(--text-primary);
  width: fit-content;
}
.store-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  flex-wrap: wrap;
}
.expiry {
  font-size: 12px;
  color: var(--text-secondary, #6d6d6d);
}
.store-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}
.btn-outline {
  padding: 5px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s, opacity 0.15s;
}
.btn-outline:hover:not(:disabled) {
  background: var(--bg);
}
.btn-outline:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-danger {
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
.btn-danger:hover {
  background: #fce8e8;
}

/* Add form */
.add-form {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  padding: 16px 18px;
  flex-wrap: wrap;
}
.field-wide {
  flex: 2;
  min-width: 160px;
}
.inp {
  width: 100%;
  border: 1px solid var(--border);
  padding: 7px 10px;
  border-radius: 6px;
  font-family: inherit;
  font-size: 13px;
  box-sizing: border-box;
}
.inp:focus {
  outline: 2px solid var(--blue);
  outline-offset: 1px;
}
.btn-primary {
  height: 32px;
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
}
.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-primary:hover:not(:disabled) {
  opacity: 0.85;
}

/* Alerts */
.alert {
  margin: 0 18px 14px;
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 13px;
}
.alert-err {
  background: #fce8e8;
  color: var(--red);
}

/* Viewer & Table */
.viewer-section {
  margin-top: 20px;
}
.status {
  font-size: 13px;
  margin-bottom: 1rem;
  padding: 10px 14px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.status--loading {
  background: #f5f5f5;
  color: #666;
  border: 1px solid #e5e5e5;
}
.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid #ddd;
  border-top-color: #534ab7;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.table-wrap {
  width: 100vw;
  position: relative;
  left: 50%;
  right: 50%;
  margin-left: -50vw;
  margin-right: -50vw;
  border-top: 1px solid var(--border);
  background: var(--surface);
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
thead tr {
  background: #f9f9f9;
}
th {
  padding: 10px 20px;
  text-align: left;
  font-weight: 500;
  color: #888;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid #e5e5e5;
  white-space: nowrap;
}
td {
  padding: 10px 20px;
  color: #111;
  border-bottom: 1px solid #f0f0f0;
}
tbody tr:last-child td {
  border-bottom: none;
}
tbody tr:hover {
  background: #fafafa;
}

.badge {
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
</style>

