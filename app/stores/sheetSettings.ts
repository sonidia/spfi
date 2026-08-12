import { defineStore } from "pinia";
import { ref } from "vue";
import {
  readBrowserJson,
  readStorageValue,
  writeStorageValue,
} from "~~/utils/browser-storage";
import {
  emptySheetSettings,
  normalizeSheetSettings,
  resolveEffectiveSheetSettings,
  SHEET_SETTINGS_STORAGE_KEY,
  type SheetDeploymentConfig,
  type SheetSettings,
} from "~~/utils/sheet-settings";

export const useSheetSettingsStore = defineStore("sheetSettings", () => {
  const settings = ref<SheetSettings>(emptySheetSettings());
  const hasLocalOverride = ref(false);
  const isInitialized = ref(false);

  function initialize() {
    if (isInitialized.value || typeof window === "undefined") return;
    hasLocalOverride.value = readBrowserJson(SHEET_SETTINGS_STORAGE_KEY) !== null;
    settings.value = normalizeSheetSettings(
      readStorageValue(SHEET_SETTINGS_STORAGE_KEY, emptySheetSettings()),
    );
    isInitialized.value = true;
  }

  function resolve(deployment: SheetDeploymentConfig) {
    initialize();
    return resolveEffectiveSheetSettings(
      settings.value,
      deployment,
      hasLocalOverride.value,
    );
  }

  function save(nextSettings: SheetSettings) {
    initialize();
    const normalized = normalizeSheetSettings(nextSettings);
    writeStorageValue(SHEET_SETTINGS_STORAGE_KEY, normalized);
    settings.value = normalized;
    hasLocalOverride.value = true;
  }

  function clearOverride() {
    initialize();
    if (typeof window !== "undefined") {
      localStorage.removeItem(SHEET_SETTINGS_STORAGE_KEY);
    }
    settings.value = emptySheetSettings();
    hasLocalOverride.value = false;
  }

  return {
    settings,
    hasLocalOverride,
    isInitialized,
    initialize,
    resolve,
    save,
    clearOverride,
  };
});
