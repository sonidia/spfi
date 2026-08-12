import { defineStore } from "pinia";
import { ref } from "vue";
import { useLocalStorage } from "~/composables/useLocalStorage";
import { readKnownStores, writeKnownStores } from "~~/utils/known-stores";

const ACTIVE_STORE_STORAGE_KEY = "active_store_id";

export const useFormStore = defineStore("form", () => {
  const { state: storeId } = useLocalStorage(ACTIVE_STORE_STORAGE_KEY, "");

  // List of all store IDs that have a saved cookie
  const knownStores = ref<string[]>([]);

  function loadKnownStores() {
    if (typeof window === "undefined") return;
    knownStores.value = readKnownStores();
    if (storeId.value && !knownStores.value.includes(storeId.value)) {
      storeId.value = "";
    }
  }

  function setActiveStore(id: string) {
    storeId.value = String(id || "").trim();
  }

  function saveKnownStores() {
    writeKnownStores(knownStores.value);
  }

  function addKnownStore(id: string) {
    if (id && !knownStores.value.includes(id)) {
      knownStores.value.push(id);
      saveKnownStores();
    }
  }

  function removeKnownStore(id: string) {
    knownStores.value = knownStores.value.filter((s) => s !== id);
    saveKnownStores();
    // Clear the store cookie using the simplified key
    if (typeof document !== "undefined") {
      document.cookie = `${id}=; Max-Age=0; path=/`;
    }
    if (storeId.value === id) setActiveStore("");
  }

  return {
    storeId,
    knownStores,
    loadKnownStores,
    setActiveStore,
    addKnownStore,
    removeKnownStore,
  };
});
