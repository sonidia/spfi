<script lang="ts" setup>
import { useFormStore } from "../stores/form";
import { useOrderStore } from "../stores/order";
import { usePaymentStore } from "../stores/payment";

const formStore = useFormStore();
const orderStore = useOrderStore();
const paymentStore = usePaymentStore();
const route = useRoute();

onMounted(() => {
  formStore.loadKnownStores();
  // Restore last selected storeId from session
  if (!formStore.storeId) {
    const sid = useCookie("active_store_id").value as string;
    if (sid) formStore.storeId = sid;
  }
  // Initial fetch if we already have a sid
  if (formStore.storeId) {
    fetchCurrent();
  }
});

// Auto-fetch when switching between Order/Payment tabs
watch(
  () => route.path,
  (newPath) => {
    if (["/order", "/payment"].includes(newPath)) {
      fetchCurrent();
    }
  },
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
function fetchCurrent() {
  const sid = formStore.storeId;
  if (!sid) return;
  const token = resolveToken(sid);

  if (!token) {
    const msg = "Token expired or missing. Please go to Token page.";
    if (route.path === "/order") orderStore.error = msg;
    if (route.path === "/payment") paymentStore.error = msg;
    return;
  }

  // Clear previous errors
  if (route.path === "/order") orderStore.error = null;
  if (route.path === "/payment") paymentStore.error = null;

  if (route.path === "/order" && !orderStore.orders.length) {
    orderStore.fetchAll(sid, token);
  } else if (
    route.path === "/payment" &&
    !paymentStore.payouts.length &&
    !paymentStore.balance
  ) {
    paymentStore.fetchAll(sid, token);
  }
}

const isFetching = computed(() => {
  if (route.path === "/order") return orderStore.isLoading;
  if (route.path === "/payment") return paymentStore.isLoading;
  return false;
});

const noStores = computed(() => formStore.knownStores.length === 0);
</script>

<template>
  <div class="layout">
    <!-- Shop selector bar -->
    <div class="shop-bar">
      <!-- Page Title Slot (Left) -->
      <div class="shop-bar-left">
        <slot name="title" />
      </div>

      <!-- Controls (Right) -->
      <div class="shop-bar-right">
        <template v-if="noStores">
          <span class="no-stores-hint">
            No stores configured —
            <NuxtLink to="/token" class="shop-bar-link"
              >Go to Token page</NuxtLink
            >
          </span>
        </template>
        <template v-else>
          <select
            class="shop-select"
            :value="formStore.storeId"
            @change="onSelectStore(($event.target as HTMLSelectElement).value)"
          >
            <option value="" disabled>Select a store…</option>
            <option v-for="id in formStore.knownStores" :key="id" :value="id">
              {{ id }}
            </option>
          </select>
        </template>

        <button
          class="btn-fetch"
          :disabled="isFetching || !formStore.storeId"
          @click="fetchCurrent"
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
          {{ isFetching ? "Loading…" : "Fetch" }}
        </button>
      </div>
    </div>

    <slot />
  </div>
</template>

<style scoped>
.shop-bar {
  max-width: 100%;
  margin: 0 auto;
  padding: 12px 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 10px;
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
.shop-select {
  height: 31px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 13px;
  font-family: inherit;
  background: var(--surface);
  color: var(--text-primary);
  cursor: pointer;
  min-width: 180px;
  max-width: 280px;
}

.btn-fetch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 29px;
  padding: 0 14px;
  background: var(--text-primary, #1a1a1a);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: opacity 0.15s;
  white-space: nowrap;
}
.btn-fetch:hover:not(:disabled) {
  opacity: 0.85;
}
.btn-fetch:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.manage-link,
.shop-bar-link {
  font-size: 13px;
  color: var(--blue);
  text-decoration: none;
}
.manage-link:hover,
.shop-bar-link:hover {
  text-decoration: underline;
}
.no-stores-hint {
  font-size: 13px;
  color: var(--text-secondary, #6d6d6d);
}
.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
