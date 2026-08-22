import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { usePerStoreCache } from "~/composables/usePerStoreCache";
import { useLocalizationStore } from "~/stores/localization";
import { useProductStore } from "~/stores/product";
import type {
  CollectionCreateDto,
  CollectionDuplicateDto,
  CollectionJobReference,
  CollectionJobState,
  CollectionListQuery,
  CollectionMetafieldIdentifier,
  CollectionMetafieldInput,
  CollectionManagementContext,
  CollectionMutationResult,
  CollectionPublicationInput,
  CollectionSelectionDelta,
  CollectionTranslationInput,
  CollectionTranslationResource,
  CollectionUpdateDto,
  ShopifyCollectionCount,
  ShopifyCollectionDetail,
  ShopifyCollectionPage,
  ShopifyCollectionSummary,
} from "~~/types/shopify-collection";
import { getAppErrorMessage } from "~~/utils/error";

interface CollectionStoreCache {
  collections: ShopifyCollectionSummary[];
  count: ShopifyCollectionCount;
  nextCursor: string | null;
  filters: CollectionListQuery;
  pageSize: number;
  loadedPageCount: number;
  details: Record<string, ShopifyCollectionDetail>;
  managementContext: CollectionManagementContext | null;
  translations: Record<string, Record<string, CollectionTranslationResource>>;
  jobs: Record<string, CollectionJobState>;
  hasFetchedAll: boolean;
}

const EMPTY_COUNT: ShopifyCollectionCount = { count: 0, precision: "EXACT" };

export const useCollectionStore = defineStore("collection", () => {
  const localization = useLocalizationStore();
  const productStore = useProductStore();
  const collections = ref<ShopifyCollectionSummary[]>([]);
  const count = ref<ShopifyCollectionCount>({ ...EMPTY_COUNT });
  const nextCursor = ref<string | null>(null);
  const filters = ref<CollectionListQuery>({});
  const pageSize = ref(50);
  const loadedPageCount = ref(0);
  const details = ref<Record<string, ShopifyCollectionDetail>>({});
  const managementContext = ref<CollectionManagementContext | null>(null);
  const translations = ref<
    Record<string, Record<string, CollectionTranslationResource>>
  >({});
  const jobs = ref<Record<string, CollectionJobState>>({});
  const hasFetchedAll = ref(false);
  const isLoading = ref(false);
  const isLoadingMore = ref(false);
  const isLoadingDetail = ref(false);
  const isMutating = ref(false);
  const isLoadingTranslations = ref(false);
  const error = ref<string | null>(null);
  const detailError = ref<string | null>(null);
  const contextError = ref<string | null>(null);
  const mutationError = ref<string | null>(null);
  const translationError = ref<string | null>(null);
  let storeScopeVersion = 0;
  let listSequence = 0;
  let detailSequence = 0;
  const pollingJobIds = new Set<string>();

  const totalCount = computed(() => count.value.count);
  const activeJobs = computed(() =>
    Object.values(jobs.value).filter((job) => job.status !== "completed"),
  );
  const storeCache = usePerStoreCache<CollectionStoreCache>({
    capture: captureState,
    restore: restoreState,
    reset: resetState,
    onStoreChange: () => {
      storeScopeVersion += 1;
    },
  });

  async function fetchAll(
    storeId: string,
    token: string,
    limit = 50,
    query: CollectionListQuery = {},
  ) {
    if (!storeId || !token) {
      error.value = localization.t("collection.credentialsMissing");
      return false;
    }
    storeCache.activate(storeId);
    const requestScope = storeScopeVersion;
    const requestId = ++listSequence;
    isLoading.value = true;
    error.value = null;
    try {
      const nextPageSize = normalizePageSize(limit);
      const nextFilters = sanitizeFilters(query);
      const response = await $fetch<ShopifyCollectionPage>("/api/collection/page", {
        method: "POST",
        body: {
          storeId,
          token,
          query: { ...nextFilters, limit: nextPageSize },
        },
      });
      if (!isActiveRequest(storeId, requestScope) || requestId !== listSequence) {
        return false;
      }
      collections.value = response.collections;
      count.value = response.count;
      nextCursor.value = response.pageInfo.nextCursor;
      filters.value = nextFilters;
      pageSize.value = nextPageSize;
      loadedPageCount.value = 1;
      hasFetchedAll.value = true;
      storeCache.remember(storeId);
      return true;
    } catch (err) {
      if (isActiveRequest(storeId, requestScope) && requestId === listSequence) {
        error.value = getAppErrorMessage(err, localization.t("collection.fetchFailed"));
      }
      return false;
    } finally {
      if (isActiveRequest(storeId, requestScope) && requestId === listSequence) {
        isLoading.value = false;
      }
    }
  }

  async function fetchNext(storeId: string, token: string) {
    if (!storeId || !token || !nextCursor.value || isLoadingMore.value) return false;
    storeCache.activate(storeId);
    const requestScope = storeScopeVersion;
    const cursor = nextCursor.value;
    isLoadingMore.value = true;
    error.value = null;
    try {
      const response = await $fetch<ShopifyCollectionPage>("/api/collection/page", {
        method: "POST",
        body: {
          storeId,
          token,
          query: { ...filters.value, limit: pageSize.value, pageInfo: cursor },
        },
      });
      if (!isActiveRequest(storeId, requestScope) || cursor !== nextCursor.value) {
        return false;
      }
      const known = new Set(collections.value.map((collection) => collection.id));
      collections.value = [
        ...collections.value,
        ...response.collections.filter((collection) => !known.has(collection.id)),
      ];
      count.value = response.count;
      nextCursor.value = response.pageInfo.nextCursor;
      loadedPageCount.value += 1;
      storeCache.remember(storeId);
      return true;
    } catch (err) {
      if (isActiveRequest(storeId, requestScope)) {
        error.value = getAppErrorMessage(
          err,
          localization.t("collection.nextPageFailed"),
        );
      }
      return false;
    } finally {
      if (isActiveRequest(storeId, requestScope)) isLoadingMore.value = false;
    }
  }

  async function fetchDetail(
    storeId: string,
    token: string,
    collectionId: string,
    force = false,
  ) {
    if (!storeId || !token || !collectionId) return null;
    storeCache.activate(storeId);
    const gid = normalizeCollectionGid(collectionId);
    if (!force && details.value[gid]) return details.value[gid];
    const requestScope = storeScopeVersion;
    const requestId = ++detailSequence;
    isLoadingDetail.value = true;
    detailError.value = null;
    try {
      const detail = await $fetch<ShopifyCollectionDetail>(
        `/api/collection/${encodeURIComponent(legacyId(collectionId))}`,
        { method: "POST", body: { storeId, token } },
      );
      if (!isActiveRequest(storeId, requestScope) || requestId !== detailSequence) {
        return null;
      }
      rememberDetail(storeId, detail);
      return detail;
    } catch (err) {
      if (isActiveRequest(storeId, requestScope) && requestId === detailSequence) {
        detailError.value = getAppErrorMessage(
          err,
          localization.t("collection.detailFailed"),
        );
      }
      return null;
    } finally {
      if (isActiveRequest(storeId, requestScope) && requestId === detailSequence) {
        isLoadingDetail.value = false;
      }
    }
  }

  async function fetchManagementContext(storeId: string, token: string, force = false) {
    if (!storeId || !token) return null;
    storeCache.activate(storeId);
    if (managementContext.value && !force) return managementContext.value;
    const requestScope = storeScopeVersion;
    contextError.value = null;
    try {
      const response = await $fetch<CollectionManagementContext>(
        "/api/collection/context",
        { method: "POST", body: { storeId, token } },
      );
      if (!isActiveRequest(storeId, requestScope)) return null;
      managementContext.value = response;
      storeCache.remember(storeId);
      return response;
    } catch (err) {
      if (isActiveRequest(storeId, requestScope)) {
        contextError.value = getAppErrorMessage(
          err,
          localization.t("collection.contextFailed"),
        );
      }
      return null;
    }
  }

  async function createCollection(
    storeId: string,
    token: string,
    collection: CollectionCreateDto,
  ) {
    return runMutation(
      storeId,
      token,
      async () => {
        const result = await $fetch<CollectionMutationResult>(
          "/api/collection/create",
          {
            method: "POST",
            body: { storeId, token, collection },
          },
        );
        if (result.collection) rememberDetail(storeId, result.collection);
        productStore.invalidateManagementContext(storeId);
        await refreshCurrent(storeId, token);
        return result;
      },
      "collection.createFailed",
    );
  }

  async function updateCollection(
    storeId: string,
    token: string,
    collectionId: string,
    collection: CollectionUpdateDto,
  ) {
    return runMutation(
      storeId,
      token,
      async () => {
        const result = await $fetch<CollectionMutationResult>(
          `/api/collection/${encodeURIComponent(legacyId(collectionId))}`,
          { method: "PUT", body: { storeId, token, collection } },
        );
        if (result.collection) rememberDetail(storeId, result.collection);
        productStore.invalidateManagementContext(storeId);
        if (result.job && !result.job.done) {
          trackCollectionJob(storeId, token, collectionId, result.job, "update");
        }
        await refreshCurrent(storeId, token);
        return result;
      },
      "collection.updateFailed",
    );
  }

  async function duplicateCollection(
    storeId: string,
    token: string,
    collectionId: string,
    duplicate: CollectionDuplicateDto,
  ) {
    return runMutation(
      storeId,
      token,
      async () => {
        const result = await $fetch<CollectionMutationResult>(
          `/api/collection/${encodeURIComponent(legacyId(collectionId))}/duplicate`,
          { method: "POST", body: { storeId, token, duplicate } },
        );
        if (result.collection) {
          rememberDetail(storeId, result.collection);
          if (result.job && !result.job.done) {
            trackCollectionJob(
              storeId,
              token,
              result.collection.id,
              result.job,
              "duplicate",
            );
          }
        }
        productStore.invalidateManagementContext(storeId);
        await refreshCurrent(storeId, token);
        return result;
      },
      "collection.duplicateFailed",
    );
  }

  async function updateSelections(
    storeId: string,
    token: string,
    collectionId: string,
    delta: CollectionSelectionDelta,
  ) {
    return runMutation(
      storeId,
      token,
      async () => {
        const result = await $fetch<CollectionMutationResult>(
          `/api/collection/${encodeURIComponent(legacyId(collectionId))}/selections`,
          { method: "POST", body: { storeId, token, delta } },
        );
        if (result.collection) rememberDetail(storeId, result.collection);
        if (result.job && !result.job.done) {
          trackCollectionJob(storeId, token, collectionId, result.job, "selections");
        }
        await refreshCurrent(storeId, token);
        return result;
      },
      "collection.selectionsFailed",
    );
  }

  async function setPublications(
    storeId: string,
    token: string,
    collectionId: string,
    input: CollectionPublicationInput,
  ) {
    return runMutation(
      storeId,
      token,
      async () => {
        const detail = await $fetch<ShopifyCollectionDetail>(
          `/api/collection/${encodeURIComponent(legacyId(collectionId))}/publications`,
          { method: "POST", body: { storeId, token, ...input } },
        );
        rememberDetail(storeId, detail);
        await refreshCurrent(storeId, token);
        return detail;
      },
      input.publish ? "collection.publishFailed" : "collection.unpublishFailed",
    );
  }

  async function fetchTranslations(
    storeId: string,
    token: string,
    collectionId: string,
    locale: string,
    force = false,
  ) {
    if (!storeId || !token || !collectionId || !locale) return null;
    storeCache.activate(storeId);
    const collectionGid = normalizeCollectionGid(collectionId);
    if (!force && translations.value[collectionGid]?.[locale]) {
      return translations.value[collectionGid]?.[locale] || null;
    }
    const requestScope = storeScopeVersion;
    isLoadingTranslations.value = true;
    translationError.value = null;
    try {
      const resource = await $fetch<CollectionTranslationResource>(
        `/api/collection/${encodeURIComponent(legacyId(collectionId))}/translations`,
        { method: "POST", body: { storeId, token, locale } },
      );
      if (!isActiveRequest(storeId, requestScope)) return null;
      rememberTranslation(storeId, resource);
      return resource;
    } catch (error) {
      if (isActiveRequest(storeId, requestScope)) {
        translationError.value = getAppErrorMessage(
          error,
          localization.t("collection.translationsFailed"),
        );
      }
      return null;
    } finally {
      if (isActiveRequest(storeId, requestScope)) {
        isLoadingTranslations.value = false;
      }
    }
  }

  async function saveTranslations(
    storeId: string,
    token: string,
    collectionId: string,
    locale: string,
    fields: CollectionTranslationInput[],
  ) {
    return runMutation(
      storeId,
      token,
      async () => {
        const resource = await $fetch<CollectionTranslationResource>(
          `/api/collection/${encodeURIComponent(legacyId(collectionId))}/translations`,
          { method: "PUT", body: { storeId, token, locale, fields } },
        );
        rememberTranslation(storeId, resource);
        return resource;
      },
      "collection.translationsFailed",
    );
  }

  async function setMetafields(
    storeId: string,
    token: string,
    collectionId: string,
    metafields: CollectionMetafieldInput[],
  ) {
    return runMutation(
      storeId,
      token,
      async () => {
        const detail = await $fetch<ShopifyCollectionDetail>(
          `/api/collection/${encodeURIComponent(legacyId(collectionId))}/metafields`,
          { method: "PUT", body: { storeId, token, metafields } },
        );
        rememberDetail(storeId, detail);
        return detail;
      },
      "collection.metafieldsFailed",
    );
  }

  async function deleteMetafields(
    storeId: string,
    token: string,
    collectionId: string,
    metafields: CollectionMetafieldIdentifier[],
  ) {
    return runMutation(
      storeId,
      token,
      async () => {
        const detail = await $fetch<ShopifyCollectionDetail>(
          `/api/collection/${encodeURIComponent(legacyId(collectionId))}/metafields`,
          { method: "DELETE", body: { storeId, token, metafields } },
        );
        rememberDetail(storeId, detail);
        return detail;
      },
      "collection.metafieldsFailed",
    );
  }

  async function deleteCollection(
    storeId: string,
    token: string,
    collectionId: string,
  ) {
    return runMutation(
      storeId,
      token,
      async () => {
        const endpoint: string = `/api/collection/${encodeURIComponent(legacyId(collectionId))}`;
        await $fetch(endpoint, {
          method: "DELETE",
          body: { storeId, token },
        });
        delete details.value[normalizeCollectionGid(collectionId)];
        productStore.invalidateManagementContext(storeId);
        await refreshCurrent(storeId, token);
        return true;
      },
      "collection.deleteFailed",
    );
  }

  async function runMutation<T>(
    storeId: string,
    token: string,
    operation: () => Promise<T>,
    fallbackKey: Parameters<typeof localization.t>[0],
  ): Promise<T | null> {
    if (!storeId || !token || isMutating.value) return null;
    storeCache.activate(storeId);
    const requestScope = storeScopeVersion;
    isMutating.value = true;
    mutationError.value = null;
    try {
      return await operation();
    } catch (err) {
      if (isActiveRequest(storeId, requestScope)) {
        mutationError.value = getAppErrorMessage(err, localization.t(fallbackKey));
      }
      return null;
    } finally {
      if (isActiveRequest(storeId, requestScope)) isMutating.value = false;
    }
  }

  function rememberDetail(storeId: string, detail: ShopifyCollectionDetail) {
    details.value = { ...details.value, [detail.id]: detail };
    storeCache.remember(storeId);
  }

  function trackCollectionJob(
    storeId: string,
    token: string,
    collectionId: string,
    job: CollectionJobReference,
    action: CollectionJobState["action"],
  ) {
    const normalizedCollectionId = normalizeCollectionGid(collectionId);
    rememberJob(storeId, {
      ...job,
      collectionId: normalizedCollectionId,
      action,
      status: "queued",
      error: null,
    });
    void pollCollectionJob(storeId, token, job.id);
  }

  function retryActiveJobs(storeId: string, token: string) {
    if (!storeId || !token) return;
    for (const job of activeJobs.value) {
      rememberJob(storeId, { ...job, status: "queued", error: null });
      void pollCollectionJob(storeId, token, job.id, true);
    }
  }

  async function pollCollectionJob(
    storeId: string,
    token: string,
    jobId: string,
    immediate = false,
  ) {
    if (pollingJobIds.has(jobId)) return;
    pollingJobIds.add(jobId);
    const requestScope = storeScopeVersion;
    const delays = immediate
      ? [0, 1_000, 2_000, 4_000, 8_000, 15_000]
      : [1_000, 2_000, 4_000, 8_000, 15_000];
    let lastError: string | null = null;

    try {
      for (const delay of delays) {
        await waitFor(delay);
        if (!isActiveRequest(storeId, requestScope)) return;
        const current = jobs.value[jobId];
        if (!current || current.status === "completed") return;
        rememberJob(storeId, { ...current, status: "polling", error: null });
        try {
          const status = await $fetch<CollectionJobReference>("/api/collection/job", {
            method: "POST",
            body: { storeId, token, jobId },
          });
          if (!isActiveRequest(storeId, requestScope)) return;
          if (!status.done) continue;
          rememberJob(storeId, {
            ...current,
            ...status,
            status: "completed",
            error: null,
          });
          await fetchDetail(storeId, token, current.collectionId, true);
          await refreshCurrent(storeId, token);
          return;
        } catch (error) {
          lastError = getAppErrorMessage(
            error,
            localization.t("collection.jobStatusFailed"),
          );
        }
      }

      if (!isActiveRequest(storeId, requestScope)) return;
      const current = jobs.value[jobId];
      if (current) {
        rememberJob(storeId, {
          ...current,
          status: "unknown",
          error: lastError || localization.t("collection.jobStatusUnknown"),
        });
      }
    } finally {
      pollingJobIds.delete(jobId);
    }
  }

  function rememberJob(storeId: string, job: CollectionJobState) {
    jobs.value = { ...jobs.value, [job.id]: job };
    storeCache.remember(storeId);
  }

  function rememberTranslation(
    storeId: string,
    resource: CollectionTranslationResource,
  ) {
    translations.value = {
      ...translations.value,
      [resource.resourceId]: {
        ...translations.value[resource.resourceId],
        [resource.locale]: resource,
      },
    };
    storeCache.remember(storeId);
  }

  function isActiveRequest(storeId: string, requestScope: number) {
    return storeCache.isActive(storeId) && storeScopeVersion === requestScope;
  }

  function refreshCurrent(storeId: string, token: string) {
    return fetchAll(storeId, token, pageSize.value, filters.value);
  }

  function captureState(): CollectionStoreCache {
    return {
      collections: [...collections.value],
      count: { ...count.value },
      nextCursor: nextCursor.value,
      filters: { ...filters.value },
      pageSize: pageSize.value,
      loadedPageCount: loadedPageCount.value,
      details: { ...details.value },
      managementContext: managementContext.value,
      translations: { ...translations.value },
      jobs: { ...jobs.value },
      hasFetchedAll: hasFetchedAll.value,
    };
  }

  function restoreState(cached: CollectionStoreCache) {
    collections.value = [...cached.collections];
    count.value = { ...cached.count };
    nextCursor.value = cached.nextCursor;
    filters.value = { ...cached.filters };
    pageSize.value = cached.pageSize;
    loadedPageCount.value = cached.loadedPageCount;
    details.value = { ...cached.details };
    managementContext.value = cached.managementContext;
    translations.value = { ...(cached.translations || {}) };
    jobs.value = { ...cached.jobs };
    hasFetchedAll.value = cached.hasFetchedAll;
    error.value = null;
    detailError.value = null;
    contextError.value = null;
    mutationError.value = null;
    translationError.value = null;
    isLoadingTranslations.value = false;
  }

  function resetState() {
    listSequence += 1;
    detailSequence += 1;
    collections.value = [];
    count.value = { ...EMPTY_COUNT };
    nextCursor.value = null;
    filters.value = {};
    pageSize.value = 50;
    loadedPageCount.value = 0;
    details.value = {};
    managementContext.value = null;
    translations.value = {};
    jobs.value = {};
    hasFetchedAll.value = false;
    isLoading.value = false;
    isLoadingMore.value = false;
    isLoadingDetail.value = false;
    isMutating.value = false;
    isLoadingTranslations.value = false;
    error.value = null;
    detailError.value = null;
    contextError.value = null;
    mutationError.value = null;
    translationError.value = null;
  }

  function $reset() {
    storeScopeVersion += 1;
    resetState();
  }

  return {
    collections,
    count,
    totalCount,
    nextCursor,
    filters,
    pageSize,
    loadedPageCount,
    details,
    managementContext,
    translations,
    jobs,
    activeJobs,
    hasFetchedAll,
    isLoading,
    isLoadingMore,
    isLoadingDetail,
    isMutating,
    isLoadingTranslations,
    error,
    detailError,
    contextError,
    mutationError,
    translationError,
    isStoreActive: storeCache.isActive,
    fetchAll,
    fetchNext,
    fetchDetail,
    fetchManagementContext,
    createCollection,
    updateCollection,
    duplicateCollection,
    updateSelections,
    setPublications,
    fetchTranslations,
    saveTranslations,
    setMetafields,
    deleteMetafields,
    deleteCollection,
    retryActiveJobs,
    hydrate: storeCache.hydrate,
    evictStore: storeCache.evict,
    $reset,
  };
});

function normalizePageSize(value: number) {
  return Math.min(100, Math.max(1, Math.trunc(Number(value) || 50)));
}

function sanitizeFilters(query: CollectionListQuery): CollectionListQuery {
  return Object.fromEntries(
    Object.entries(query).filter(
      ([key, value]) =>
        key !== "pageInfo" &&
        key !== "limit" &&
        value !== undefined &&
        value !== null &&
        String(value).trim() !== "",
    ),
  );
}

function legacyId(value: string) {
  return String(value).slice(String(value).lastIndexOf("/") + 1);
}

function normalizeCollectionGid(value: string) {
  return value.startsWith("gid://shopify/Collection/")
    ? value
    : `gid://shopify/Collection/${legacyId(value)}`;
}

function waitFor(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}
