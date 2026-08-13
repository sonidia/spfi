import { defineStore } from "pinia";
import { ref } from "vue";
import { usePerStoreCache } from "~/composables/usePerStoreCache";
import type {
  ShopifyMarketEditorContext,
  ShopifyMarketListFilters,
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
  const filteredResults = ref<ShopifyMarketSummary[] | null>(null);
  const filteredTruncated = ref(false);
  const isFiltering = ref(false);
  const filterError = ref<string | null>(null);
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
  let filterVersion = 0;
  let activeFilters: ShopifyMarketListFilters | null = null;

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

  async function fetchFiltered(
    storeId: string,
    token: string,
    filters: ShopifyMarketListFilters,
  ) {
    if (!storeId || !token) return false;
    cache.activate(storeId);
    const requestVersion = scopeVersion;
    const requestFilterVersion = ++filterVersion;
    isFiltering.value = true;
    filterError.value = null;
    try {
      const response = await $fetch<ShopifyMarketsResponse>("/api/market/all", {
        method: "POST",
        body: { storeId, token, filters },
      });
      if (
        !isActive(storeId, requestVersion) ||
        requestFilterVersion !== filterVersion
      ) {
        return false;
      }
      filteredResults.value = response.items || [];
      filteredTruncated.value = response.truncated;
      activeFilters = { ...filters };
      return true;
    } catch (requestError) {
      if (isActive(storeId, requestVersion) && requestFilterVersion === filterVersion) {
        filterError.value = getAppErrorMessage(
          requestError,
          "Failed to filter markets.",
        );
      }
      return false;
    } finally {
      if (isActive(storeId, requestVersion) && requestFilterVersion === filterVersion) {
        isFiltering.value = false;
      }
    }
  }

  function clearFiltered() {
    filterVersion += 1;
    filteredResults.value = null;
    filteredTruncated.value = false;
    activeFilters = null;
    filterError.value = null;
    isFiltering.value = false;
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
      if (filteredResults.value) {
        filteredResults.value = filteredResults.value
          .map((market) =>
            market.id === response.id ? { ...market, status: response.status } : market,
          )
          .filter(matchesActiveFilters);
      }
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
    if (market && filteredResults.value && matchesActiveFilters(market)) {
      filteredResults.value = [market, ...filteredResults.value];
    }
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
    if (filteredResults.value) {
      const exists = filteredResults.value.some((item) => item.id === market.id);
      filteredResults.value = filteredResults.value
        .map((item) => (item.id === market.id ? market : item))
        .filter(matchesActiveFilters);
      if (!exists && matchesActiveFilters(market)) {
        filteredResults.value = [market, ...filteredResults.value];
      }
    }
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
      if (filteredResults.value) {
        filteredResults.value = filteredResults.value.map((market) => ({
          ...market,
          webPresences: market.webPresences.map((item) =>
            item.id === presence.id ? presence : item,
          ),
        }));
      }
      cache.remember(storeId);
    }
    return presence;
  }

  async function deleteWebPresence(storeId: string, token: string, id: string) {
    const result = await requestManagement<{ id: string }>(
      storeId,
      token,
      "/api/market/web-presence/delete",
      { id },
    );
    if (!result) return false;
    if (editorContext.value) {
      editorContext.value = {
        ...editorContext.value,
        webPresences: editorContext.value.webPresences.filter(
          (item) => item.id !== result.id,
        ),
      };
    }
    markets.value = markets.value.map((market) => ({
      ...market,
      webPresences: market.webPresences.filter((item) => item.id !== result.id),
    }));
    if (filteredResults.value) {
      filteredResults.value = filteredResults.value.map((market) => ({
        ...market,
        webPresences: market.webPresences.filter((item) => item.id !== result.id),
      }));
    }
    cache.remember(storeId);
    return true;
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

  function matchesActiveFilters(market: ShopifyMarketSummary) {
    if (!activeFilters) return true;
    const search = activeFilters.search?.trim().toLowerCase();
    if (search && !market.name.toLowerCase().includes(search)) return false;
    if (activeFilters.status && market.status !== activeFilters.status) return false;
    if (activeFilters.type && market.type !== activeFilters.type) return false;
    if (
      activeFilters.conditionTypes?.length &&
      !activeFilters.conditionTypes.every((type) =>
        market.conditionTypes.includes(type),
      )
    ) {
      return false;
    }
    return true;
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
    clearFiltered();
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
    clearFiltered();
    clearTransientState();
  }

  function clearTransientState() {
    isLoading.value = false;
    error.value = null;
    isFiltering.value = false;
    filterError.value = null;
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
    filteredResults,
    filteredTruncated,
    isFiltering,
    filterError,
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
    fetchFiltered,
    clearFiltered,
    setStatus,
    resolveCountry,
    fetchEditorContext,
    createMarket,
    updateMarket,
    createWebPresence,
    updateWebPresence,
    deleteWebPresence,
    loadLocalization,
    saveLocalization,
    clearLocalization,
  };
});
