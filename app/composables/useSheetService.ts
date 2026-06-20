import { ref } from "vue";

interface SheetValuesResponse {
  spreadsheetId: string;
  range: string;
  values: string[][];
}

interface SheetMetaResponse {
  spreadsheetId: string;
  title: string;
  sheets: string[];
}

export interface ProxySheetRow {
  storeId: string;
  shop: string;
  domain: string;
  proxyUrl: string;
  clientId?: string;
  clientSecret?: string;
}

const REQUEST_DELAY_MS = 1000;
const DEFAULT_SHEET_RANGE = "A:Z";
let lastRequestAt = 0;

const HEADER_ALIASES = {
  storeId: ["storeid", "store_id", "store id", "id"],
  shop: ["shop", "shopname", "shop_name", "store"],
  domain: ["domain", "shopdomain", "shop_domain", "store_domain"],
  proxyUrl: ["proxy", "proxyurl", "proxy_url", "proxy url", "socks"],
  credentials: ["store_id_client_id_client_secret", "id_client_secret", "credentials"],
};

const normalizeHeader = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[\s\-\/\|]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

function resolveColumnIndex(headers: string[], aliases: string[]) {
  const normalizedHeaders = headers.map(normalizeHeader);
  const normalizedAliases = aliases.map(normalizeHeader);
  return normalizedHeaders.findIndex((header) =>
    normalizedAliases.includes(header),
  );
}

function normalizeSpreadsheetId(input: string): string {
  const trimmed = (input || "").trim();
  if (!trimmed) return "";

  const urlMatch = trimmed.match(/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (urlMatch?.[1]) return urlMatch[1];

  return trimmed;
}

function buildSheetLabel(source: string): string {
  const spreadsheetId = normalizeSpreadsheetId(source);
  if (!spreadsheetId) return "";
  return spreadsheetId.slice(0, 16) + "…";
}

function buildRangeFromSheetName(sheetName: string): string {
  const name = String(sheetName || "").trim();
  if (!name) return "A:Z";
  const escapedSheetName = name.replace(/'/g, "''");
  return `'${escapedSheetName}'!A:Z`;
}

async function waitForRateLimit() {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < REQUEST_DELAY_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, REQUEST_DELAY_MS - elapsed),
    );
  }
  lastRequestAt = Date.now();
}

export function useSheetService() {
  const loading = ref(false);
  const error = ref<string | null>(null);
  const headers = ref<string[]>([]);
  const rows = ref<string[][]>([]);
  const filteredRows = ref<string[][]>([]);

  async function readSheetValues(options?: {
    spreadsheetId?: string;
    range?: string;
  }) {
    loading.value = true;
    error.value = null;

    try {
      await waitForRateLimit();

      const response = await $fetch<SheetValuesResponse>("/api/sheet/values", {
        method: "POST",
        body: {
          spreadsheetId: options?.spreadsheetId,
          range: options?.range || DEFAULT_SHEET_RANGE,
        },
      });

      const values = response.values || [];
      const [headerRow = [], ...dataRows] = values;

      headers.value = headerRow.map((h) => String(h || "").trim());
      rows.value = dataRows.map((row) =>
        row.map((cell) => String(cell == null ? "" : cell).trim()),
      );
      filteredRows.value = rows.value;

      return values;
    } catch (e: any) {
      error.value =
        e?.data?.statusMessage || e.message || "Failed to read sheet";
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function readSheetMeta(options?: { spreadsheetId?: string }) {
    loading.value = true;
    error.value = null;

    try {
      await waitForRateLimit();

      const response = await $fetch<SheetMetaResponse>("/api/sheet/meta", {
        method: "POST",
        body: {
          spreadsheetId: options?.spreadsheetId,
        },
      });

      return response;
    } catch (e: any) {
      error.value =
        e?.data?.statusMessage || e.message || "Failed to read sheet metadata";
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function loadByInput(input: string, range?: string) {
    const spreadsheetId = normalizeSpreadsheetId(input);
    if (!spreadsheetId) {
      throw new Error("Spreadsheet ID is required");
    }
    return readSheetValues({ spreadsheetId, range });
  }

  async function loadMetaByInput(input: string) {
    const spreadsheetId = normalizeSpreadsheetId(input);
    if (!spreadsheetId) {
      throw new Error("Spreadsheet ID is required");
    }
    return readSheetMeta({ spreadsheetId });
  }

  async function readProxySheetRows(options?: {
    spreadsheetId?: string;
    range?: string;
    dataRowStart?: number;
    mapping?: {
      storeId?: number;
      shop?: number;
      domain?: number;
      proxyUrl?: number;
      credentials?: number;
    };
  }): Promise<ProxySheetRow[]> {
    const values = await readSheetValues(options);
    if (!values.length) return [];

    let dataRows = values;
    let storeIdx = -1;
    let shopIdx = -1;
    let domainIdx = -1;
    let proxyIdx = -1;

    let credsIdx = -1;

    if (options?.mapping) {
      if (options.dataRowStart) {
        // dataRowStart is 1-based, convert to 0-based slice index
        dataRows = values.slice(Math.max(0, options.dataRowStart - 1));
      }
      storeIdx = options.mapping.storeId ?? -1;
      shopIdx = options.mapping.shop ?? -1;
      domainIdx = options.mapping.domain ?? -1;
      proxyIdx = options.mapping.proxyUrl ?? -1;
      credsIdx = options.mapping.credentials ?? -1;
    } else {
      const headerRow = values[0] || [];
      dataRows = values.slice(1);
      storeIdx = resolveColumnIndex(headerRow, HEADER_ALIASES.storeId);
      shopIdx = resolveColumnIndex(headerRow, HEADER_ALIASES.shop);
      domainIdx = resolveColumnIndex(headerRow, HEADER_ALIASES.domain);
      proxyIdx = resolveColumnIndex(headerRow, HEADER_ALIASES.proxyUrl);
      credsIdx = resolveColumnIndex(headerRow, HEADER_ALIASES.credentials);
    }

    return dataRows
      .map((row) => {
        let sId = storeIdx >= 0 ? String(row[storeIdx] || "").trim() : "";
        let cId = "";
        let cSec = "";

        if (credsIdx >= 0) {
          const creds = String(row[credsIdx] || "").trim();
          const parts = creds.split(/[\/|]/).map((s) => s.trim());
          if (parts.length >= 3) {
            sId = sId || parts[0] || "";
            cId = parts[1] || "";
            cSec = parts[2] || "";
          }
        }

        return {
          storeId: sId,
          shop: shopIdx >= 0 ? String(row[shopIdx] || "").trim() : "",
          domain: domainIdx >= 0 ? String(row[domainIdx] || "").trim() : "",
          proxyUrl: proxyIdx >= 0 ? String(row[proxyIdx] || "").trim() : "",
          clientId: cId,
          clientSecret: cSec,
        };
      })
      .filter((row) => !!row.storeId || !!row.domain || !!row.proxyUrl);
  }

  async function updateSheetValues(options: {
    spreadsheetId?: string;
    range: string;
    values: any[][];
  }) {
    loading.value = true;
    error.value = null;
    try {
      await waitForRateLimit();
      const response = await $fetch<any>("/api/sheet/update", {
        method: "POST",
        body: {
          spreadsheetId: options.spreadsheetId,
          range: options.range,
          values: options.values,
        },
      });
      return response;
    } catch (e: any) {
      error.value =
        e?.data?.statusMessage || e.message || "Failed to update sheet";
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function batchUpdateSheetValues(options: {
    spreadsheetId?: string;
    data: { range: string; values: any[][] }[];
  }) {
    if (!options.data || options.data.length === 0) return;
    loading.value = true;
    error.value = null;
    try {
      await waitForRateLimit();
      const response = await $fetch<any>("/api/sheet/batch-update", {
        method: "POST",
        body: {
          spreadsheetId: options.spreadsheetId,
          data: options.data,
        },
      });
      return response;
    } catch (e: any) {
      error.value =
        e?.data?.statusMessage || e.message || "Failed to batch update sheet";
      throw e;
    } finally {
      loading.value = false;
    }
  }

  return {
    loading,
    error,
    headers,
    rows,
    filteredRows,
    normalizeSpreadsheetId,
    buildSheetLabel,
    buildRangeFromSheetName,
    readSheetValues,
    updateSheetValues,
    batchUpdateSheetValues,
    readSheetMeta,
    loadByInput,
    loadMetaByInput,
    readProxySheetRows,
  };
}
