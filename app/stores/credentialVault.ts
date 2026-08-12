import { defineStore } from "pinia";
import { ref } from "vue";
import type { StoreLocalData } from "~~/types/shopify";
import type { TrackingProviderSettings } from "~~/types/tracking";
import {
  isRecord,
  readStorageValue,
  writeStorageValue,
} from "~~/utils/browser-storage";
import { readKnownStores, writeKnownStores } from "~~/utils/known-stores";

const TRACKING_SETTINGS_STORAGE_KEY = "spf_tracking_provider_settings";
const STORE_TTL_MS = 10 * 365 * 24 * 60 * 60 * 1000;

function normalizeStoreData(value: Partial<StoreLocalData> | null | undefined) {
  return {
    domain: String(value?.domain || "").trim() || undefined,
    sock: String(value?.sock || "").trim() || undefined,
    clientId: String(value?.clientId || "").trim() || undefined,
    clientSecret: String(value?.clientSecret || "").trim() || undefined,
    accessToken: String(value?.accessToken || "").trim() || undefined,
    expiresTime:
      typeof value?.expiresTime === "number" && Number.isFinite(value.expiresTime)
        ? value.expiresTime
        : undefined,
  } satisfies StoreLocalData;
}

function readStoredShop(storeId: string): StoreLocalData {
  const value = readStorageValue<unknown>(storeId, null, {
    allowLegacyValue: true,
  });
  if (!isRecord(value)) return {};
  return normalizeStoreData(value);
}

function writeStoredShop(storeId: string, data: StoreLocalData) {
  writeStorageValue(storeId, normalizeStoreData(data), STORE_TTL_MS);
}

function emptyTrackingSettings(): TrackingProviderSettings {
  return {
    baseUrl: "",
    apiKey: "",
  };
}

function normalizeTrackingSettings(
  value: Partial<TrackingProviderSettings> | null | undefined,
): TrackingProviderSettings {
  return {
    baseUrl: String(value?.baseUrl || "").trim(),
    apiKey: String(value?.apiKey || "").trim(),
  };
}

function readTrackingSettings(): TrackingProviderSettings {
  const stored = readStorageValue<unknown>(TRACKING_SETTINGS_STORAGE_KEY, null, {
    allowLegacyValue: true,
  });
  if (!isRecord(stored)) return emptyTrackingSettings();
  return normalizeTrackingSettings(stored);
}

export const useCredentialVaultStore = defineStore("credentialVault", () => {
  const isInitialized = ref(false);
  const storeDataRevision = ref(0);
  const trackingSettings = ref<TrackingProviderSettings>(emptyTrackingSettings());

  function initialize() {
    if (typeof window === "undefined") return;
    trackingSettings.value = readTrackingSettings();
    isInitialized.value = true;
  }

  function ensureInitialized() {
    if (!isInitialized.value) initialize();
  }

  function getPublicStoreData(storeId: string): StoreLocalData {
    ensureInitialized();
    void storeDataRevision.value;
    return readStoredShop(storeId);
  }

  function getStoreData(storeId: string): StoreLocalData {
    ensureInitialized();
    void storeDataRevision.value;
    return readStoredShop(storeId);
  }

  async function saveStoreData(storeId: string, data: StoreLocalData) {
    ensureInitialized();
    writeStoredShop(storeId, data);
    storeDataRevision.value += 1;
  }

  async function patchStoreData(storeId: string, patch: Partial<StoreLocalData>) {
    ensureInitialized();
    writeStoredShop(storeId, {
      ...readStoredShop(storeId),
      ...patch,
    });
    storeDataRevision.value += 1;
  }

  function removeStoreData(storeId: string) {
    ensureInitialized();
    if (typeof window !== "undefined") {
      localStorage.removeItem(storeId);
      const remainingStores = readKnownStores().filter((id) => id !== storeId);
      writeKnownStores(remainingStores);
      storeDataRevision.value += 1;
    }
  }

  async function saveTrackingSettings(settings: TrackingProviderSettings) {
    ensureInitialized();
    const normalized = normalizeTrackingSettings(settings);
    writeStorageValue(TRACKING_SETTINGS_STORAGE_KEY, normalized);
    trackingSettings.value = normalized;
  }

  function removeTrackingSettings() {
    ensureInitialized();
    trackingSettings.value = emptyTrackingSettings();
    if (typeof window !== "undefined") {
      localStorage.removeItem(TRACKING_SETTINGS_STORAGE_KEY);
    }
  }

  return {
    isInitialized,
    storeDataRevision,
    trackingSettings,
    initialize,
    getPublicStoreData,
    getStoreData,
    saveStoreData,
    patchStoreData,
    removeStoreData,
    saveTrackingSettings,
    removeTrackingSettings,
  };
});
