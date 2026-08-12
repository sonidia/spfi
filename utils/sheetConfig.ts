import { parseSheetConfigList } from "./sheets.ts";

const MAX_MASTER_SHEET_TABS = 50;

export function resolveMasterSheetTabs(
  configuredTabs: unknown,
  discoveredTabs: unknown[] = [],
): string[] {
  const configured = parseSheetConfigList(configuredTabs);
  const candidates = configured.length ? configured : discoveredTabs;

  return Array.from(
    new Set(candidates.map((tab) => String(tab || "").trim()).filter(Boolean)),
  ).slice(0, MAX_MASTER_SHEET_TABS);
}
