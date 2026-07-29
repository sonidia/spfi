<template>
  <NuxtLayout name="shop">
    <template #title>
      <div class="breadcrumb">
        <span class="page-title">Payment</span>
      </div>
    </template>

    <section class="page">
      <!-- ════════════════ LOADING STATE -->
      <ShopEmptyState
        v-if="paymentStore.isLoading && !hasPaymentData"
        title="Loading payment data"
        description="Fetching transactions, payouts, and store finance details."
        loading
      >
        <template #icon>
          <IconsSync />
        </template>
      </ShopEmptyState>

      <!-- ════════════════ EMPTY / NOT FETCHED -->
      <ShopEmptyState
        v-else-if="
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

      <!-- ════════════════ SCREEN 1: CONTENT -->
      <div v-else class="screen">
        <div class="payment-heading">
          <div>
            <span class="payment-kicker">Financial workspace</span>
            <h1>Payments overview</h1>
            <p>Balance, settlement activity, orders, and products in one view.</p>
          </div>
          <span
            class="sync-status"
            :class="{ 'is-syncing': paymentStore.isLoading }"
          >
            <i />
            {{ paymentStore.isLoading ? "Syncing data" : "Data ready" }}
          </span>
        </div>

        <div v-if="paymentStore.error" class="payment-alert" role="alert">
          {{ paymentStore.error }}
        </div>

        <section class="finance-summary" aria-label="Payment summary">
          <article class="summary-card is-balance">
            <span>Available balance</span>
            <strong>{{ formattedBalance }}</strong>
            <small>{{ currentBalance?.currency || "Store currency" }}</small>
          </article>
          <article class="summary-card">
            <span>Transactions</span>
            <strong>{{ transactionsCount }}</strong>
            <small>Balance activity</small>
          </article>
          <article class="summary-card">
            <span>Payouts</span>
            <strong>{{ payoutsCount }}</strong>
            <small>Settlement records</small>
          </article>
          <article class="summary-card">
            <span>Orders</span>
            <strong>{{ ordersCount }}</strong>
            <small>Connected sales</small>
          </article>
        </section>

        <!-- Main Card -->
        <div class="card data-card">
          <div class="table-header" role="tablist" aria-label="Payment data views">
            <button
              class="tab-btn"
              :class="{ active: activeTab === 'transactions' }"
              type="button"
              role="tab"
              :aria-selected="activeTab === 'transactions'"
              @click="setActiveTab('transactions')"
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
              @click="setActiveTab('payouts')"
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
              @click="setActiveTab('orders')"
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
              @click="setActiveTab('products')"
            >
              <IconsBulking />
              Products
              <span class="tab-count">{{ productsCount }}</span>
            </button>
            <span class="active-view-label">{{ activeTabLabel }}</span>
          </div>

          <!-- PAYOUTS VIEW -->
          <PaymentPayoutsTab
            v-if="activeTab === 'payouts'"
            :filter="payoutsFilter"
          />

          <!-- TRANSACTIONS VIEW -->
          <PaymentTransactionsTab v-else-if="activeTab === 'transactions'" />

          <!-- ORDERS VIEW -->
          <PaymentOrdersTab v-else-if="activeTab === 'orders'" />

          <!-- PRODUCTS VIEW -->
          <PaymentProductsTab v-else-if="activeTab === 'products'" />
        </div>

      </div>
    </section>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { computed, onActivated, onDeactivated, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useCredentialVaultStore } from "~/stores/credentialVault";
import { useFormStore } from "~/stores/form";
import { useOrderStore } from "~/stores/order";
import { usePaymentStore } from "~/stores/payment";
import { useProductStore } from "~/stores/product";

definePageMeta({ layout: false });

const formStore = useFormStore();
const credentialVault = useCredentialVaultStore();
const paymentStore = usePaymentStore();
const orderStore = useOrderStore();
const productStore = useProductStore();
const router = useRouter();
const route = useRoute();

const payoutsFilter = ref<"all" | "paid" | "in_transit">("all");
const activeTab = ref<"payouts" | "transactions" | "orders" | "products">(
  "transactions",
);
const isPageActive = ref(true);

function setActiveTab(tab: "payouts" | "transactions" | "orders" | "products") {
  activeTab.value = tab;
  if (!route.query.shop) {
    const cookieShop = useLocalStorage("active_store_id", "").state.value;
    if (cookieShop) {
      router.replace({ query: { ...route.query, shop: cookieShop } });
    }
  }
}

async function refreshCurrentStore() {
  if (!formStore.storeId) {
    return;
  }

  const token = resolveToken(formStore.storeId);

  if (token) {
    await Promise.all([
      paymentStore.fetchAll(formStore.storeId, token, true),
      paymentStore.fetchBalanceTransactions(formStore.storeId, token, true),
    ]);
  }
}

const currentBalance = computed(() => {
  const b = paymentStore.balance;
  if (!b) return null;
  if (Array.isArray(b)) return b[0] ?? null;
  return b;
});

const transactionsCount = computed(() => paymentStore.balanceTransactions.length);
const payoutsCount = computed(() => paymentStore.payouts.length);
const ordersCount = computed(() => orderStore.orders.length);
const productsCount = computed(() => productStore.products.length);
const hasPaymentData = computed(
  () =>
    Boolean(currentBalance.value) ||
    transactionsCount.value > 0 ||
    payoutsCount.value > 0 ||
    ordersCount.value > 0 ||
    productsCount.value > 0,
);
const formattedBalance = computed(() => {
  const amount = Number(currentBalance.value?.amount || 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currentBalance.value?.currency || "USD",
  }).format(amount);
});
const activeTabLabel = computed(
  () =>
    ({
      transactions: "Money movement and fees",
      payouts: "Settlement schedule",
      orders: "Sales connected to payments",
      products: "Store catalog",
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
      if (token) {
        if (activeTab.value === "products") {
          productStore.fetchAll(formStore.storeId, token);
        }
      }
    }
  },
);

watch(activeTab, (newTab) => {
  if (!isPageActive.value) return;

  if (newTab === "orders" && formStore.storeId) {
    const token = resolveToken(formStore.storeId);
    if (token) {
      if (!orderStore.orders.length || orderStore.error) {
        orderStore.fetchAll(formStore.storeId, token);
      }
    }
  }
  if (newTab === "products" && formStore.storeId) {
    const token = resolveToken(formStore.storeId);
    if (token) {
      if (!productStore.products.length || productStore.error) {
        productStore.fetchAll(formStore.storeId, token);
      }
    }
  }
});

function resolveToken(sid: string): string | null {
  // Use raw document.cookie fallback if outside Nuxt context, but we are client side anyway
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

.payment-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 18px;
}

.payment-kicker {
  color: var(--green);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.payment-heading h1 {
  margin: 4px 0 3px;
  color: var(--text);
  font-size: clamp(1.45rem, 3vw, 2rem);
  line-height: 1.1;
  letter-spacing: -0.03em;
}

.payment-heading p {
  color: var(--text-sub);
  font-size: 13px;
}

.sync-status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 10px;
  border: 1px solid rgba(31, 122, 77, 0.18);
  border-radius: 999px;
  background: var(--green-soft);
  color: var(--green);
  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;
}

.sync-status i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}

.sync-status.is-syncing i {
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  50% {
    opacity: 0.3;
    transform: scale(0.75);
  }
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

.finance-summary {
  display: grid;
  grid-template-columns: 1.45fr repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.summary-card {
  min-width: 0;
  display: grid;
  gap: 3px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 10px 30px rgba(20, 34, 27, 0.055);
}

.summary-card.is-balance {
  border-color: rgba(31, 122, 77, 0.2);
  background:
    linear-gradient(135deg, rgba(223, 244, 232, 0.78), rgba(255, 255, 255, 0.94));
}

.summary-card span,
.summary-card small {
  color: var(--text-sub);
  font-size: 11px;
  font-weight: 700;
}

.summary-card strong {
  overflow-wrap: anywhere;
  color: var(--text);
  font-size: clamp(1.25rem, 2.6vw, 1.7rem);
  line-height: 1.2;
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

/* ─── PAGE HEADER ─── */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
}
.breadcrumb-back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.15s;
  color: var(--text-primary);
}
.breadcrumb-back:hover {
  background: #f6f6f6;
}
.page-title {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--text-primary);
}
.page-date {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 2px;
}

/* ─── CARD ─── */
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

/* ─── OVERVIEW ─── */
.overview-card {
  display: grid;
  grid-template-columns: 1fr 1fr;
}
.overview-left {
  padding: 20px 24px;
  border-right: 1px solid var(--border);
}
.overview-right {
  padding: 20px 24px;
}
.overview-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}
.overview-amount {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.5px;
  color: var(--text-primary);
}
.overview-currency {
  font-size: 28px;
  font-weight: 300;
  color: var(--text-secondary);
  margin-left: 4px;
}
.overview-provider {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 6px;
}
.overview-meta {
  display: flex;
  gap: 40px;
  margin-top: 16px;
}
.meta-item label {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: block;
  margin-bottom: 2px;
  font-weight: 400;
}
.meta-item span {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}
.text-muted {
  color: var(--text-muted) !important;
}

/* ─── TABLE HEADER ─── */
.table-header {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: linear-gradient(180deg, #fff, #fbfcfb);
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
  background: #eef0f3;
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

/* ─── BADGE ─── */
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
  background: #e5e7eb;
  color: #374151;
}
:deep(.badge-in-transit) {
  background: #fff3cd;
  color: #856404;
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
  background: #fff3cd;
  color: #856404;
}
:deep(.badge-unfulfilled) {
  background: #f1f2f4;
  color: #6d7175;
}

/* ─── TABLE ─── */
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
  background: #fafafa;
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
  background: #3535ff;
  color: white !important;
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

/* ─── ORDERS TABLE ─── */
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
  background: #f9f9fa;
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
  background: #fafafa;
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
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  border: none;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
}
:deep(.btn-add-track:hover) {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(79, 70, 229, 0.3);
}
:deep(.btn-add-track:disabled) {
  background: #e5e7eb;
  color: #9ca3af;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}
:deep(.btn-add-track.is-loading) {
  filter: blur(1px);
  opacity: 0.7;
}

/* ─── EMPTY ─── */
:deep(.empty) {
  text-align: center;
  padding: 32px;
  color: var(--text-muted);
  font-size: 13px;
}

/* ─── RESPONSIVE ─── */
@media (max-width: 600px) {
  .payment-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .finance-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .active-view-label {
    width: 100%;
    margin-left: 0;
  }

  .overview-card {
    grid-template-columns: 1fr;
  }
  .overview-left {
    border-right: none;
    border-bottom: 1px solid var(--border);
  }
  :deep(.tx-meta-grid) {
    grid-template-columns: 1fr;
  }
  :deep(.tx-meta-col:first-child) {
    border-right: none;
    border-bottom: 1px solid var(--border);
  }
  .overview-meta {
    flex-direction: column;
    gap: 12px;
  }
}

@media (max-width: 420px) {
  .finance-summary {
    grid-template-columns: 1fr;
  }

  .table-header {
    align-items: stretch;
  }

  .tab-btn {
    justify-content: space-between;
    width: calc(50% - 3px);
  }
}
</style>
