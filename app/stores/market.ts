import { defineStore } from "pinia";
import { ref } from "vue";
import { usePerStoreCache } from "~/composables/usePerStoreCache";
import type {
  ShopifyMarketResolution,
  ShopifyMarketsResponse,
  ShopifyMarketStatus,
  ShopifyMarketStatusResponse,
  ShopifyMarketSummary,
} from "~~/types/shopify-market";
import { getAppErrorMessage } from "~~/utils/error";

interface MarketStoreCache {
  markets: ShopifyMarketSummary[];
  hasFetchedAll: boolean;
  listTruncated: boolean;
  fetchedAt: string | null;
  resolution: ShopifyMarketResolution | null;
}

export const useMarketStore = defineStore("market", () => {
  const markets = ref<ShopifyMarketSummary[]>([]);
  const hasFetchedAll = ref(false);
  const listTruncated = ref(false);
  const fetchedAt = ref<string | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const isMutating = ref(false);
  const mutationError = ref<string | null>(null);
  const isResolving = ref(false);
  const resolution = ref<ShopifyMarketResolution | null>(null);
  const resolutionError = ref<string | null>(null);
  let scopeVersion = 0;

  const cache = usePerStoreCache<MarketStoreCache>({
    capture: captureState,
    restore: restoreState,
    reset: resetState,
    onStoreChange: () => {
      scopeVersion += 1;
    },
  });

  async function fetchAll(storeId: string, token: string, force = false) {
    if (!storeId || !token) {
      error.value = "Store ID and Access Token are required.";
      return false;
    }

    cache.activate(storeId);
    if (hasFetchedAll.value && !force) return true;

    const requestVersion = scopeVersion;
    isLoading.value = true;
    error.value = null;
    try {
      const response = await $fetch<ShopifyMarketsResponse>("/api/market/all", {
        method: "POST",
        body: { storeId, token },
      });
      if (!isActive(storeId, requestVersion)) return false;

      markets.value = response.items || [];
      hasFetchedAll.value = true;
      listTruncated.value = response.truncated;
      fetchedAt.value = response.fetchedAt;
      cache.remember(storeId);
      return true;
    } catch (requestError) {
      if (isActive(storeId, requestVersion)) {
        error.value = getAppErrorMessage(requestError, "Failed to fetch markets.");
      }
      return false;
    } finally {
      if (isActive(storeId, requestVersion)) isLoading.value = false;
    }
  }

  async function setStatus(
    storeId: string,
    token: string,
    id: string,
    status: ShopifyMarketStatus,
  ) {
    if (!storeId || !token || isMutating.value) return false;
    cache.activate(storeId);
    const requestVersion = scopeVersion;
    isMutating.value = true;
    mutationError.value = null;
    try {
      const response = await $fetch<ShopifyMarketStatusResponse>("/api/market/status", {
        method: "POST",
        body: { storeId, token, id, status },
      });
      if (!isActive(storeId, requestVersion)) return false;

      markets.value = markets.value.map((market) =>
        market.id === response.id ? { ...market, status: response.status } : market,
      );
      cache.remember(storeId);
      return true;
    } catch (requestError) {
      if (isActive(storeId, requestVersion)) {
        mutationError.value = getAppErrorMessage(
          requestError,
          "Failed to update the market status.",
        );
      }
      return false;
    } finally {
      if (isActive(storeId, requestVersion)) isMutating.value = false;
    }
  }

  async function resolveCountry(storeId: string, token: string, countryCode: string) {
    if (!storeId || !token || isResolving.value) return null;
    cache.activate(storeId);
    const requestVersion = scopeVersion;
    isResolving.value = true;
    resolutionError.value = null;
    try {
      const response = await $fetch<ShopifyMarketResolution>("/api/market/resolve", {
        method: "POST",
        body: { storeId, token, countryCode },
      });
      if (!isActive(storeId, requestVersion)) return null;

      resolution.value = response;
      cache.remember(storeId);
      return response;
    } catch (requestError) {
      if (isActive(storeId, requestVersion)) {
        resolutionError.value = getAppErrorMessage(
          requestError,
          "Failed to resolve the buyer experience.",
        );
      }
      return null;
    } finally {
      if (isActive(storeId, requestVersion)) isResolving.value = false;
    }
  }

  function isActive(storeId: string, requestVersion: number) {
    return cache.isActive(storeId) && scopeVersion === requestVersion;
  }

  function captureState(): MarketStoreCache {
    return {
      markets: [...markets.value],
      hasFetchedAll: hasFetchedAll.value,
      listTruncated: listTruncated.value,
      fetchedAt: fetchedAt.value,
      resolution: resolution.value,
    };
  }

  function restoreState(snapshot: MarketStoreCache) {
    markets.value = [...snapshot.markets];
    hasFetchedAll.value = snapshot.hasFetchedAll;
    listTruncated.value = snapshot.listTruncated;
    fetchedAt.value = snapshot.fetchedAt;
    resolution.value = snapshot.resolution;
    clearTransientState();
  }

  function resetState() {
    markets.value = [];
    hasFetchedAll.value = false;
    listTruncated.value = false;
    fetchedAt.value = null;
    resolution.value = null;
    clearTransientState();
  }

  function clearTransientState() {
    isLoading.value = false;
    error.value = null;
    isMutating.value = false;
    mutationError.value = null;
    isResolving.value = false;
    resolutionError.value = null;
  }

  return {
    markets,
    hasFetchedAll,
    listTruncated,
    fetchedAt,
    isLoading,
    error,
    isMutating,
    mutationError,
    isResolving,
    resolution,
    resolutionError,
    isStoreActive: cache.isActive,
    hydrate: cache.hydrate,
    evictStore: cache.evict,
    fetchAll,
    setStatus,
    resolveCountry,
  };
});
