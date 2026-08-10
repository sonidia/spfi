import { defineStore } from "pinia";
import { ref } from "vue";
import type {
  LocationsResponse,
  ShopifyInventoryLevel,
  ShopifyLocation,
} from "~~/types/shopify";
import { getAppErrorMessage } from "~~/utils/error";

interface LocationCacheEntry {
  locations: ShopifyLocation[];
  inventoryLevels: ShopifyInventoryLevel[];
  inventoryItemIdsKey: string;
  hasFetchedAll: boolean;
}

function normalizeInventoryItemIds(ids: Array<number | string | null | undefined>) {
  return Array.from(
    new Set(
      ids
        .map((id) => String(id || "").trim())
        .filter((id) => /^\d+$/.test(id)),
    ),
  );
}

export const useLocationStore = defineStore("locations", () => {
  const locations = ref<ShopifyLocation[]>([]);
  const inventoryLevels = ref<ShopifyInventoryLevel[]>([]);
  const activeInventoryItemIdsKey = ref("");
  const hasFetchedAll = ref(false);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const activeStoreId = ref("");
  const storeCache = ref<Record<string, LocationCacheEntry>>({});
  let requestSequence = 0;

  async function fetchAll(
    storeId: string,
    token: string,
    force = false,
    limit = 250,
  ) {
    if (!storeId || !token) {
      error.value = "Store ID and Access Token are required.";
      return;
    }

    activateStore(storeId);
    const cached = storeCache.value[storeId];
    if (!force && cached?.hasFetchedAll && !cached.inventoryItemIdsKey) {
      hydrate(storeId);
      return;
    }

    isLoading.value = true;
    error.value = null;
    const requestId = ++requestSequence;

    try {
      const response = await $fetch<LocationsResponse>("/api/location/all", {
        method: "GET",
        query: { storeId, limit },
        headers: { "x-shopify-access-token": token },
      });

      if (requestId !== requestSequence) return;

      const nextLocations = response.locations || [];
      locations.value = nextLocations;
      inventoryLevels.value = [];
      activeInventoryItemIdsKey.value = "";
      hasFetchedAll.value = true;
      storeCache.value[storeId] = {
        locations: [...nextLocations],
        inventoryLevels: [],
        inventoryItemIdsKey: "",
        hasFetchedAll: true,
      };
    } catch (err) {
      if (requestId === requestSequence) {
        error.value = getAppErrorMessage(err, "Failed to fetch locations.");
      }
    } finally {
      if (requestId === requestSequence) {
        isLoading.value = false;
      }
    }
  }

  async function fetchForInventoryItems(
    storeId: string,
    token: string,
    inventoryItemIds: Array<number | string | null | undefined>,
    force = false,
  ) {
    const normalizedIds = normalizeInventoryItemIds(inventoryItemIds);

    if (normalizedIds.length === 0) {
      await fetchAll(storeId, token, force);
      return;
    }

    if (!storeId || !token) {
      error.value = "Store ID and Access Token are required.";
      return;
    }

    activateStore(storeId);
    const inventoryItemIdsKey = normalizedIds.join(",");
    const cached = storeCache.value[storeId];
    if (
      !force &&
      cached?.hasFetchedAll &&
      cached.inventoryItemIdsKey === inventoryItemIdsKey
    ) {
      hydrate(storeId);
      return;
    }

    isLoading.value = true;
    error.value = null;
    const requestId = ++requestSequence;

    try {
      const response = await $fetch<LocationsResponse>("/api/location/all", {
        method: "GET",
        query: {
          storeId,
          limit: 250,
          inventory_item_ids: inventoryItemIdsKey,
        },
        headers: { "x-shopify-access-token": token },
      });

      if (requestId !== requestSequence) return;

      const nextLocations = response.locations || [];
      const nextInventoryLevels = response.inventory_levels || [];
      locations.value = nextLocations;
      inventoryLevels.value = nextInventoryLevels;
      activeInventoryItemIdsKey.value = inventoryItemIdsKey;
      hasFetchedAll.value = true;
      storeCache.value[storeId] = {
        locations: [...nextLocations],
        inventoryLevels: [...nextInventoryLevels],
        inventoryItemIdsKey,
        hasFetchedAll: true,
      };
    } catch (err) {
      if (requestId === requestSequence) {
        error.value = getAppErrorMessage(
          err,
          "Failed to fetch inventory locations.",
        );
      }
    } finally {
      if (requestId === requestSequence) {
        isLoading.value = false;
      }
    }
  }

  function hydrate(storeId: string): boolean {
    activeStoreId.value = storeId;
    requestSequence += 1;
    const cached = storeCache.value[storeId];
    if (!cached) return false;

    locations.value = [...cached.locations];
    inventoryLevels.value = [...cached.inventoryLevels];
    activeInventoryItemIdsKey.value = cached.inventoryItemIdsKey;
    hasFetchedAll.value = cached.hasFetchedAll;
    error.value = null;
    return true;
  }

  function activateStore(storeId: string) {
    if (activeStoreId.value === storeId) return;
    if (!hydrate(storeId)) $reset();
  }

  function evictStore(storeId: string) {
    delete storeCache.value[storeId];
    if (activeStoreId.value === storeId) $reset();
  }

  function $reset() {
    requestSequence += 1;
    locations.value = [];
    inventoryLevels.value = [];
    activeInventoryItemIdsKey.value = "";
    hasFetchedAll.value = false;
    isLoading.value = false;
    error.value = null;
  }

  return {
    locations,
    inventoryLevels,
    activeInventoryItemIdsKey,
    hasFetchedAll,
    isLoading,
    error,
    activeStoreId,
    fetchAll,
    fetchForInventoryItems,
    hydrate,
    evictStore,
    $reset,
  };
});
