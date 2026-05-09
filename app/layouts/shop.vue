<script lang="ts" setup>
import NotFound from "../components/icons/NotFound.vue";
import { useLoading } from "../composables/useLoading";
import { useFormStore } from "../stores/form";
import { useOrderStore } from "../stores/order";
import { usePaymentStore } from "../stores/payment";

const formStore = useFormStore();
const orderStore = useOrderStore();
const paymentStore = usePaymentStore();
const route = useRoute();

const { loading: globalLoading } = useLoading();

onMounted(() => {
  formStore.loadKnownStores();
  // We no longer auto-restore the last selected store to allow a clean initial state
  if (formStore.storeId) {
    fetchCurrent();
  }
});

const isFetching = computed(() => {
  const path = route.path;
  if (path === "/order" || path.startsWith("/order/"))
    return orderStore.isLoading;
  if (path.startsWith("/payment")) return paymentStore.isLoading;
  return false;
});

const noStores = computed(() => formStore.knownStores.length === 0);

// Auto-fetch when switching between Order/Payment tabs
watch(
  () => route.path,
  (newPath) => {
    if (newPath.startsWith("/order") || newPath.startsWith("/payment")) {
      fetchCurrent();
    }
  },
);

watch(
  isFetching,
  (val) => {
    if (val) globalLoading.value = true;
    else {
      globalLoading.value = false;
    }
  },
  { immediate: false },
);

// ── Shop selector ────────────────────────────────────────────────────────────
function onSelectStore(id: string) {
  formStore.storeId = id;
  useCookie("active_store_id").value = id;
  // Clear existing data so the new store's data loads
  orderStore.$reset();
  paymentStore.$reset();
  fetchCurrent();
}

// ── Resolve valid token for current storeId ──────────────────────────────────
function resolveToken(sid: string): string | null {
  const storeCookie = useCookie<any>(sid);
  const data = storeCookie.value;
  const now = Date.now();
  if (data?.accessToken && data?.expiresTime && now < data.expiresTime) {
    return data.accessToken;
  }
  return null;
}

// ── Fetch for the current page ───────────────────────────────────────────────
function fetchCurrent(force = false) {
  const sid = formStore.storeId;
  if (!sid) return;
  const token = resolveToken(sid);

  if (!token) {
    const msg = "Token expired or missing. Please go to Token page.";
    if (route.path === "/order") orderStore.error = msg;
    if (route.path.startsWith("/payment")) paymentStore.error = msg;
    return;
  }

  // Clear previous errors
  if (route.path.startsWith("/order")) orderStore.error = null;
  if (route.path.startsWith("/payment")) paymentStore.error = null;

  if (route.path === "/order") {
    if (force || !orderStore.hasFetchedAll) orderStore.fetchAll(sid, token);
    paymentStore.fetchBalanceTransactions(sid, token, force);
  } else if (route.path.startsWith("/order/")) {
    const idMatch = route.path.match(/\/order\/(\d+)/);
    if (idMatch && idMatch[1]) {
      orderStore.fetchById(sid, token, idMatch[1], force);
    }
  } else if (route.path === "/payment") {
    if (force || (!paymentStore.payouts.length && !paymentStore.balance)) {
      paymentStore.fetchAll(sid, token);
    }
  } else if (route.path === "/payment/transactions") {
    paymentStore.fetchBalanceTransactions(sid, token, force);
  } else if (route.path.startsWith("/payment/payout/")) {
    const idMatch = route.path.match(/\/payment\/payout\/(\d+)/);
    if (idMatch && idMatch[1]) {
      paymentStore.fetchPayoutDetail(sid, token, Number(idMatch[1]), force);
    }
  }
}

// ── Get domain label for store select ────────────────────────────────────────
function getStoreDomain(id: string): string {
  const cookie = useCookie<any>(id);
  return cookie.value?.domain || "";
}

// ── Search functionality ─────────────────────────────────────────────────────
const searchQuery = ref("");
const filteredStores = computed(() => {
  const query = searchQuery.value.toLowerCase().trim();
  if (!query) return formStore.knownStores;
  return formStore.knownStores.filter((id) => {
    const domain = getStoreDomain(id).toLowerCase();
    return id.toLowerCase().includes(query) || domain.includes(query);
  });
});
</script>

<template>
  <div class="shop-layout-container">
    <!-- Sidebar Navigation -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="search-container">
          <svg
            class="search-icon"
            width="14"
            height="14"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
              clip-rule="evenodd"
            />
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search stores..."
            class="sidebar-search"
          />
        </div>
      </div>

      <div class="sidebar-content">
        <template v-if="noStores">
          <div class="sidebar-empty">
            <p>No stores found</p>
            <NuxtLink to="/manager" class="shop-bar-link">Add Store</NuxtLink>
          </div>
        </template>
        <template v-else>
          <div
            v-for="id in filteredStores"
            :key="id"
            class="sidebar-item"
            :class="{ active: formStore.storeId === id }"
            @click="onSelectStore(id)"
          >
            <div class="sidebar-item-dot"></div>
            <div class="sidebar-item-label">{{ getStoreDomain(id) || id }}</div>
          </div>
        </template>
      </div>
    </aside>

    <!-- Main Content Area -->
    <main class="main-content">
      <div class="shop-bar">
        <div class="shop-bar-left">
          <slot name="title" />
        </div>

        <div class="shop-bar-right">
          <button
            class="btn-fetch"
            :disabled="isFetching || !formStore.storeId"
            @click="fetchCurrent(true)"
          >
            <svg
              v-if="isFetching"
              class="spin"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <path
                d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
              />
            </svg>
            <svg
              v-else
              width="14"
              height="14"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                clip-rule="evenodd"
              />
            </svg>
            {{ isFetching ? "Loading…" : "Refresh" }}
          </button>
        </div>
      </div>

      <div class="page-content">
        <template v-if="formStore.storeId">
          <slot />
        </template>
        <template v-else>
          <div class="not-selected-container">
            <NotFound class="not-selected-icon" />
            <div class="not-selected-text">
              <h3>No Shop Selected</h3>
              <p>
                Please pick a store from the sidebar to view its orders and
                payments.
              </p>
            </div>
          </div>
        </template>
      </div>
    </main>
  </div>
</template>

<style scoped>
.shop-layout-container {
  display: flex;
  min-height: calc(100vh - 64px); /* Subtract nav height if any */
  max-width: 1400px;
  margin: 0 auto;
  gap: 24px;
  padding: 0 20px;
}

/* Sidebar Styling */
.sidebar {
  width: 260px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-right: 1px solid var(--border);
  border-radius: 12px;
  margin: 12px 0px;
  overflow: hidden;
  box-shadow: var(--shadow);
}

.sidebar-header {
  padding: 6px 4px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid var(--border);
}

.search-container {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 8px;
  color: var(--text-muted);
  pointer-events: none;
}

.sidebar-search {
  width: 100%;
  height: 32px;
  padding: 0 8px 0 30px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 13px;
  font-family: inherit;
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.2s;
}

.sidebar-search:focus {
  border-color: var(--blue);
  background: var(--surface);
}

.btn-manage {
  color: var(--text-muted);
  display: flex;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s;
}

.btn-manage:hover {
  background: var(--bg);
  color: var(--text-primary);
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 4px 4px;
}

.sidebar-item {
  display: flex;
  align-items: center;
  padding: 5px 10px;
  gap: 12px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  border-radius: 6px;
  border: 1px solid transparent;
}

.sidebar-item:hover {
  background: var(--bg);
}

.sidebar-item.active {
  background: var(--badge-paid);
  color: var(--badge-paid-text);
  border-color: (--badge-paid-border);
}

.sidebar-item-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--badge-paid-text);
  flex-shrink: 0;
  display: none;
}

.sidebar-item.active .sidebar-item-dot {
  display: inline-flex;
}

.sidebar-item-label {
  font-size: 13.5px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-empty {
  padding: 40px 20px;
  text-align: center;
  color: var(--text-muted);
}

/* Main Content Area */
.main-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.shop-bar {
  padding: 16px 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 20px;
}

.shop-bar-left {
  flex: 1;
  min-width: 0;
}

.shop-bar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn-fetch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 16px;
  background: var(--text-primary);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: filter 0.2s;
}

.btn-fetch:hover:not(:disabled) {
  filter: brightness(1.2);
}

.btn-fetch:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.shop-bar-link {
  color: var(--blue);
  font-weight: 600;
  text-decoration: none;
}

.spin {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.page-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.not-selected-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  color: var(--text-secondary);
}

.not-selected-icon {
  width: 320px;
  height: auto;
  opacity: 0.8;
  margin-bottom: 24px;
}

.not-selected-text h3 {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.not-selected-text p {
  font-size: 14px;
  color: var(--text-muted);
}

@media (max-width: 768px) {
  .shop-layout-container {
    flex-direction: column;
    padding: 0 12px;
  }
  .sidebar {
    width: 100%;
    max-height: 200px;
  }
}
</style>
