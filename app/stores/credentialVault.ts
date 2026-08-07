import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { StoreLocalData } from "~~/types/shopify";
import type { TrackingProviderSettings } from "~~/types/tracking";

const KNOWN_STORES_KEY = "shopify_known_stores";
const TRACKING_SETTINGS_STORAGE_KEY = "spf_tracking_provider_settings";
const STORE_TTL_MS = 10 * 365 * 24 * 60 * 60 * 1000;

interface StorageValue<T> {
  value: T;
  expiresAt?: number;
}

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(key);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isStorageValue(value: unknown): value is StorageValue<StoreLocalData> {
  return isRecord(value) && isRecord(value.value);
}

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

function readKnownStores(): string[] {
  const value = readJson<unknown>(KNOWN_STORES_KEY);
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function readStoredShop(storeId: string): StoreLocalData {
  const stored = readJson<unknown>(storeId);
  if (!stored) return {};

  const value = isStorageValue(stored) ? stored.value : stored;
  const expiresAt = isStorageValue(stored) ? stored.expiresAt : undefined;

  if (expiresAt && Date.now() > expiresAt) {
    localStorage.removeItem(storeId);
    return {};
  }

  if (!isRecord(value)) return {};
  return normalizeStoreData(value);
}

function writeStoredShop(storeId: string, data: StoreLocalData) {
  const wrapper: StorageValue<StoreLocalData> = {
    value: normalizeStoreData(data),
    expiresAt: Date.now() + STORE_TTL_MS,
  };
  localStorage.setItem(storeId, JSON.stringify(wrapper));
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
  const stored = readJson<unknown>(TRACKING_SETTINGS_STORAGE_KEY);
  if (!isRecord(stored)) return emptyTrackingSettings();

  const value = isRecord(stored.value) ? stored.value : stored;
  return normalizeTrackingSettings(value);
}

export const useCredentialVaultStore = defineStore("credentialVault", () => {
  const isInitialized = ref(false);
  const isUnlocked = ref(true);
  const isBusy = ref(false);
  const error = ref<string | null>(null);
  const trackingSettings = ref<TrackingProviderSettings>(
    emptyTrackingSettings(),
  );

  const hasVault = computed(() => false);
  const needsSetup = computed(() => false);

  function initialize() {
    if (typeof window === "undefined") return;
    trackingSettings.value = readTrackingSettings();
    isInitialized.value = true;
    isUnlocked.value = true;
    error.value = null;
  }

  function ensureInitialized() {
    if (!isInitialized.value) initialize();
  }

  function getPublicStoreData(storeId: string): StoreLocalData {
    ensureInitialized();
    return readStoredShop(storeId);
  }

  function getStoreData(storeId: string): StoreLocalData {
    ensureInitialized();
    return readStoredShop(storeId);
  }

  async function unlock() {
    initialize();
    return true;
  }

  function lock() {
    isUnlocked.value = true;
    error.value = null;
  }

  async function saveStoreData(storeId: string, data: StoreLocalData) {
    ensureInitialized();
    writeStoredShop(storeId, data);
  }

  async function patchStoreData(
    storeId: string,
    patch: Partial<StoreLocalData>,
  ) {
    ensureInitialized();
    writeStoredShop(storeId, {
      ...readStoredShop(storeId),
      ...patch,
    });
  }

  function removeStoreData(storeId: string) {
    ensureInitialized();
    if (typeof window !== "undefined") {
      localStorage.removeItem(storeId);
      const remainingStores = readKnownStores().filter((id) => id !== storeId);
      localStorage.setItem(KNOWN_STORES_KEY, JSON.stringify(remainingStores));
    }
  }

  async function saveTrackingSettings(settings: TrackingProviderSettings) {
    ensureInitialized();
    const normalized = normalizeTrackingSettings(settings);
    localStorage.setItem(
      TRACKING_SETTINGS_STORAGE_KEY,
      JSON.stringify(normalized),
    );
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
    isUnlocked,
    isBusy,
    error,
    trackingSettings,
    hasVault,
    needsSetup,
    initialize,
    unlock,
    lock,
    getPublicStoreData,
    getStoreData,
    saveStoreData,
    patchStoreData,
    removeStoreData,
    saveTrackingSettings,
    removeTrackingSettings,
  };
});
