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

export const getSheetUrls = () => {
  // In Nuxt 3, useRuntimeConfig() works within the Nuxt context (Vue components, composables, plugins).
  // For files in utils/, they are often called within that context.
  try {
    const config = useRuntimeConfig();
    return {
      QUAN_LY_SHEET_URL: (config.public.quanLySheetUrl as string) || "",
      FBS_SHEET_URL: (config.public.fbsSheetUrl as string) || "",
      BUFF1_SHEET_URL: (config.public.buff1SheetUrl as string) || "",
      BUFF2_SHEET_URL: (config.public.buff2SheetUrl as string) || "",
      MACHINE_1_SHEET_URL: (config.public.machine1SheetUrl as string) || "",
      MACHINE_2_SHEET_URL: (config.public.machine2SheetUrl as string) || "",
      MACHINE_3_SHEET_URL: (config.public.machine3SheetUrl as string) || "",
      MACHINE_4_SHEET_URL: (config.public.machine4SheetUrl as string) || "",
      MACHINE_5_SHEET_URL: (config.public.machine5SheetUrl as string) || "",
      MACHINE_6_SHEET_URL: (config.public.machine6SheetUrl as string) || "",
    };
  } catch (e) {
    console.error("Error accessing runtimeConfig in getSheetUrls:", e);
    return {
      QUAN_LY_SHEET_URL: "",
      FBS_SHEET_URL: "",
      BUFF1_SHEET_URL: "",
      BUFF2_SHEET_URL: "",
      MACHINE_1_SHEET_URL: "",
      MACHINE_2_SHEET_URL: "",
      MACHINE_3_SHEET_URL: "",
      MACHINE_4_SHEET_URL: "",
      MACHINE_5_SHEET_URL: "",
      MACHINE_6_SHEET_URL: "",
    };
  }
};

export function getMachineSheets() {
  const urls = getSheetUrls();
  return {
    "MÁY 1": urls.MACHINE_1_SHEET_URL,
    "MÁY 2": urls.MACHINE_2_SHEET_URL,
    "MÁY 3": urls.MACHINE_3_SHEET_URL,
    "MÁY 4": urls.MACHINE_4_SHEET_URL,
    "MÁY 5": urls.MACHINE_5_SHEET_URL,
    "MÁY 6": urls.MACHINE_6_SHEET_URL,
  };
}

export function getDefaultProxySheetPresets(): ProxySheetLoadPreset[] {
  const urls = getSheetUrls();
  return [
    {
      source: urls.QUAN_LY_SHEET_URL,
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
      source: urls.BUFF1_SHEET_URL,
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
      source: urls.FBS_SHEET_URL,
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
      source: urls.BUFF2_SHEET_URL,
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
}

export function getProxySheetPreset(
  source: string,
  tab?: string,
): ProxySheetLoadPreset | undefined {
  return getDefaultProxySheetPresets().find((preset) => {
    if (preset.source !== source) return false;
    if (!tab) return true; // Match first one if tab not provided
    return preset.tab === tab;
  });
}

export const SHEET_RECENT_STORAGE_KEY = "proxy:sheet-viewer:recent";
export const SHEET_CURRENT_STORAGE_KEY = "proxy:sheet-viewer:current";

export const defaultSheets = (): string[] => {
  const configs = getSheetUrls();
  return Object.values(configs).filter(Boolean);
};

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
