<script setup lang="ts">
import {
  CircleDollarSign,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Store,
} from "@lucide/vue";

const props = defineProps<{
  stores: Array<{ id: string; label: string }>;
  currencies: string[];
  search: string;
  storeId: string;
  currency: string;
  storeSort: string;
  isFiltered: boolean;
  isLoading: boolean;
  progress: number;
}>();

const storeOptions = computed(() => [
  { label: "All stores", value: "all" },
  ...props.stores.map((store) => ({ label: store.label, value: store.id })),
]);
const currencyOptions = computed(() => [
  { label: "All currencies", value: "all" },
  ...props.currencies.map((currency) => ({ label: currency, value: currency })),
]);
const sortOptions = [
  { label: "Revenue: high first", value: "revenue-desc" },
  { label: "Orders: high first", value: "orders-desc" },
  { label: "Pending: high first", value: "pending-desc" },
  { label: "Customers: high first", value: "customers-desc" },
  { label: "Store name: A–Z", value: "name-asc" },
];

const emit = defineEmits<{
  "update:search": [value: string];
  "update:storeId": [value: string];
  "update:currency": [value: string];
  "update:storeSort": [value: string];
  reset: [];
}>();

function inputValue(event: Event) {
  return (event.target as HTMLInputElement).value;
}

function selectValue(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}
</script>

<template>
  <section class="dashboard-toolbar" aria-label="Dashboard filters">
    <div class="dashboard-toolbar-filters">
      <label class="dashboard-search-control">
        <Search aria-hidden="true" />
        <span class="sr-only">Search dashboard</span>
        <input
          :value="search"
          type="search"
          placeholder="Search stores, products, orders, users…"
          @input="emit('update:search', inputValue($event))"
        />
      </label>

      <div class="dashboard_filter_sort">
        <BaseSelect
          class-name="dashboard-toolbar-select"
          :model-value="storeId"
          :options="storeOptions"
          aria-label="Filter by store"
          @change="emit('update:storeId', selectValue($event, 'all'))"
        >
          <template #icon><Store /></template>
        </BaseSelect>

        <BaseSelect
          class-name="dashboard-toolbar-select"
          :model-value="currency"
          :options="currencyOptions"
          aria-label="Filter by currency"
          @change="emit('update:currency', selectValue($event, 'all'))"
        >
          <template #icon><CircleDollarSign /></template>
        </BaseSelect>

        <BaseSelect
          class-name="dashboard-toolbar-select"
          :model-value="storeSort"
          :options="sortOptions"
          aria-label="Sort stores"
          @change="emit('update:storeSort', selectValue($event, 'revenue-desc'))"
        >
          <template #icon><SlidersHorizontal /></template>
        </BaseSelect>

        <button
          class="dashboard-reset-filters"
          type="button"
          :disabled="!isFiltered"
          @click="emit('reset')"
        >
          <RotateCcw /> Reset
        </button>
      </div>
    </div>

    <slot name="actions" />

    <div v-if="isLoading" class="dashboard-toolbar-progress" aria-live="polite">
      <i :style="{ width: `${progress}%` }" />
    </div>
  </section>
</template>

<style scoped>
.dashboard-toolbar {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 9px;
  overflow: visible;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
  box-shadow: var(--shadow-soft);
}

.dashboard-toolbar-filters {
  display: flex;
  min-width: 0;
  flex: 1 1 760px;
  align-items: center;
  gap: 9px;
}

.dashboard_filter_sort {
  display: flex;
  min-width: 0;
  flex: 0 0 auto;
  flex-direction: row;
  align-items: center;
  gap: 9px;
}

.dashboard-search-control {
  display: flex;
  min-width: 220px;
  min-height: 36px;
  max-width: 360px;
  flex: 1 1 250px;
  align-items: center;
  gap: 7px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--surface);
  color: var(--muted);
  transition:
    border-color 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease;
}

.dashboard_filter_sort :deep(.dashboard-toolbar-select:nth-child(2)) {
  min-width: 145px;
}

.dashboard_filter_sort :deep(.dashboard-toolbar-select:nth-child(3)) {
  min-width: 178px;
}

.dashboard-search-control:hover {
  border-color: color-mix(in srgb, var(--green) 40%, var(--border));
  color: var(--green);
}

.dashboard-search-control:focus-within {
  border-color: color-mix(in srgb, var(--green) 50%, var(--border));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--green) 10%, transparent);
}

.dashboard-search-control > svg {
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
}

.dashboard-search-control input {
  width: 100%;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 11px;
}

:deep(.dashboard-toolbar-select .select-trigger) {
  min-height: 36px;
  padding: 0 9px;
  border-radius: 9px;
  background: var(--surface);
  font-size: 11px;
  font-weight: 800;
}

:deep(.dashboard-toolbar-select .select-trigger:hover:not(:disabled)) {
  border-color: color-mix(in srgb, var(--green) 40%, var(--border));
  background: var(--surface);
  color: var(--green);
}

:deep(.dashboard-toolbar-select .selected-label) {
  font-size: 11px;
  font-weight: 800;
}

:deep(.dashboard-toolbar-select .trigger-icon),
:deep(.dashboard-toolbar-select .chevron) {
  color: var(--muted);
}

:deep(.dashboard-toolbar-select .select-dropdown) {
  right: auto;
  width: max(100%, 210px);
  border-radius: 10px;
  box-shadow: var(--shadow);
}

:deep(.dashboard-toolbar-select .select-option) {
  min-height: 34px;
  border-radius: 7px;
}

:deep(.dashboard-toolbar-select .select-option strong) {
  font-size: 11px;
}

.dashboard-reset-filters {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
  font: inherit;
  font-size: 10px;
  font-weight: 800;
}

.dashboard-reset-filters:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--green) 40%, var(--border));
  color: var(--green);
}

.dashboard-reset-filters:disabled {
  cursor: default;
  opacity: 0.45;
}

.dashboard-reset-filters svg {
  width: 12px;
  height: 12px;
}

:slotted(.dashboard-toolbar-actions) {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-end;
  gap: 7px;
  margin-left: auto;
}

.dashboard-toolbar-progress {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 2px;
  overflow: hidden;
  border-radius: 0 0 14px 14px;
  background: color-mix(in srgb, var(--green) 12%, transparent);
}

.dashboard-toolbar-progress i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--green), var(--blue));
  transition: width 0.35s ease;
}

@media (max-width: 980px) {
  .dashboard-toolbar-filters {
    flex-basis: 100%;
  }
}

@media (max-width: 760px) {
  .dashboard-toolbar-filters {
    flex-wrap: wrap;
  }

  .dashboard-search-control {
    width: 100%;
    max-width: none;
    flex-basis: 100%;
  }
}

@media (max-width: 620px) {
  .dashboard_filter_sort {
    width: 100%;
    flex-wrap: wrap;
  }

  .dashboard_filter_sort :deep(.dashboard-toolbar-select:nth-child(1)),
  .dashboard_filter_sort :deep(.dashboard-toolbar-select:nth-child(2)),
  .dashboard_filter_sort :deep(.dashboard-toolbar-select:nth-child(3)) {
    width: auto;
    min-width: 135px;
    flex: 1 1 145px;
  }

  .dashboard-reset-filters {
    flex: 1 1 auto;
  }
}
</style>
