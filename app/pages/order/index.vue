<template>
  <NuxtLayout name="shop">
    <template #title>
      <span class="page-title">Orders</span>
    </template>

    <div class="page" id="app">
      <!-- Loading state -->
      <div v-if="orderStore.isLoading" id="loading">Loading order...</div>
      <div v-else-if="orderStore.error" id="loading" style="color: red">
        {{ orderStore.error }}
      </div>

      <!-- ════════════════════════════════════════ SCREEN: LIST -->
      <div v-else>
        <div class="page-meta">
          {{ orders.length }} order{{ orders.length !== 1 ? "s" : "" }}
        </div>
        <div class="left-col">
          <NuxtLink
            v-for="(order, index) in orders"
            :key="order.id || index"
            class="card order-card"
            style="
              cursor: pointer;
              text-decoration: none;
              color: inherit;
              display: block;
            "
            :to="`/order/${order.id}`"
          >
            <div
              class="card-header"
              style="justify-content: flex-start; gap: 8px"
            >
              <span class="card-title">{{
                nilVal(order.name, "#" + order.order_number)
              }}</span>
              <template v-for="badge in getOrderBadges(order)" :key="badge.cls">
                <span class="badge" :class="badge.cls">{{ badge.label }}</span>
              </template>
            </div>
            <div class="sidebar-body">
              <div class="sidebar-value">
                {{ fmtDateTime(order.created_at) || "—" }}
              </div>
              <div class="sidebar-value" style="font-weight: 500">
                {{
                  fmtMoney(
                    nilVal(
                      order.total_price,
                      nilVal(order.current_total_price, "0.00"),
                    ),
                    nilVal(order.currency, "CAD"),
                  )
                }}
              </div>
            </div>
          </NuxtLink>
        </div>
      </div>
    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useOrderStore } from "~/stores/order";
import { fmtDateTime, fmtMoney, getOrderBadges, nilVal } from "~~/utils/order";

definePageMeta({ layout: false });

// ── Store ──────────────────────────────────────────────────────────────────
const orderStore = useOrderStore();

const orders = computed(() => orderStore.orders);

// ── Data loading ──────────────────────────────────────────────────────────────
onMounted(() => {
  // If we already have data, just clear any leftover error
  if (orderStore.orders.length) {
    orderStore.error = null;
  }
});
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}
.page-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text);
}
.page-meta {
  font-size: 13px;
  color: var(--text-sub);
  margin-bottom: 20px;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}
.badge::before {
  content: "•";
  font-size: 16px;
  line-height: 1;
}
.badge-paid {
  background: var(--badge-paid);
  color: var(--badge-paid-text);
}
.badge-fulfilled {
  background: var(--badge-fulfilled);
  color: var(--badge-fulfilled-text);
}
.badge-archived {
  background: var(--badge-archived);
  color: var(--badge-archived-text);
}
.badge-cancelled {
  background: var(--badge-cancelled);
  color: var(--badge-cancelled-text);
}
.badge-pending {
  background: var(--badge-pending);
  color: var(--badge-pending-text);
}
.badge-partial {
  background: #fff3cd;
  color: #856404;
}
.badge-unfulfilled {
  background: #f1f2f4;
  color: #6d7175;
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
}
.left-col .card + .card {
  margin-top: 16px;
}

.card-header {
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border-bottom: 1px solid var(--border);
}
.card-title {
  font-weight: 600;
  font-size: 14px;
}

.sidebar-body {
  padding: 14px 16px;
}
.sidebar-value {
  font-size: 13px;
  color: var(--text);
  line-height: 1.6;
}

#loading {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-sub);
  font-size: 15px;
}

.order-card:hover {
  background: #f8f9fa;
}
</style>
