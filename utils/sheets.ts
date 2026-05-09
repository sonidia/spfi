export type StoredSheet = {
  source: string;
  label: string;
  ranges: string[];
};

export type LegacyStoredSheet = {
  source?: string;
  label?: string;
  range?: string;
  ranges?: string[];
};

export type CurrentSheetSelection = {
  source: string;
  sheetName: string;
};

export type ProxySheetLoadPreset = {
  source: string;
  tab: string;
  startRow: number;
  columns: {
    storeId: number;
    shop: number;
    domain: number;
    proxyUrl: number;
  };
};

export const SHEET_RECENT_STORAGE_KEY = "proxy:sheet-viewer:recent";
export const SHEET_CURRENT_STORAGE_KEY = "proxy:sheet-viewer:current";

export const MACHINE_1_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1-aqOELwhn3vh6Zq_WLxc6ZZin8lWBaE_CrEyB59H9F8/edit?gid=0#gid=0";
export const MACHINE_2_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1l0IQXYwmGhSS8MiJksWFq8B3BCpKV_zxKgloQ8w-y_8/edit?gid=0#gid=0";
export const MACHINE_3_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1rt7EASJRfWGk5J91D6ziVX6bbu-vqETAwBYsq3tZi2Y/edit?gid=0#gid=0";
export const MACHINE_4_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1CWAbbC240HR7AdZjeP0G7c2j4B-PQzm_Fz2nlMuqNqQ/edit?gid=0#gid=0";
export const MACHINE_5_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/13vT1daD2fSsOppnIZk4YGEqFAiPgaIVnR9VgYNu368k/edit?gid=0#gid=0";
export const MACHINE_6_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1dXhVmEkY_CjXnrAgmXXQtQ1fhW5OaHfGLm3Yy-FZsn8/edit?gid=0#gid=0";

export const machineSheets: Record<string, string> = {
  "MÁY 1": MACHINE_1_SHEET_URL,
  "MÁY 2": MACHINE_2_SHEET_URL,
  "MÁY 3": MACHINE_3_SHEET_URL,
  "MÁY 4": MACHINE_4_SHEET_URL,
  "MÁY 5": MACHINE_5_SHEET_URL,
  "MÁY 6": MACHINE_6_SHEET_URL,
};

export const QUAN_LY_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1QbchbP0eeMjcrafXUTPmHwZsUZmIeJOZPUFULqBzy3s/edit?gid=0#gid=0";

export const FBS_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/18IPUGpt_WpmSt3txEZY5Zx94p15Qlr36jhZutsE2evg/edit?gid=660632124#gid=660632124";

export const BUFF1_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/18IPUGpt_WpmSt3txEZY5Zx94p15Qlr36jhZutsE2evg/edit?gid=660632124#gid=660632124";

export const BUFF2_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1ZLAMxVu_nyWWD_R9DWCICI57oXJPnTtMqYuLTit8_4A/edit?gid=0#gid=0";

export const defaultSheets: StoredSheet[] = [];

export const proxySheetLoadPresets: ProxySheetLoadPreset[] = [
  {
    source: QUAN_LY_SHEET_URL,
    tab: "quản lý",
    startRow: 3,
    columns: {
      storeId: 1,
      shop: 1,
      domain: 2,
      proxyUrl: 3,
    },
  },
  {
    source: BUFF1_SHEET_URL,
    tab: "order 1",
    startRow: 5,
    columns: {
      storeId: 0,
      shop: 3,
      domain: 3,
      proxyUrl: 10,
    },
  },
  {
    source: FBS_SHEET_URL,
    tab: "FBS",
    startRow: 3,
    columns: {
      storeId: 1,
      shop: 1,
      domain: 2,
      proxyUrl: 4,
    },
  },
  {
    source: BUFF2_SHEET_URL,
    tab: "Sheet1",
    startRow: 3,
    columns: {
      storeId: 0,
      shop: 3,
      domain: 3,
      proxyUrl: 10,
    },
  },
];

export function getProxySheetPreset(
  source: string,
  tab?: string,
): ProxySheetLoadPreset | undefined {
  return proxySheetLoadPresets.find((preset) => {
    if (preset.source !== source) return false;
    if (!tab) return true; // Match first one if tab not provided
    return preset.tab === tab;
  });
}

export function normalizeSheetNameFromRange(value: string): string {
  const beforeBang = value.split("!")[0]?.trim() || "";
  if (!beforeBang) return "";
  const unquoted = beforeBang.replace(/^'/, "").replace(/'$/, "");
  return unquoted.replace(/''/g, "'").trim();
}

export function normalizeSheetEntries(
  items: (StoredSheet | LegacyStoredSheet)[],
  fallbackBuildLabel?: (source: string) => string,
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
        fallbackBuildLabel?.(source) ||
        source.slice(0, 16) + "…",
      ranges: mergedRanges,
    });
  }

  return Array.from(normalized.values()).slice(0, 10);
}
