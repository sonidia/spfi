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

export const getSheetUrls = () => {
  // In Nuxt 3, useRuntimeConfig() works within the Nuxt context (Vue components, composables, plugins).
  // For files in utils/, they are often called within that context.
  try {
    const config = useRuntimeConfig();
    return {
      SPF_SHEET_URL: (config.public.spfSheetUrl as string) || "",
    };
  } catch (e) {
    console.error("Error accessing runtimeConfig in getSheetUrls:", e);
    return {
      SPF_SHEET_URL: "",
    };
  }
};

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
