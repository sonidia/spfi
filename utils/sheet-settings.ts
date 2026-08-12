import { isRecord } from "./browser-storage.ts";
import { parseSheetConfigList } from "./sheets.ts";

export const SHEET_SETTINGS_STORAGE_KEY = "spf_sheet_settings";
const MAX_VIEWER_SHEETS = 10;
const MAX_MASTER_TABS = 50;

export interface SheetSettings {
  sheetUrls: string[];
  masterSheetUrl: string;
  masterSheetTabs: string[];
}

export interface SheetDeploymentConfig {
  sheetUrls?: unknown;
  masterSheetUrl?: unknown;
  masterSheetTabs?: unknown;
}

export function emptySheetSettings(): SheetSettings {
  return { sheetUrls: [], masterSheetUrl: "", masterSheetTabs: [] };
}

export function normalizeSheetSettings(value: unknown): SheetSettings {
  const source = isRecord(value) ? value : {};
  return {
    sheetUrls: parseSheetConfigList(source.sheetUrls).slice(0, MAX_VIEWER_SHEETS),
    masterSheetUrl: String(source.masterSheetUrl || "").trim(),
    masterSheetTabs: parseSheetConfigList(source.masterSheetTabs).slice(
      0,
      MAX_MASTER_TABS,
    ),
  };
}

export function normalizeSheetDeploymentConfig(
  deployment: SheetDeploymentConfig,
): SheetSettings {
  return normalizeSheetSettings(deployment);
}

export function resolveEffectiveSheetSettings(
  localSettings: unknown,
  deployment: SheetDeploymentConfig,
  hasLocalOverride: boolean,
) {
  return hasLocalOverride
    ? normalizeSheetSettings(localSettings)
    : normalizeSheetDeploymentConfig(deployment);
}
