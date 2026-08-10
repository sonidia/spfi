<script setup lang="ts">
import { computed, watch } from "vue";
import { useOrderStore } from "~/stores/order";

definePageMeta({ layout: false });

const orderStore = useOrderStore();
const { t } = useLocalization();
const orders = computed(() => orderStore.orders);
const totalPages = computed(() =>
  Math.max(1, Math.ceil(orders.value.length / orderStore.pageSize)),
);
const paginatedOrders = computed(() => {
  const page = Math.min(orderStore.currentPage, totalPages.value);
  const start = (page - 1) * orderStore.pageSize;
  return orders.value.slice(start, start + orderStore.pageSize);
});

watch(totalPages, (pageCount) => {
  if (orderStore.currentPage > pageCount) {
    orderStore.setPage(pageCount);
  }
});
</script>

<template>
  <NuxtLayout name="shop">
    <template #title>
      <span class="page-title">{{ t("order.title") }}</span>
    </template>

    <div id="app" class="page">
      <div v-if="orderStore.isLoading" id="loading" role="status">
        {{ t("order.loadingOrders") }}
      </div>
      <div v-else-if="orderStore.error" id="loading" class="error-state" role="alert">
        {{ orderStore.error }}
      </div>
      <div v-else>
        <div class="page-meta">
          {{ t("order.loadedCount", { count: orders.length }) }}
        </div>
        <div v-if="orders.length" class="card table-card">
          <OrderOrdersTable :orders="paginatedOrders" />
          <PaginationControls
            :page="orderStore.currentPage"
            :page-size="orderStore.pageSize"
            :total-items="orders.length"
            :item-label="t('order.items')"
            @update:page="orderStore.setPage"
            @update:page-size="orderStore.setPageSize"
          />
        </div>
        <div v-else class="empty">{{ t("order.empty") }}</div>
      </div>
    </div>
  </NuxtLayout>
</template>

<style scoped>
.page-title {
  color: var(--text);
  font-size: 1.2rem;
  font-weight: 600;
}

.page-meta {
  margin-bottom: 20px;
  color: var(--text-sub);
  font-size: 13px;
}

.card {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow);
}

.table-card {
  overflow: visible;
}

#loading,
.empty {
  padding: 60px 20px;
  color: var(--text-sub);
  text-align: center;
  font-size: 15px;
}

.error-state {
  color: var(--red);
}
</style>
