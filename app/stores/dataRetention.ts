import { computed, ref } from "vue";
import { defineStore } from "pinia";
import {
  DEFAULT_PINIA_RETENTION_INDEX,
  isPiniaCacheAlive,
  normalizePiniaRetentionIndex,
  PINIA_RETENTION_PRESETS,
} from "~~/utils/pinia-retention";

const STORAGE_KEY = "spf_pinia_data_retention";

export const useDataRetentionStore = defineStore("dataRetention", () => {
  const presetIndex = ref(DEFAULT_PINIA_RETENTION_INDEX);
  const isInitialized = ref(false);

  const preset = computed(() => PINIA_RETENTION_PRESETS[presetIndex.value]);
  const ttlMs = computed(() => preset.value?.ttlMs ?? null);

  function initialize() {
    if (isInitialized.value || typeof window === "undefined") return;

    presetIndex.value = normalizePiniaRetentionIndex(
      localStorage.getItem(STORAGE_KEY),
    );
    isInitialized.value = true;
  }

  function setPresetIndex(value: number) {
    const nextIndex = normalizePiniaRetentionIndex(value);
    presetIndex.value = nextIndex;
    isInitialized.value = true;

    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, String(nextIndex));
    }
  }

  function isAlive(cachedAt?: number, now = Date.now()) {
    return isPiniaCacheAlive(cachedAt, ttlMs.value, now);
  }

  return {
    presetIndex,
    preset,
    ttlMs,
    isInitialized,
    initialize,
    setPresetIndex,
    isAlive,
  };
});
