import { defineStore } from "pinia";
import { ref } from "vue";
import { readKnownStores, writeKnownStores } from "~~/utils/known-stores";

export const useFormStore = defineStore("form", () => {
  const storeId = ref("");

  // List of all store IDs that have a saved cookie
  const knownStores = ref<string[]>([]);

  function loadKnownStores() {
    if (typeof window === "undefined") return;
    knownStores.value = readKnownStores();
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
    if (storeId.value === id) storeId.value = "";
  }

  return {
    storeId,
    knownStores,
    loadKnownStores,
    addKnownStore,
    removeKnownStore,
  };
});
