<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useOrderStore } from "~/stores/order";

definePageMeta({ layout: false });

const orderStore = useOrderStore();
const { storeId, token } = useActiveShopAuth();
const { t } = useLocalization();
const orders = computed(() => orderStore.orders);
const selectedOrderIds = ref<string[]>([]);

watch(storeId, () => {
  selectedOrderIds.value = [];
});

function changePage(page: number) {
  selectedOrderIds.value = [];
  return orderStore.fetchPage(storeId.value, token.value, page);
}

function changePageSize(pageSize: number) {
  selectedOrderIds.value = [];
  return orderStore.changePageSize(storeId.value, token.value, pageSize);
}
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
          <span>{{ t("order.loadedCount", { count: orders.length }) }}</span>
          <CsvExportButton resource="orders" />
        </div>
        <div v-if="orders.length" class="card table-card">
          <OrderBulkActions
            :orders="orders"
            :selected-order-ids="selectedOrderIds"
            @update:selected-order-ids="selectedOrderIds = $event"
          />
          <OrderOrdersTable
            :orders="orders"
            selectable
            :selected-order-ids="selectedOrderIds"
            @update:selected-order-ids="selectedOrderIds = $event"
          />
          <PaginationControls
            :page="orderStore.currentPage"
            :page-size="orderStore.pageSize"
            :total-items="orderStore.orderCount || orders.length"
            :has-next-page="orderStore.pageInfo.hasNextPage"
            :has-previous-page="orderStore.pageInfo.hasPreviousPage"
            :loading="orderStore.isLoading"
            :item-label="t('order.items')"
            @update:page="changePage"
            @update:page-size="changePageSize"
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
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
