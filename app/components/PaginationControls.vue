<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    page: number;
    pageSize: number;
    totalItems: number;
    pageSizeOptions?: number[];
    itemLabel?: string;
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

function updatePageSize(event: Event) {
  emit("update:pageSize", Number((event.target as HTMLSelectElement).value));
}
</script>

<template>
  <nav class="pagination" aria-label="Pagination">
    <div class="pagination-summary" aria-live="polite">
      <strong>{{ firstItem }}–{{ lastItem }}</strong>
      <span>of {{ totalItems }} {{ itemLabel }}</span>
    </div>

    <div class="pagination-actions">
      <label class="page-size">
        <span>Rows</span>
        <select :value="pageSize" @change="updatePageSize">
          <option v-for="option in pageSizeOptions" :key="option" :value="option">
            {{ option }}
          </option>
        </select>
      </label>

      <span class="page-indicator">
        Page {{ safePage }} of {{ totalPages }}
      </span>

      <button
        type="button"
        aria-label="Previous page"
        :disabled="safePage <= 1"
        @click="emit('update:page', safePage - 1)"
      >
        ‹
      </button>
      <button
        type="button"
        aria-label="Next page"
        :disabled="safePage >= totalPages"
        @click="emit('update:page', safePage + 1)"
      >
        ›
      </button>
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

.page-size select {
  height: 34px;
  padding: 0 28px 0 9px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  cursor: pointer;
}

.pagination-actions button {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  transition: border-color 0.16s, background 0.16s, color 0.16s;
}

.pagination-actions button:hover:not(:disabled) {
  border-color: rgba(31, 122, 77, 0.4);
  background: var(--green-soft);
  color: var(--green);
}

.pagination-actions button:disabled {
  opacity: 0.38;
  cursor: not-allowed;
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
