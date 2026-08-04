<script setup lang="ts">
import type { StoreTab } from "~~/types/store";

defineProps<{
  activeTab: StoreTab;
  transactionsCount: number;
  payoutsCount: number;
  ordersCount: number;
  productsCount: number;
  customersCount: number;
  activeLabel: string;
}>();

const emit = defineEmits<{
  select: [tab: StoreTab];
}>();

function selectTab(tab: StoreTab) {
  emit("select", tab);
}
</script>

<template>
  <div
    class="table-header store-tabs"
    role="tablist"
    aria-label="Store data views"
  >
    <button
      class="tab-btn"
      :class="{ active: activeTab === 'transactions' }"
      type="button"
      role="tab"
      :aria-selected="activeTab === 'transactions'"
      @click="selectTab('transactions')"
    >
      <IconsDate />
      Transactions
      <span class="tab-count">{{ transactionsCount }}</span>
    </button>
    <button
      class="tab-btn"
      :class="{ active: activeTab === 'payouts' }"
      type="button"
      role="tab"
      :aria-selected="activeTab === 'payouts'"
      @click="selectTab('payouts')"
    >
      <IconsRefresh />
      Payouts
      <span class="tab-count">{{ payoutsCount }}</span>
    </button>
    <button
      class="tab-btn"
      :class="{ active: activeTab === 'orders' }"
      type="button"
      role="tab"
      :aria-selected="activeTab === 'orders'"
      @click="selectTab('orders')"
    >
      <IconsCopy />
      Orders
      <span class="tab-count">{{ ordersCount }}</span>
    </button>
    <button
      class="tab-btn"
      :class="{ active: activeTab === 'products' }"
      type="button"
      role="tab"
      :aria-selected="activeTab === 'products'"
      @click="selectTab('products')"
    >
      <IconsBulking />
      Products
      <span class="tab-count">{{ productsCount }}</span>
    </button>
    <button
      class="tab-btn"
      :class="{ active: activeTab === 'customers' }"
      type="button"
      role="tab"
      :aria-selected="activeTab === 'customers'"
      @click="selectTab('customers')"
    >
      <IconsUsers />
      Customers
      <span class="tab-count">{{ customersCount }}</span>
    </button>
    <button
      class="tab-btn"
      :class="{ active: activeTab === 'profile' }"
      type="button"
      role="tab"
      :aria-selected="activeTab === 'profile'"
      @click="selectTab('profile')"
    >
      <IconsUser />
      Profile
    </button>
    <!-- <span class="active-view-label">{{ activeLabel }}</span> -->
  </div>
</template>

<style scoped>
.table-header {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: linear-gradient(180deg, var(--surface), var(--surface-low));
}

.store-tabs {
  width: 100%;
  padding: 0;
  border-bottom: 0;
  background: transparent;
}

.tab-btn {
  min-height: 34px;
  padding: 0 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font);
  transition:
    background 0.16s ease,
    box-shadow 0.16s ease,
    color 0.16s ease,
    transform 0.16s ease;
  line-height: 1.4;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.tab-btn svg {
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
}

.tab-btn.active {
  background: var(--green-soft);
  color: var(--green);
  box-shadow: inset 0 0 0 1px rgba(31, 122, 77, 0.16);
}

.tab-btn:hover:not(.active) {
  background: var(--surface-soft);
  color: var(--green);
  box-shadow: inset 0 0 0 1px rgba(31, 122, 77, 0.14);
  transform: translateY(-1px);
}

.tab-btn:focus-visible {
  outline: 2px solid rgba(31, 122, 77, 0.45);
  outline-offset: 2px;
}

.tab-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  padding: 1px 6px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
  border-radius: 999px;
  background: var(--surface-soft);
  color: var(--text-secondary);
}

.tab-btn.active .tab-count {
  background: rgba(255, 255, 255, 0.82);
  color: var(--green);
}

.active-view-label {
  margin-left: auto;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
}

@media (max-width: 600px) {
  .active-view-label {
    width: 100%;
    margin-left: 0;
  }
}

@media (max-width: 420px) {
  .table-header {
    align-items: stretch;
  }

  .tab-btn {
    justify-content: space-between;
    width: calc(50% - 3px);
  }
}
</style>
