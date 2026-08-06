<template>
  <NuxtLayout name="shop">
    <template #shop-bar-left>
      <StoreViewTabs
        :active-tab="activeTab"
        :active-label="activeTabLabel"
        @select="setActiveTab"
      />
    </template>

    <section class="page">
      <ShopEmptyState
        v-if="!formStore.storeId"
        :title="paymentEmptyState.title"
        :description="paymentEmptyState.description"
      >
        <template #icon>
          <IconsHero v-if="paymentEmptyState.kind === 'no-stores'" />
          <IconsCheck v-else />
        </template>
        <template #actions>
          <NuxtLink
            v-if="paymentEmptyState.kind === 'no-stores'"
            to="/manager"
            class="shop-empty-action primary"
          >
            <IconsAdd />
            Add store
          </NuxtLink>
          <span v-else class="shop-empty-hint">
            Pick a store from the left sidebar.
          </span>
        </template>
      </ShopEmptyState>

      <!-- LOADING STATE -->
      <ShopEmptyState
        v-else-if="isPaymentTab && paymentStore.isLoading && !hasPaymentData"
        title="Loading payment data"
        description="Fetching transactions, payouts, and store finance details."
        loading
      >
        <template #icon>
          <IconsSync />
        </template>
      </ShopEmptyState>

      <!-- EMPTY / NOT FETCHED -->
      <ShopEmptyState
        v-else-if="
          isPaymentTab &&
          !paymentStore.isLoading &&
          !hasPaymentData &&
          !paymentStore.error
        "
        :title="paymentEmptyState.title"
        :description="paymentEmptyState.description"
      >
        <template #icon>
          <IconsHero v-if="paymentEmptyState.kind === 'no-stores'" />
          <IconsCheck v-else-if="paymentEmptyState.kind === 'no-selection'" />
          <IconsDate v-else />
        </template>
        <template #actions>
          <NuxtLink
            v-if="paymentEmptyState.kind === 'no-stores'"
            to="/manager"
            class="shop-empty-action primary"
          >
            <IconsAdd />
            Add store
          </NuxtLink>
          <button
            v-else-if="formStore.storeId"
            class="shop-empty-action primary"
            type="button"
            @click="refreshCurrentStore"
          >
            <IconsRefresh />
            Refresh payment
          </button>
          <span v-else class="shop-empty-hint">
            Pick a store from the left sidebar.
          </span>
        </template>
      </ShopEmptyState>

      <!-- CONTENT -->
      <div v-else class="screen">
        <div
          v-if="isPaymentTab && paymentStore.error"
          class="payment-alert"
          role="alert"
        >
          {{ paymentStore.error }}
        </div>


        <div v-if="showsStoreSummary" class="card data-card">
          <PaymentPayoutsTab v-if="activeTab === 'payouts'" />

          <PaymentTransactionsTab v-else-if="activeTab === 'transactions'" />

          <PaymentOrdersTab v-else-if="activeTab === 'orders'" />

          <PaymentProductsTab v-else-if="activeTab === 'products'" />
        </div>

        <StoreCustomersTab v-else-if="activeTab === 'customers'" />

        <StoreProfileTab v-else-if="activeTab === 'profile'" />
      </div>
    </section>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { computed, onActivated, onDeactivated, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useCredentialVaultStore } from "~/stores/credentialVault";
import { useCustomerStore } from "~/stores/customers";
import { useFormStore } from "~/stores/form";
import { useOrderStore } from "~/stores/order";
import { usePaymentStore } from "~/stores/payment";
import { useProductStore } from "~/stores/product";
import { useShopProfileStore } from "~/stores/shopProfile";
import { isStoreTab, type StoreTab } from "~~/types/store";

definePageMeta({ layout: false });

const formStore = useFormStore();
const credentialVault = useCredentialVaultStore();
const customerStore = useCustomerStore();
const paymentStore = usePaymentStore();
const orderStore = useOrderStore();
const productStore = useProductStore();
const profileStore = useShopProfileStore();
const router = useRouter();
const route = useRoute();

const activeTab = ref<StoreTab>(
  isStoreTab(route.query.tab) ? route.query.tab : "profile",
);
const isPageActive = ref(true);

function setActiveTab(tab: StoreTab) {
  activeTab.value = tab;
  const cookieShop = useLocalStorage("active_store_id", "").state.value;
  router.replace({
    path: "/store",
    query: {
      ...route.query,
      shop: route.query.shop || cookieShop || undefined,
      tab: tab === "transactions" ? undefined : tab,
    },
  });
}

async function refreshCurrentStore() {
  if (!formStore.storeId) {
    return;
  }

  const token = resolveToken(formStore.storeId);

  if (token) {
    await paymentStore.fetchAll(formStore.storeId, token, true);
  }
}

function loadProfileTabData(storeId: string, token: string) {
  if (!profileStore.hasFetchedProfile || profileStore.error) {
    profileStore.fetchProfile(storeId, token);
  }
  if (!paymentStore.hasFetchedAll || paymentStore.error) {
    paymentStore.fetchAll(storeId, token);
  } else if (
    !paymentStore.hasFetchedBalanceTransactions ||
    paymentStore.error
  ) {
    paymentStore.fetchBalanceTransactions(storeId, token);
  }
  if (!orderStore.hasFetchedAll || orderStore.error) {
    orderStore.fetchAll(storeId, token);
  }
}

const currentBalance = computed(() => {
  const b = paymentStore.balance;
  if (!b) return null;
  if (Array.isArray(b)) return b[0] ?? null;
  return b;
});

const transactionsCount = computed(
  () => paymentStore.balanceTransactions.length,
);
const payoutsCount = computed(() => paymentStore.payouts.length);
const ordersCount = computed(() => orderStore.orders.length);
const productsCount = computed(() => productStore.products.length);
const customersCount = computed(() => customerStore.customers.length);
const isPaymentTab = computed(() =>
  ["transactions", "payouts"].includes(activeTab.value),
);
const showsStoreSummary = computed(() =>
  ["transactions", "payouts", "orders", "products"].includes(activeTab.value),
);
const hasPaymentData = computed(
  () =>
    Boolean(currentBalance.value) ||
    transactionsCount.value > 0 ||
    payoutsCount.value > 0 ||
    ordersCount.value > 0 ||
    productsCount.value > 0,
);

const activeTabLabel = computed(
  () =>
    ({
      transactions: "Money movement and fees",
      payouts: "Settlement schedule",
      orders: "Sales connected to payments",
      products: "Store catalog",
      customers: "Customer directory",
      profile: "Shop details and credentials",
    })[activeTab.value],
);
const paymentEmptyState = computed(() => {
  if (!formStore.knownStores.length) {
    return {
      kind: "no-stores",
      title: "No stores connected yet",
      description:
        "Connect a Shopify store first, then payment activity will appear here automatically.",
    };
  }

  if (!formStore.storeId) {
    return {
      kind: "no-selection",
      title: "Choose a store to view payments",
      description:
        "Select a store from the sidebar to load balance transactions, payouts, orders, and products.",
    };
  }

  return {
    kind: "empty-data",
    title: "No payment activity found",
    description:
      "This store has no fetched payment rows yet. Refresh to pull the latest Shopify data.",
  };
});

onActivated(() => {
  isPageActive.value = true;
});

onDeactivated(() => {
  isPageActive.value = false;
});

watch(
  () => formStore.storeId,
  () => {
    if (!isPageActive.value) return;

    if (formStore.storeId) {
      const token = resolveToken(formStore.storeId);
      if (token && activeTab.value === "products") {
        productStore.fetchAll(formStore.storeId, token);
      }
      if (token && activeTab.value === "customers") {
        customerStore.fetchAll(
          formStore.storeId,
          token,
          customerStore.activeQuery,
        );
      }
      if (token && activeTab.value === "profile") {
        loadProfileTabData(formStore.storeId, token);
      }
    }
  },
);

watch(
  activeTab,
  (newTab) => {
    if (!isPageActive.value) return;

    if (isPaymentTab.value && formStore.storeId) {
      const token = resolveToken(formStore.storeId);
      if (token && (!paymentStore.hasFetchedAll || paymentStore.error)) {
        paymentStore.fetchAll(formStore.storeId, token);
      } else if (
        token &&
        (!paymentStore.hasFetchedBalanceTransactions || paymentStore.error)
      ) {
        paymentStore.fetchBalanceTransactions(formStore.storeId, token);
      }
    }
    if (newTab === "orders" && formStore.storeId) {
      const token = resolveToken(formStore.storeId);
      if (token && (!orderStore.orders.length || orderStore.error)) {
        orderStore.fetchAll(formStore.storeId, token);
      }
    }
    if (newTab === "products" && formStore.storeId) {
      const token = resolveToken(formStore.storeId);
      if (token && (!productStore.products.length || productStore.error)) {
        productStore.fetchAll(formStore.storeId, token);
      }
    }
    if (newTab === "customers" && formStore.storeId) {
      const token = resolveToken(formStore.storeId);
      if (token && (!customerStore.hasFetchedAll || customerStore.error)) {
        customerStore.fetchAll(
          formStore.storeId,
          token,
          customerStore.activeQuery,
        );
      }
    }
    if (newTab === "profile" && formStore.storeId) {
      const token = resolveToken(formStore.storeId);
      if (token) {
        loadProfileTabData(formStore.storeId, token);
      }
    }
  },
  { immediate: true },
);

watch(
  () => route.query.tab,
  (tab) => {
    const nextTab = isStoreTab(tab) ? tab : "transactions";
    if (nextTab !== activeTab.value) activeTab.value = nextTab;
  },
);

function resolveToken(sid: string): string | null {
  const data = credentialVault.getStoreData(sid);
  const now = Date.now();
  if (data?.accessToken && data?.expiresTime && now < data.expiresTime) {
    return data.accessToken;
  }
  return null;
}
</script>

<style scoped>
.screen {
  display: block;
  animation: fadeIn 0.18s ease;
}

.payment-alert {
  margin-bottom: 14px;
  padding: 10px 12px;
  border: 1px solid rgba(180, 49, 43, 0.18);
  border-radius: 10px;
  background: var(--red-soft);
  color: var(--red);
  font-size: 12px;
  font-weight: 700;
}


@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.card {
  background: var(--surface);
  border-radius: 14px;
  box-shadow: var(--shadow);
  overflow: hidden;
  margin-bottom: 16px;
}

.data-card {
  border: 1px solid var(--border);
  box-shadow: 0 16px 44px rgba(20, 34, 27, 0.075);
}

:deep(.badge) {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.6;
}
:deep(.badge-deposited),
:deep(.badge-paid) {
  background: var(--green-bg);
  color: var(--green);
}
:deep(.badge-pending) {
  background: var(--surface-soft);
  color: var(--text-sub);
}
:deep(.badge-in-transit) {
  background: var(--amber-soft);
  color: var(--amber);
}
:deep(.badge-fulfilled) {
  background: var(--badge-fulfilled);
  color: var(--badge-fulfilled-text);
}
:deep(.badge-archived) {
  background: var(--badge-archived);
  color: var(--badge-archived-text);
}
:deep(.badge-cancelled) {
  background: var(--badge-cancelled);
  color: var(--badge-cancelled-text);
}
:deep(.badge-partial) {
  background: var(--amber-soft);
  color: var(--amber);
}
:deep(.badge-unfulfilled) {
  background: var(--surface-soft);
  color: var(--text-sub);
}

:deep(table) {
  width: 100%;
  border-collapse: collapse;
}
:deep(thead th) {
  padding: 10px 16px;
  text-align: left;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}
:deep(thead th.right) {
  text-align: right;
}
:deep(tbody tr) {
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: background 0.12s;
}
:deep(tbody tr:last-child) {
  border-bottom: none;
}
:deep(tbody tr:hover) {
  background: var(--surface-soft);
}
:deep(td) {
  padding: 12px 16px;
  font-size: 13px;
  vertical-align: middle;
  color: var(--text-primary);
}
:deep(td.right) {
  text-align: right;
}
:deep(.td-date) {
  color: var(--text-secondary);
  white-space: nowrap;
}
:deep(.td-order a),
:deep(.link) {
  color: var(--blue);
  font-weight: 500;
  text-decoration: none;
}
:deep(.td-order a:hover),
:deep(.link:hover) {
  text-decoration: underline;
}
:deep(.td-type) {
  color: var(--text-primary);
}
:deep(.payment-method) {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
:deep(.card-brand) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--blue);
  color: var(--bg) !important;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: -0.3px;
  padding: 2px 5px;
  border-radius: 3px;
  text-transform: uppercase;
}
:deep(.td-amount) {
  color: var(--text-primary);
  font-weight: 500;
}
:deep(.td-fee) {
  color: var(--red);
  font-weight: 500;
}
:deep(.td-net) {
  color: var(--text-primary);
  font-weight: 600;
}
:deep(.chevron-sm) {
  color: var(--text-muted);
  font-weight: 400;
  font-size: 12px;
  margin-left: 2px;
}

:deep(.orders-table) {
  width: 100%;
  border-collapse: collapse;
}
:deep(.orders-table th) {
  padding: 10px 16px;
  text-align: left;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
  background: var(--surface-soft);
}
:deep(.orders-table td) {
  padding: 12px 16px;
  font-size: 13px;
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
}
:deep(.order-row) {
  cursor: pointer;
  transition: background 0.12s;
}
:deep(.order-row:hover) {
  background: var(--surface-soft);
}
:deep(.order-link) {
  color: var(--blue);
  font-weight: 600;
  text-decoration: none;
}
:deep(.order-link:hover) {
  text-decoration: underline;
}
:deep(.delivery-cell) {
  display: flex;
  align-items: center;
}
:deep(.delivery-status-trigger) {
  display: flex;
  align-items: center;
  gap: 4px;
}
:deep(.hover-arrow) {
  display: inline-flex;
  align-items: center;
  color: var(--text-muted);
  rotate: 90deg;
}
:deep(.fulfillment-popover) {
  padding: 12px;
  min-width: 220px;
}
:deep(.popover-line) {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  font-size: 12px;
  padding: 4px 0;
}
:deep(.popover-line.border-top) {
  border-top: 1px solid var(--border);
  margin-top: 6px;
  padding-top: 8px;
}
:deep(.popover-lbl) {
  color: var(--text-secondary);
  font-weight: 500;
}
:deep(.popover-val) {
  color: var(--text-primary);
  font-weight: 600;
  text-align: right;
}
:deep(.btn-add-track) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--green);
  border: none;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--bg);
  cursor: pointer;
  transition: all 0.2s;
}
:deep(.btn-add-track:hover) {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--green) 30%, transparent);
}
:deep(.btn-add-track:disabled) {
  background: var(--surface-soft);
  color: var(--text-muted);
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}
:deep(.btn-add-track.is-loading) {
  opacity: 0.7;
  cursor: wait;
}

:deep(.empty) {
  text-align: center;
  padding: 32px;
  color: var(--text-muted);
  font-size: 13px;
}


</style>
