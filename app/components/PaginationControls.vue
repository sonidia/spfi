<script setup lang="ts">
import { ChevronLeft, ChevronRight } from "@lucide/vue";
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    page: number;
    pageSize: number;
    totalItems: number;
    pageSizeOptions?: number[];
    itemLabel?: string;
    hasNextPage?: boolean;
    hasPreviousPage?: boolean;
    loading?: boolean;
  }>(),
  {
    pageSizeOptions: () => [10, 20, 50],
    itemLabel: "items",
  },
);

const emit = defineEmits<{
  "update:page": [page: number];
  "update:pageSize": [pageSize: number];
}>();
const { t } = useLocalization();

const totalPages = computed(() =>
  Math.max(1, Math.ceil(props.totalItems / props.pageSize)),
);
const safePage = computed(() => Math.min(props.page, totalPages.value));
const firstItem = computed(() =>
  props.totalItems ? (safePage.value - 1) * props.pageSize + 1 : 0,
);
const lastItem = computed(() =>
  Math.min(safePage.value * props.pageSize, props.totalItems),
);
const pageSizeSelectOptions = computed(() =>
  props.pageSizeOptions.map((option) => ({
    label: String(option),
    value: option,
  })),
);
const canGoPrevious = computed(() => props.hasPreviousPage ?? safePage.value > 1);
const canGoNext = computed(
  () => props.hasNextPage ?? safePage.value < totalPages.value,
);

function updatePageSize(value: unknown) {
  const nextPageSize = Number(value);
  if (Number.isFinite(nextPageSize)) {
    emit("update:pageSize", nextPageSize);
  }
}
</script>

<template>
  <nav class="pagination" :aria-label="t('pagination.label')">
    <div class="pagination-summary" aria-live="polite">
      <strong>{{ firstItem }}–{{ lastItem }}</strong>
      <span>
        {{ t("pagination.summary", { total: totalItems, items: itemLabel }) }}
      </span>
    </div>

    <div class="pagination-actions">
      <label class="page-size">
        <span>{{ t("pagination.rows") }}</span>
        <BaseSelect
          class-name="page-size-select"
          size="small"
          :model-value="pageSize"
          :options="pageSizeSelectOptions"
          @update:model-value="updatePageSize"
        />
      </label>

      <span class="page-indicator">
        {{ t("pagination.pageOf", { page: safePage, total: totalPages }) }}
      </span>

      <BaseButton
        icon-only
        :aria-label="t('pagination.previous')"
        :title="t('pagination.previous')"
        :disabled="loading || !canGoPrevious"
        @click="emit('update:page', safePage - 1)"
      >
        <template #icon>
          <ChevronLeft />
        </template>
        ‹
      </BaseButton>
      <BaseButton
        icon-only
        :aria-label="t('pagination.next')"
        :title="t('pagination.next')"
        :disabled="loading || !canGoNext"
        @click="emit('update:page', safePage + 1)"
      >
        <template #icon>
          <ChevronRight />
        </template>
        ›
      </BaseButton>
    </div>
  </nav>
</template>

<style scoped>
.pagination {
  min-height: 58px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 14px;
  border-top: 1px solid var(--border);
  background: linear-gradient(180deg, var(--surface), var(--surface-low));
}

.pagination-summary {
  display: flex;
  align-items: baseline;
  gap: 5px;
  color: var(--text-sub);
  font-size: 12px;
}

.pagination-summary strong {
  color: var(--text);
  font-size: 13px;
}

.pagination-actions,
.page-size {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-size,
.page-indicator {
  color: var(--text-sub);
  font-size: 12px;
  font-weight: 600;
}

.page-size :deep(.custom-select) {
  width: 74px;
}

.page-size :deep(.select-trigger) {
  background: var(--surface);
}

.pagination-actions :deep(.base-button) {
  border-radius: var(--control-radius);
  background: var(--surface);
}

.pagination-actions :deep(.base-button:hover:not(:disabled)) {
  border-color: rgba(31, 122, 77, 0.4);
  background: var(--green-soft);
  color: var(--green);
}

@media (max-width: 640px) {
  .pagination {
    align-items: flex-start;
    flex-direction: column;
  }

  .pagination-actions {
    width: 100%;
    flex-wrap: wrap;
  }

  .page-indicator {
    margin-right: auto;
  }
}
</style>
