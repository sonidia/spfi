<script setup lang="ts">
import { ChevronDown, ImageOff, LoaderCircle, Plus, Search } from "@lucide/vue";
import { computed, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useStoreFeedback } from "~/composables/useStoreFeedback";
import { useCollectionStore } from "~/stores/collection";
import type {
  CollectionListQuery,
  CollectionSortKey,
  ShopifyCollectionDetail,
  ShopifyCollectionSummary,
} from "~~/types/shopify-collection";
import CollectionEditorModal from "./CollectionEditorModal.vue";

const collectionStore = useCollectionStore();
const { storeId, token } = useActiveShopAuth();
const feedback = useStoreFeedback();
const route = useRoute();
const router = useRouter();
const { t } = useLocalization();
const isCreating = ref(false);
const selectedCollectionId = ref("");
const filterForm = reactive({
  search: "",
  publishedStatus: "" as "" | "published" | "unpublished",
  sortKey: "UPDATED_AT" as CollectionSortKey,
  reverse: true,
});
const selectedDetail = computed(() =>
  selectedCollectionId.value
    ? collectionStore.details[selectedCollectionId.value] || null
    : null,
);
const countLabel = computed(() =>
  collectionStore.count.precision === "AT_LEAST"
    ? t("collection.countAtLeast", { count: collectionStore.totalCount })
    : t("collection.countExact", { count: collectionStore.totalCount }),
);
const publicationOptions = computed(() => [
  { value: "", label: t("collection.anyPublicationStatus") },
  { value: "published", label: t("collection.published") },
  { value: "unpublished", label: t("collection.unpublished") },
]);
const sortOptions = computed<Array<{ value: CollectionSortKey; label: string }>>(() => [
  { value: "UPDATED_AT", label: t("collection.sortUpdated") },
  { value: "TITLE", label: t("collection.sortTitle") },
  { value: "ID", label: t("collection.sortId") },
  { value: "RELEVANCE", label: t("collection.sortRelevance") },
]);
const sortDirectionOptions = computed(() => [
  { value: "DESC", label: t("collection.descending") },
  { value: "ASC", label: t("collection.ascending") },
]);

watch(
  () => route.query.collection,
  (value) => {
    const collectionId = firstQueryValue(value);
    if (
      collectionId &&
      legacyId(collectionId) !== legacyId(selectedCollectionId.value)
    ) {
      void openCollection(collectionId);
      return;
    }
    if (!collectionId && !isCreating.value) selectedCollectionId.value = "";
  },
  { immediate: true },
);

async function applyFilters() {
  if (!storeId.value || !token.value) return;
  const query: CollectionListQuery = {
    search: filterForm.search,
    publishedStatus: filterForm.publishedStatus || undefined,
    sortKey: filterForm.sortKey,
    reverse: filterForm.reverse,
  };
  await collectionStore.fetchAll(storeId.value, token.value, 50, query);
}

async function resetFilters() {
  filterForm.search = "";
  filterForm.publishedStatus = "";
  filterForm.sortKey = "UPDATED_AT";
  filterForm.reverse = true;
  await applyFilters();
}

async function openCollection(collection: ShopifyCollectionSummary | string) {
  if (!storeId.value || !token.value) return;
  const id = typeof collection === "string" ? collection : collection.id;
  const legacyResourceId =
    typeof collection === "string" ? legacyId(collection) : collection.legacyResourceId;
  const [detail] = await Promise.all([
    collectionStore.fetchDetail(storeId.value, token.value, id),
    collectionStore.fetchManagementContext(storeId.value, token.value),
  ]);
  if (!detail) {
    feedback.error(collectionStore.detailError, t("collection.detailFailed"));
    return;
  }
  isCreating.value = false;
  selectedCollectionId.value = detail.id;
  void router.replace({
    query: { ...route.query, resource: undefined, collection: legacyResourceId },
  });
}

async function openCreate() {
  if (!storeId.value || !token.value) return;
  await collectionStore.fetchManagementContext(storeId.value, token.value);
  isCreating.value = true;
  selectedCollectionId.value = "";
}

function closeEditor() {
  isCreating.value = false;
  selectedCollectionId.value = "";
  void router.replace({
    query: { ...route.query, resource: undefined, collection: undefined },
  });
}

function onSaved(detail: ShopifyCollectionDetail) {
  isCreating.value = false;
  selectedCollectionId.value = detail.id;
  void router.replace({
    query: {
      ...route.query,
      resource: undefined,
      collection: detail.legacyResourceId,
    },
  });
}

async function loadNext() {
  if (!storeId.value || !token.value) return;
  await collectionStore.fetchNext(storeId.value, token.value);
}

function retryJobs() {
  if (!storeId.value || !token.value) return;
  collectionStore.retryActiveJobs(storeId.value, token.value);
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function sourceLabel(collection: ShopifyCollectionSummary) {
  if (!collection.sources.length) return t("collection.noSources");
  const types = new Set(collection.sources.map((source) => source.type));
  if (types.size > 1) return t("collection.mixedSources");
  const source = collection.sources[0];
  if (source?.type === "conditions" && source.targetType === "VARIANTS") {
    return t("collection.variantSource");
  }
  if (source?.type === "conditions") return t("collection.conditionsSource");
  if (source?.type === "subCollections") return t("collection.subCollectionSource");
  return t("collection.unknownSource");
}

function firstQueryValue(value: unknown) {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === "string" ? first : "";
}

function legacyId(value: string) {
  return value.slice(value.lastIndexOf("/") + 1);
}
</script>

<template>
  <section class="collections-tab">
    <div class="collections-toolbar">
      <div>
        <strong>{{ t("collection.titlePlural") }}</strong>
        <span>{{ countLabel }}</span>
      </div>
      <BaseButton variant="primary" size="medium" @click="openCreate">
        <template #icon><Plus aria-hidden="true" /></template>
        {{ t("collection.add") }}
      </BaseButton>
    </div>

    <form class="collection-filters" @submit.prevent="applyFilters">
      <BaseTextField
        v-model="filterForm.search"
        class-name="collection-search"
        type="search"
        :aria-label="t('collection.searchPlaceholder')"
        :placeholder="t('collection.searchPlaceholder')"
      >
        <template #icon><Search aria-hidden="true" /></template>
      </BaseTextField>
      <BaseSelect
        class-name="collection-filter-select"
        :model-value="filterForm.publishedStatus"
        :options="publicationOptions"
        :aria-label="t('collection.status')"
        @update:model-value="
          filterForm.publishedStatus = String(
            $event || '',
          ) as typeof filterForm.publishedStatus
        "
      />
      <BaseSelect
        class-name="collection-filter-select"
        :model-value="filterForm.sortKey"
        :options="sortOptions"
        :aria-label="t('collection.sortBy')"
        @update:model-value="
          filterForm.sortKey = String($event || 'UPDATED_AT') as CollectionSortKey
        "
      />
      <BaseSelect
        class-name="collection-filter-select"
        :model-value="filterForm.reverse ? 'DESC' : 'ASC'"
        :options="sortDirectionOptions"
        :aria-label="t('collection.sortDirection')"
        @update:model-value="filterForm.reverse = $event !== 'ASC'"
      />
      <BaseButton type="submit" size="medium">{{ t("common.search") }}</BaseButton>
      <BaseButton type="button" size="medium" variant="ghost" @click="resetFilters">
        {{ t("common.reset") }}
      </BaseButton>
    </form>

    <div
      v-if="collectionStore.activeJobs.length"
      class="collection-job-state"
      role="status"
    >
      <LoaderCircle
        v-if="collectionStore.activeJobs.some((job) => job.status !== 'unknown')"
        class="spin"
        aria-hidden="true"
      />
      <span>
        {{
          t("collection.jobsPending", {
            count: collectionStore.activeJobs.length,
          })
        }}
      </span>
      <small v-if="collectionStore.activeJobs.some((job) => job.status === 'unknown')">
        {{ t("collection.jobStatusUnknown") }}
      </small>
      <BaseButton
        v-if="collectionStore.activeJobs.some((job) => job.status === 'unknown')"
        size="small"
        variant="ghost"
        @click="retryJobs"
      >
        {{ t("collection.checkJobs") }}
      </BaseButton>
    </div>

    <div
      v-if="collectionStore.isLoading && !collectionStore.collections.length"
      class="collection-state"
    >
      <LoaderCircle class="spin" aria-hidden="true" />
      {{ t("collection.loading") }}
    </div>
    <div v-else-if="collectionStore.error" class="collection-state error" role="alert">
      {{ collectionStore.error }}
    </div>
    <div v-else class="collection-table-card">
      <table>
        <thead>
          <tr>
            <th>{{ t("collection.collection") }}</th>
            <th>{{ t("collection.source") }}</th>
            <th>{{ t("collection.products") }}</th>
            <th>{{ t("collection.sortOrder") }}</th>
            <th>{{ t("collection.updated") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="collection in collectionStore.collections"
            :key="collection.id"
            tabindex="0"
            @click="openCollection(collection)"
            @keydown.enter="openCollection(collection)"
          >
            <td>
              <div class="collection-identity">
                <img v-if="collection.image" :src="collection.image.url" alt="" />
                <span v-else class="collection-image-placeholder">
                  <ImageOff aria-hidden="true" />
                </span>
                <span>
                  <strong>{{ collection.title }}</strong>
                  <small>/collections/{{ collection.handle }}</small>
                </span>
              </div>
            </td>
            <td>
              <span class="source-badge">{{ sourceLabel(collection) }}</span>
              <small v-if="collection.sources.length > 1" class="source-count">
                {{ t("collection.sourceCount", { count: collection.sources.length }) }}
              </small>
            </td>
            <td>
              {{ collection.productsCount.precision === "AT_LEAST" ? "≥ " : ""
              }}{{ collection.productsCount.count }}
            </td>
            <td>{{ collection.sortOrder.replaceAll("_", " ") }}</td>
            <td>{{ formatDate(collection.updatedAt) }}</td>
          </tr>
          <tr v-if="!collectionStore.collections.length">
            <td colspan="5" class="collection-empty">
              {{ t("collection.empty") }}
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="collectionStore.nextCursor" class="collection-load-more">
        <BaseButton :disabled="collectionStore.isLoadingMore" @click="loadNext">
          <template #icon>
            <LoaderCircle v-if="collectionStore.isLoadingMore" class="spin" />
            <ChevronDown v-else aria-hidden="true" />
          </template>
          {{ t("collection.loadMore") }}
        </BaseButton>
      </div>
    </div>

    <div v-if="collectionStore.isLoadingDetail" class="collection-detail-loading">
      <LoaderCircle class="spin" aria-hidden="true" />
      {{ t("collection.loadingDetail") }}
    </div>

    <CollectionEditorModal
      :open="isCreating || Boolean(selectedDetail)"
      :creating="isCreating"
      :detail="selectedDetail"
      :store-id="storeId"
      :token="token"
      @close="closeEditor"
      @saved="onSaved"
      @deleted="closeEditor"
    />
  </section>
</template>

<style scoped>
.collections-tab {
  display: grid;
  gap: 12px;
}

.collections-toolbar,
.collection-filters {
  display: flex;
  align-items: center;
  gap: 9px;
}

.collections-toolbar {
  justify-content: space-between;
}

.collections-toolbar > div {
  display: grid;
  gap: 2px;
}

.collections-toolbar strong {
  font-size: 16px;
}

.collections-toolbar span {
  color: var(--text-muted);
  font-size: 11px;
}

.collection-filters {
  flex-wrap: wrap;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
}

.collection-search {
  min-width: min(310px, 100%);
  flex: 1;
}

.collection-filters :deep(.collection-filter-select) {
  flex: 1 1 170px;
}

.collection-table-card {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
}

.collection-table-card table {
  min-width: 780px;
}

.collection-table-card tbody tr:focus-visible {
  outline: 2px solid var(--green);
  outline-offset: -2px;
}

.collection-identity {
  min-width: 260px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.collection-identity img,
.collection-image-placeholder {
  width: 46px;
  height: 46px;
  flex: 0 0 46px;
  border-radius: 7px;
  object-fit: cover;
  background: var(--surface-soft);
}

.collection-image-placeholder {
  display: grid;
  place-items: center;
  color: var(--text-muted);
}

.collection-image-placeholder svg {
  width: 17px;
}

.collection-identity > span:last-child {
  min-width: 0;
  display: grid;
  gap: 3px;
}

.collection-identity strong,
.collection-identity small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.collection-identity small,
.source-count {
  color: var(--text-muted);
  font-size: 10px;
}

.source-badge {
  display: inline-flex;
  padding: 4px 7px;
  border-radius: 999px;
  background: var(--green-soft);
  color: var(--green);
  font-size: 10px;
}

.source-count {
  display: block;
  margin-top: 3px;
}

.collection-state,
.collection-detail-loading,
.collection-empty {
  padding: 38px;
  color: var(--text-muted);
  text-align: center;
}

.collection-state {
  display: flex;
  justify-content: center;
  gap: 8px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
}

.collection-state.error {
  color: var(--red);
}

.collection-job-state {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border: 1px solid color-mix(in srgb, var(--amber) 24%, var(--border));
  border-radius: 9px;
  background: var(--amber-soft);
  color: var(--amber);
  font-size: 12px;
}

.collection-job-state small {
  margin-left: auto;
  color: inherit;
}

.collection-detail-loading {
  position: fixed;
  inset: 0;
  z-index: 1290;
  display: grid;
  place-content: center;
  gap: 8px;
  background: rgba(12, 20, 16, 0.42);
  color: white;
}

.collection-load-more {
  display: flex;
  justify-content: center;
  padding: 12px;
  border-top: 1px solid var(--border);
}

.spin {
  animation: collections-spin 0.8s linear infinite;
}

@keyframes collections-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 760px) {
  .collection-table-card {
    overflow-x: auto;
  }

  .collection-filters > * {
    flex: 1 1 150px;
  }
}
</style>
