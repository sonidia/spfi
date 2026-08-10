<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";

const orderStore = useOrderStore();
const { storeId, token, isReady } = useActiveShopAuth();
const { t } = useLocalization();
const isCreateOpen = ref(false);
const totalPages = computed(() =>
  Math.max(1, Math.ceil(orderStore.orders.length / orderStore.pageSize)),
);
const paginatedOrders = computed(() => {
  const page = Math.min(orderStore.currentPage, totalPages.value);
  const start = (page - 1) * orderStore.pageSize;
  return orderStore.orders.slice(start, start + orderStore.pageSize);
});

watch(totalPages, (pageCount) => {
  if (orderStore.currentPage > pageCount) {
    orderStore.setPage(pageCount);
  }
});

async function refreshCount() {
  if (!isReady.value) return;
  await orderStore.fetchCount(storeId.value, token.value, { status: "any" });
}

onMounted(refreshCount);
watch(storeId, refreshCount);
</script>

<template>
  <div class="orders-tab">
    <div class="orders-toolbar">
      <div>
        <strong>{{ orderStore.orderCount || orderStore.orders.length }}</strong>
        <span>{{ t("order.totalOrders") }}</span>
      </div>
      <button type="button" @click="isCreateOpen = true">
        <IconsAdd aria-hidden="true" />
        {{ t("order.createOrder") }}
      </button>
    </div>

    <div
      v-if="orderStore.isLoading && !orderStore.orders.length"
      class="empty"
      role="status"
    >
      {{ t("order.loadingOrders") }}
    </div>
    <div v-else-if="orderStore.error" class="empty error-state" role="alert">
      {{ orderStore.error }}
    </div>
    <template v-else>
      <p
        v-if="orderStore.orderCount > orderStore.orders.length"
        class="orders-limit-note"
        role="status"
      >
        {{
          t("order.loadedSubset", {
            loaded: orderStore.orders.length,
            total: orderStore.orderCount,
          })
        }}
      </p>
      <OrderOrdersTable
        v-if="orderStore.orders.length"
        :orders="paginatedOrders"
        tracking-actions
      />
      <PaginationControls
        v-if="orderStore.orders.length"
        :page="orderStore.currentPage"
        :page-size="orderStore.pageSize"
        :total-items="orderStore.orders.length"
        :item-label="t('order.items')"
        @update:page="orderStore.setPage"
        @update:page-size="orderStore.setPageSize"
      />
      <div v-else class="empty">{{ t("order.empty") }}</div>
    </template>
    <OrderCreateModal
      v-if="isCreateOpen"
      @close="isCreateOpen = false"
      @created="refreshCount"
    />
  </div>
</template>

<style scoped>
.orders-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 52px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.orders-toolbar > div {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.orders-toolbar strong {
  color: var(--text);
  font-size: 15px;
}

.orders-toolbar span {
  color: var(--text-sub);
  font-size: 12px;
}

.orders-toolbar button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 0 12px;
  border: 0;
  border-radius: 6px;
  background: var(--green);
  color: white;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.orders-limit-note {
  margin: 0;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--amber-soft);
  color: var(--text-sub);
  font-size: 12px;
}

.error-state {
  color: var(--red);
}
</style>
