import { defineStore } from "pinia";
import { ref } from "vue";
import { usePerStoreCache } from "~/composables/usePerStoreCache";
import type {
  ShopifyMarketEditorContext,
  ShopifyMarketLocalizationResource,
  ShopifyMarketResolution,
  ShopifyMarketsResponse,
  ShopifyMarketStatus,
  ShopifyMarketStatusResponse,
  ShopifyMarketSummary,
  ShopifyMarketWebPresenceSummary,
} from "~~/types/shopify-market";
import { getAppErrorMessage } from "~~/utils/error";

interface MarketStoreCache {
  markets: ShopifyMarketSummary[];
  hasFetchedAll: boolean;
  listTruncated: boolean;
  fetchedAt: string | null;
  resolution: ShopifyMarketResolution | null;
  editorContext: ShopifyMarketEditorContext | null;
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
  const editorContext = ref<ShopifyMarketEditorContext | null>(null);
  const isManaging = ref(false);
  const managerError = ref<string | null>(null);
  const localization = ref<ShopifyMarketLocalizationResource | null>(null);
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

  async function fetchEditorContext(storeId: string, token: string, force = false) {
    if (!storeId || !token || isManaging.value) return null;
    cache.activate(storeId);
    if (editorContext.value && !force) return editorContext.value;
    const requestVersion = scopeVersion;
    isManaging.value = true;
    managerError.value = null;
    try {
      const response = await $fetch<ShopifyMarketEditorContext>("/api/market/context", {
        method: "POST",
        body: { storeId, token },
      });
      if (!isActive(storeId, requestVersion)) return null;
      editorContext.value = response;
      cache.remember(storeId);
      return response;
    } catch (requestError) {
      if (isActive(storeId, requestVersion)) {
        managerError.value = getAppErrorMessage(
          requestError,
          "Failed to load the Markets editor.",
        );
      }
      return null;
    } finally {
      if (isActive(storeId, requestVersion)) isManaging.value = false;
    }
  }

  async function createMarket(
    storeId: string,
    token: string,
    input: Record<string, unknown>,
  ) {
    const market = await requestMarket(storeId, token, "/api/market/create", {
      input,
    });
    if (market) markets.value = [market, ...markets.value];
    if (market) cache.remember(storeId);
    return market;
  }

  async function updateMarket(
    storeId: string,
    token: string,
    route: string,
    id: string,
    input: Record<string, unknown>,
  ) {
    const market = await requestMarket(storeId, token, route, { id, ...input });
    if (!market) return null;
    markets.value = markets.value.map((item) =>
      item.id === market.id ? market : item,
    );
    cache.remember(storeId);
    return market;
  }

  async function createWebPresence(
    storeId: string,
    token: string,
    input: Record<string, unknown>,
  ) {
    const presence = await requestManagement<ShopifyMarketWebPresenceSummary>(
      storeId,
      token,
      "/api/market/web-presence/create",
      { input },
    );
    if (presence && editorContext.value) {
      editorContext.value = {
        ...editorContext.value,
        webPresences: [presence, ...editorContext.value.webPresences],
      };
      cache.remember(storeId);
    }
    return presence;
  }

  async function updateWebPresence(
    storeId: string,
    token: string,
    id: string,
    input: Record<string, unknown>,
  ) {
    const presence = await requestManagement<ShopifyMarketWebPresenceSummary>(
      storeId,
      token,
      "/api/market/web-presence/update",
      { id, input },
    );
    if (presence && editorContext.value) {
      editorContext.value = {
        ...editorContext.value,
        webPresences: editorContext.value.webPresences.map((item) =>
          item.id === presence.id ? presence : item,
        ),
      };
      markets.value = markets.value.map((market) => ({
        ...market,
        webPresences: market.webPresences.map((item) =>
          item.id === presence.id ? presence : item,
        ),
      }));
      cache.remember(storeId);
    }
    return presence;
  }

  async function loadLocalization(
    storeId: string,
    token: string,
    marketId: string,
    resourceId: string,
    locale = "",
  ) {
    localization.value = await requestManagement<ShopifyMarketLocalizationResource>(
      storeId,
      token,
      "/api/market/localization/read",
      { marketId, resourceId, locale },
    );
    return localization.value;
  }

  async function saveLocalization(
    storeId: string,
    token: string,
    marketId: string,
    resourceId: string,
    fields: Array<{ key: string; digest: string; value: string }>,
    locale = "",
  ) {
    const result = await requestManagement<{ success: boolean }>(
      storeId,
      token,
      "/api/market/localization/save",
      { marketId, resourceId, fields, locale },
    );
    return Boolean(result?.success);
  }

  async function requestMarket(
    storeId: string,
    token: string,
    route: string,
    body: Record<string, unknown>,
  ) {
    return requestManagement<ShopifyMarketSummary>(storeId, token, route, body);
  }

  async function requestManagement<T>(
    storeId: string,
    token: string,
    route: string,
    body: Record<string, unknown>,
  ): Promise<T | null> {
    if (!storeId || !token || isManaging.value || isMutating.value) return null;
    cache.activate(storeId);
    const requestVersion = scopeVersion;
    isManaging.value = true;
    isMutating.value = true;
    managerError.value = null;
    mutationError.value = null;
    try {
      const fetchManagementApi = $fetch as unknown as <Response>(
        url: string,
        options: { method: "POST"; body: Record<string, unknown> },
      ) => Promise<Response>;
      const response = await fetchManagementApi<T>(route, {
        method: "POST",
        body: { storeId, token, ...body },
      });
      return isActive(storeId, requestVersion) ? response : null;
    } catch (requestError) {
      if (isActive(storeId, requestVersion)) {
        managerError.value = getAppErrorMessage(
          requestError,
          "Shopify rejected the Markets update.",
        );
        mutationError.value = managerError.value;
      }
      return null;
    } finally {
      if (isActive(storeId, requestVersion)) {
        isManaging.value = false;
        isMutating.value = false;
      }
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
      editorContext: editorContext.value,
    };
  }

  function restoreState(snapshot: MarketStoreCache) {
    markets.value = [...snapshot.markets];
    hasFetchedAll.value = snapshot.hasFetchedAll;
    listTruncated.value = snapshot.listTruncated;
    fetchedAt.value = snapshot.fetchedAt;
    resolution.value = snapshot.resolution;
    editorContext.value = snapshot.editorContext;
    clearTransientState();
  }

  function resetState() {
    markets.value = [];
    hasFetchedAll.value = false;
    listTruncated.value = false;
    fetchedAt.value = null;
    resolution.value = null;
    editorContext.value = null;
    localization.value = null;
    clearTransientState();
  }

  function clearTransientState() {
    isLoading.value = false;
    error.value = null;
    isMutating.value = false;
    mutationError.value = null;
    isResolving.value = false;
    resolutionError.value = null;
    isManaging.value = false;
    managerError.value = null;
  }

  function clearLocalization() {
    localization.value = null;
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
    editorContext,
    isManaging,
    managerError,
    localization,
    isStoreActive: cache.isActive,
    hydrate: cache.hydrate,
    evictStore: cache.evict,
    fetchAll,
    setStatus,
    resolveCountry,
    fetchEditorContext,
    createMarket,
    updateMarket,
    createWebPresence,
    updateWebPresence,
    loadLocalization,
    saveLocalization,
    clearLocalization,
  };
});
