<script lang="ts" setup>
import {
  ArrowLeftToLine,
  ArrowRightToLine,
  Eraser,
  LockKeyhole,
  PlugZap,
  Search,
  X,
} from "@lucide/vue";
import {
  useSheetService,
  type ProxySheetRow,
} from "~/composables/useSheetService";
import { useCredentialVaultStore } from "~/stores/credentialVault";
import type { ShopifyAccessTokenResponse } from "~~/types/shopify";
import { getAppErrorMessage } from "~~/utils/error";
import { SPF_SHEET_TABS } from "~~/utils/sheetConfig";
import { getSheetUrls } from "~~/utils/sheets";
import { useLoading } from "../composables/useLoading";
import { useCustomerStore } from "../stores/customers";
import { useFormStore } from "../stores/form";
import { useLocationStore } from "../stores/locations";
import { useOrderStore } from "../stores/order";
import { usePaymentStore } from "../stores/payment";
import { useProductStore } from "../stores/product";
import { useShopProfileStore } from "../stores/shopProfile";

const { SPF_SHEET_URL } = getSheetUrls();

const formStore = useFormStore();
const credentialVault = useCredentialVaultStore();
const customerStore = useCustomerStore();
const locationStore = useLocationStore();
const paymentStore = usePaymentStore(); // Moved up and ensured it's available
const orderStore = useOrderStore();
const productStore = useProductStore();
const shopProfileStore = useShopProfileStore();
const route = useRoute();
const router = useRouter();

const { loading: globalLoading } = useLoading();
const isLayoutActive = ref(true);
const hasSkippedInitialActivation = ref(false);
const isSidebarCollapsed = ref(false);

onMounted(() => {
  isSidebarCollapsed.value =
    localStorage.getItem("spf-sidebar-collapsed") === "true";
  formStore.loadKnownStores();
  if (credentialVault.isUnlocked) syncShopFromRoute(true);
});

function toggleSidebar() {
  isSidebarCollapsed.value = !isSidebarCollapsed.value;
  localStorage.setItem(
    "spf-sidebar-collapsed",
    String(isSidebarCollapsed.value),
  );
}

onActivated(() => {
  isLayoutActive.value = true;

  if (!hasSkippedInitialActivation.value) {
    hasSkippedInitialActivation.value = true;
    return;
  }

  syncShopFromRoute(true);
});

onDeactivated(() => {
  isLayoutActive.value = false;
  globalLoading.value = false;
});

const isFetching = computed(() => {
  const path = route.path;
  if (path === "/order" || path.startsWith("/order/"))
    return orderStore.isLoading;
  if (path.startsWith("/store")) {
    if (route.query.tab === "customers") {
      return customerStore.isLoading || customerStore.isLoadingDetail;
    }
    if (route.query.tab === "profile") {
      return (
        shopProfileStore.isLoading ||
        paymentStore.isLoading ||
        orderStore.isLoading
      );
    }
    if (route.query.tab === "products") return productStore.isLoading;
    if (route.query.tab === "orders") return orderStore.isLoading;
    return paymentStore.isLoading || orderStore.isLoading;
  }
  if (path === "/customer") {
    return customerStore.isLoading || customerStore.isLoadingDetail;
  }
  if (path === "/product") return productStore.isLoading;
  if (path === "/profile") {
    return shopProfileStore.isLoading || productStore.isLoading;
  }
  return false;
});

const noStores = computed(() => formStore.knownStores.length === 0);

// Auto-fetch when switching between Order/Payment tabs
watch(
  () => route.path,
  (newPath) => {
    if (!isLayoutActive.value) return;

    if (
      newPath.startsWith("/order") ||
      newPath.startsWith("/store") ||
      newPath === "/customer" ||
      newPath === "/product" ||
      newPath === "/profile"
    ) {
      fetchCurrent();
    }
  },
);

watch(
  isFetching,
  (val) => {
    if (!isLayoutActive.value) return;

    if (val) globalLoading.value = true;
    else {
      globalLoading.value = false;
    }
  },
  { immediate: false },
);

// Sync shop from URL query changes (e.g. forward/backward or manual entry)
watch(
  () => route.query.shop,
  () => {
    if (!isLayoutActive.value) return;

    syncShopFromRoute(true);
  },
);

watch(
  () => credentialVault.isUnlocked,
  (unlocked) => {
    if (unlocked && isLayoutActive.value) {
      syncShopFromRoute(true);
    }
  },
);

// ── Shop selector ────────────────────────────────────────────────────────────
function hydrateStoreData(storeId: string) {
  const hasOrders = orderStore.hydrate(storeId);
  if (!hasOrders) orderStore.$reset();

  const hasPayments = paymentStore.hydrate(storeId);
  if (!hasPayments) paymentStore.$reset();

  const hasProducts = productStore.hydrate(storeId);
  if (!hasProducts) productStore.$reset();

  const hasLocations = locationStore.hydrate(storeId);
  if (!hasLocations) locationStore.$reset();

  const hasCustomers = customerStore.hydrate(storeId);
  if (!hasCustomers) customerStore.$reset();

  const hasShopProfile = shopProfileStore.hydrate(storeId);
  if (!hasShopProfile) shopProfileStore.$reset();
}

function getRouteShop() {
  const queryShop = route.query.shop;

  if (Array.isArray(queryShop)) {
    return queryShop[0] || "";
  }

  return typeof queryShop === "string" ? queryShop : "";
}

function syncShopFromRoute(shouldFetch = false) {
  let queryShop = getRouteShop();

  if (!queryShop) {
    queryShop =
      formStore.storeId ||
      useLocalStorage("active_store_id", "").state.value ||
      "";
    if (!queryShop) return;
    router.replace({ query: { ...route.query, shop: queryShop } });
  }

  const didChangeShop = formStore.storeId !== queryShop;
  formStore.storeId = queryShop;
  useLocalStorage("active_store_id", "").state.value = queryShop;

  if (didChangeShop) {
    hydrateStoreData(queryShop);
  }

  if (shouldFetch) {
    fetchCurrent();
  }
}

function onSelectStore(id: string) {
  if (formStore.storeId === id) {
    if (getRouteShop() !== id) {
      router.replace({ query: { ...route.query, shop: id } });
    }
    return;
  }

  formStore.storeId = id;
  useLocalStorage("active_store_id", "").state.value = id;

  // Sync URL query param
  router.replace({ query: { ...route.query, shop: id } });

  // Hydrate cached data for quick switch, fallback to reset
  hydrateStoreData(id);
}

// ── Resolve valid token for current storeId ──────────────────────────────────
function resolveToken(sid: string): string | null {
  if (!sid) return null;
  const data = credentialVault.getStoreData(sid);
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
    if (route.path.startsWith("/store")) paymentStore.error = msg;
    if (route.path === "/customer") customerStore.error = msg;
    if (route.path === "/profile") shopProfileStore.error = msg;
    return;
  }

  // Clear previous errors
  if (route.path.startsWith("/order")) orderStore.error = null;
  if (route.path.startsWith("/store")) paymentStore.error = null;
  if (route.path === "/customer") customerStore.error = null;
  if (route.path === "/profile") shopProfileStore.error = null;

  if (route.path === "/order") {
    if (force || !orderStore.hasFetchedAll) orderStore.fetchAll(sid, token);
    paymentStore.fetchBalanceTransactions(sid, token, force);
  } else if (route.path.startsWith("/order/")) {
    const idMatch = route.path.match(/\/order\/(\d+)/);
    if (idMatch && idMatch[1]) {
      orderStore.fetchById(sid, token, idMatch[1], force);
    }
  } else if (route.path === "/store") {
    if (route.query.tab === "customers") {
      customerStore.fetchAll(sid, token, customerStore.activeQuery);
    } else if (route.query.tab === "profile") {
      shopProfileStore.fetchProfile(sid, token);
      if (force || !paymentStore.hasFetchedAll) {
        paymentStore.fetchAll(sid, token, force);
      }
      paymentStore.fetchBalanceTransactions(sid, token, force);
      if (force || !orderStore.hasFetchedAll) {
        orderStore.fetchAll(sid, token, force);
      }
    } else if (route.query.tab === "products") {
      productStore.fetchAll(sid, token);
    } else if (route.query.tab === "orders") {
      orderStore.fetchAll(sid, token, force);
      paymentStore.fetchBalanceTransactions(sid, token, force);
    } else {
      if (force || !paymentStore.hasFetchedAll) {
        paymentStore.fetchAll(sid, token, force);
      }
      paymentStore.fetchBalanceTransactions(sid, token, force);
    }
  } else if (route.path.startsWith("/store/payout/")) {
    const idMatch = route.path.match(/\/store\/payout\/(\d+)/);
    if (idMatch && idMatch[1]) {
      paymentStore.fetchPayoutDetail(sid, token, Number(idMatch[1]), force);
    }
  } else if (route.path === "/product") {
    if (force || !productStore.hasFetchedAll) productStore.fetchAll(sid, token);
  } else if (route.path === "/customer") {
    if (force || !customerStore.hasFetchedAll) {
      customerStore.fetchAll(sid, token, customerStore.activeQuery);
    }
  } else if (route.path === "/profile") {
    if (force || !shopProfileStore.hasFetchedProfile) {
      shopProfileStore.fetchProfile(sid, token);
    }
    if (force || !productStore.hasFetchedAll) {
      productStore.fetchAll(sid, token);
    }
  }
}

// ── Get domain label for store select ────────────────────────────────────────
function getStoreDomain(id: string): string {
  if (!id) return "";
  return credentialVault.getPublicStoreData(id).domain || "";
}

function getStoreInitials(id: string): string {
  const label = getStoreDomain(id) || id;
  return (
    label
      .replace(/^https?:\/\//, "")
      .charAt(0)
      .toUpperCase() || "S"
  );
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

const { readProxySheetRows, buildRangeFromSheetName, normalizeSpreadsheetId } =
  useSheetService();

// ── Add Store Modal State ───────────────────────────────────────────────────
const isAddModalOpen = ref(false);
const addMode = ref<"single" | "bulking">("single");
const newStoreId = ref("");
const newDomain = ref("");
const newSock = ref("");
const newClientId = ref("");
const newClientSecret = ref("");

function clearInputs() {
  newDomain.value = "";
  newSock.value = "";
  newStoreId.value = "";
  newClientId.value = "";
  newClientSecret.value = "";
  genError.value = "";
  genSuccess.value = "";
  resetSteps();
}
const isFindingShop = ref(false);
const genError = ref("");
const genSuccess = ref("");

const findShopSteps = ref([
  { id: "MASTER", label: "Searching master sheet", status: "pending" },
  { id: "TOKEN_GEN", label: "Generating Shopify Token", status: "pending" },
  { id: "DONE", label: "Finalizing store", status: "pending" },
]);

function resetSteps() {
  findShopSteps.value.forEach((s) => (s.status = "pending"));
}
function setStep(id: string, status: "pending" | "active" | "done" | "error") {
  const step = findShopSteps.value.find((s) => s.id === id);
  if (step) step.status = status;
}

function toUserFriendlyMessage(error: unknown) {
  const rawMessage = getAppErrorMessage(error, "");
  const msg = rawMessage.toLowerCase();

  if (
    msg.includes("socks5 authentication failed") ||
    (msg.includes("proxy") && msg.includes("authentication")) ||
    msg.includes("socket closed")
  ) {
    return "The SOCKS proxy is currently not working or the account details are incorrect. Please switch to a different proxy and try again.";
  }

  if (
    msg.includes("etimedout") ||
    msg.includes("timeout") ||
    msg.includes("econnreset") ||
    msg.includes("ehostunreach") ||
    msg.includes("enotfound")
  ) {
    return "Không kết nối được tới proxy hoặc Shopify. Vui lòng kiểm tra mạng/proxy rồi thử lại.";
  }

  if (msg.includes("no proxy") || msg.includes("missing proxy")) {
    return "Thiếu thông tin sock (proxy). Vui lòng nhập sock trước khi thêm shop.";
  }

  return rawMessage || "Thao tác chưa thành công. Vui lòng thử lại.";
}

async function addShop() {
  const domains = newDomain.value
    .split("\n")
    .map((d) => d.trim())
    .filter(Boolean);
  if (!domains.length) return;

  genError.value = "";
  genSuccess.value = "";
  resetSteps();
  isFindingShop.value = true;

  const manSock = newSock.value.trim();
  const manSId = newStoreId.value.trim();
  const manCId = newClientId.value.trim();
  const manCSec = newClientSecret.value.trim();

  let successCount = 0;
  let errors: string[] = [];

  try {
    // 0. SPF cache setup
    const spfUrl = SPF_SHEET_URL.trim();
    let spfSheetNames: string[] = [...SPF_SHEET_TABS];
    const spfRowsCache: Record<string, ProxySheetRow[]> = {};

    for (const domain of domains) {
      resetSteps();
      setStep("MASTER", "active");

      let sId = domains.length === 1 ? manSId : "";
      let cId = domains.length === 1 ? manCId : "";
      let cSec = domains.length === 1 ? manCSec : "";
      let sock = domains.length === 1 ? manSock : "";

      try {
        if (!sId || !cId || !cSec) {
          if (!spfUrl) {
            throw new Error(
              "Master sheet is not configured. Enter Store ID, Client ID, and Client Secret manually.",
            );
          }

          const domainSearch = domain.toLowerCase();

          // 1. Discovery Phase

          let foundShop: ProxySheetRow | null = null;

          for (const sheetName of spfSheetNames) {
            if (!spfRowsCache[sheetName]) {
              spfRowsCache[sheetName] = await readProxySheetRows({
                spreadsheetId: normalizeSpreadsheetId(spfUrl),
                range: buildRangeFromSheetName(sheetName),
                dataRowStart: 2,
                mapping: {
                  domain: 6,
                  proxyUrl: 5,
                  credentials: 21,
                },
              });
            }

            foundShop =
              spfRowsCache[sheetName].find(
                (row) => row.domain.trim().toLowerCase() === domainSearch,
              ) || null;

            if (foundShop) break;
          }

          if (!foundShop) {
            throw new Error(`Không tìm thấy shop nào với domain: ${domain}`);
          }
          setStep("MASTER", "done");

          if (foundShop.proxyUrl && !sock) sock = foundShop.proxyUrl.trim();
          if (foundShop.storeId && !sId) sId = foundShop.storeId;
          if (foundShop.clientId && !cId) cId = foundShop.clientId;
          if (foundShop.clientSecret && !cSec) cSec = foundShop.clientSecret;
        } else {
          setStep("MASTER", "done");
        }

        // 1.5 – Check if this store is already configured
        if (sId && formStore.knownStores.includes(sId)) {
          throw new Error(`Đã có sẵn store này (${sId}).`);
        }

        // 2. Token Generation Phase
        if (!sId || !cId || !cSec) {
          throw new Error("Missing Store ID, Client ID, or Secret.");
        }

        setStep("TOKEN_GEN", "active");
        const res = await $fetch<ShopifyAccessTokenResponse>(
          "/api/generate-token",
          {
            method: "POST",
            body: {
              storeId: sId,
              clientId: cId,
              clientSecret: cSec,
              sock: sock,
            },
          },
        );

        if (!res?.access_token) {
          throw new Error("Failed to retrieve access token");
        }
        setStep("TOKEN_GEN", "done");

        // 3. Storage Phase
        setStep("DONE", "active");
        const now = Date.now();
        const expiresTime = now + 24 * 60 * 60 * 1000;
        await credentialVault.saveStoreData(sId, {
          clientId: cId,
          clientSecret: cSec,
          accessToken: res.access_token,
          expiresTime,
          domain: domain,
          sock: sock,
        });

        formStore.addKnownStore(sId);
        if (domains.length === 1) {
          formStore.storeId = sId;
        }

        successCount++;
        setStep("DONE", "done");
      } catch (err) {
        setStep("TOKEN_GEN", "error");
        errors.push(`${domain}: ${toUserFriendlyMessage(err)}`);
      }
    }

    if (errors.length) {
      genError.value = errors.join("\n");
    }
    if (successCount > 0) {
      genSuccess.value = `Successfully added ${successCount} store(s).`;
      setTimeout(() => {
        isAddModalOpen.value = false;
        newStoreId.value = "";
        newClientId.value = "";
        newClientSecret.value = "";
        newDomain.value = "";
        newSock.value = "";
        genSuccess.value = "";
        resetSteps();
      }, 1500);
    }
  } finally {
    isFindingShop.value = false;
    if (domains.length > 1) {
      resetSteps();
    }
  }
}

function handlePaste(event: ClipboardEvent) {
  const text = event.clipboardData?.getData("text");
  if (!text) return;
  const parts = text.split(/[\/|]/).map((s) => s.trim());
  if (parts.length >= 3) {
    event.preventDefault();
    newStoreId.value = parts[0] || "";
    newClientId.value = parts[1] || "";
    newClientSecret.value = parts[2] || "";
  }
}

function deleteStoreOption(id: string) {
  if (confirm(`Are you sure you want to delete store ${id}?`)) {
    formStore.removeKnownStore(id);
    credentialVault.removeStoreData(id);
  }
}
</script>

<template>
  <div class="shop-layout-container" :class="{ 'is-single-panel': noStores }">
    <!-- Sidebar Navigation -->
    <aside
      v-if="!noStores"
      class="sidebar"
      :class="{ 'is-collapsed': isSidebarCollapsed }"
    >
      <div class="sidebar-overview">
        <div v-if="!isSidebarCollapsed" class="search-container">
          <Search class="search-icon" :size="14" aria-hidden="true" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search stores..."
            class="sidebar-search"
          />
          <span class="store-count" aria-label="Connected stores">
            {{ formStore.knownStores.length }}
          </span>
        </div>
        <div class="sidebar-overview-actions">
          <BaseButton
            class="sidebar-toggle"
            variant="ghost"
            icon-only
            :aria-label="
              isSidebarCollapsed
                ? 'Expand store sidebar'
                : 'Collapse store sidebar'
            "
            :title="isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
            @click="toggleSidebar"
          >
            <template #icon>
              <ArrowRightToLine v-if="isSidebarCollapsed" />
              <ArrowLeftToLine v-else />
            </template>
          </BaseButton>
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
            :class="{
              active: formStore.storeId === id,
            }"
            :title="isSidebarCollapsed ? getStoreDomain(id) || id : undefined"
          >
            <div class="sidebar-item-label" @click="onSelectStore(id)">
              <span class="store-mark">{{ getStoreInitials(id) }}</span>
              <span v-if="!isSidebarCollapsed" class="store-copy">
                <strong>{{ getStoreDomain(id) || id }}</strong>
                <small>{{ id }}</small>
              </span>
            </div>
            <div v-if="!isSidebarCollapsed" class="sidebar-item-action-wrapper">
              <div @click.stop class="sidebar-item-actions">
                <BasePopover align="right">
                  <template #trigger="{ isOpen }">
                    <button
                      class="btn-sidebar-more"
                      :class="{ 'is-active': isOpen }"
                    >
                      <IconsMore
                        width="16"
                        height="16"
                        style="transform: rotate(90deg)"
                      />
                    </button>
                  </template>
                  <template #default="{ close }">
                    <div class="popover-menu">
                      <div
                        class="popover-item"
                        @click="
                          deleteStoreOption(id);
                          close();
                        "
                        style="color: var(--badge-cancelled-text, #d72c0d)"
                      >
                        <IconsDelete />
                        Remove shop
                      </div>
                    </div>
                  </template>
                </BasePopover>
              </div>
            </div>
          </div>
        </template>
      </div>
    </aside>

    <!-- Main Content Area -->
    <main class="main-content">
      <div class="shop-bar">
        <div class="shop-bar-left">
          <slot name="shop-bar-left">
            <div class="title-container">
              <slot name="title" />
              <IconsArrowRight v-if="formStore.storeId" />
              <h3 v-if="formStore.storeId">
                {{ getStoreDomain(formStore.storeId) || formStore.storeId }}
              </h3>
            </div>
          </slot>
        </div>

        <div class="shop-bar-right">
          <BaseButton
            class="btn-lock"
            title="Lock local credentials"
            @click="credentialVault.lock"
          >
            <template #icon><LockKeyhole /></template>
            Lock
          </BaseButton>
          <BaseButton
            v-if="formStore.storeId"
            class="btn-fetch"
            title="Refresh data for current store"
            :disabled="isFetching"
            @click="fetchCurrent(true)"
          >
            <template #icon>
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
              <IconsRefresh v-else />
            </template>
            {{ isFetching ? "Loading…" : "Refresh" }}
          </BaseButton>
          <button
            class="btn-sidebar-add"
            title="Add new store"
            @click="isAddModalOpen = true"
          >
            <IconsAdd />
            <span>Add store</span>
          </button>
        </div>
      </div>

      <div class="page-content">
        <slot />
      </div>
    </main>

    <!-- Add Store Modal -->
    <div
      v-if="isAddModalOpen"
      class="modal-backdrop add-store-backdrop"
      @click.self="isAddModalOpen = false"
    >
      <div
        class="modal-card add-store-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-store-modal-title"
      >
        <div class="modal-head add-store-modal-head">
          <div class="add-store-title-block">
            <h3 id="add-store-modal-title" class="modal-title">
              Connect New Store
            </h3>
          </div>
          <div class="add-store-head-actions">
            <div class="mode-toggle add-store-mode-toggle" aria-label="Add store mode">
              <button
                class="toggle-btn"
                type="button"
                :class="{ active: addMode === 'single' }"
                @click="addMode = 'single'"
              >
                <IconsCheck />
                Single
              </button>
              <button
                class="toggle-btn"
                type="button"
                :class="{ active: addMode === 'bulking' }"
                @click="addMode = 'bulking'"
              >
                <IconsBulking />
                Bulking
              </button>
            </div>
            <button
              class="btn-ghost add-store-close"
              type="button"
              title="Close"
              aria-label="Close"
              @click="isAddModalOpen = false"
            >
              <X :size="16" />
            </button>
          </div>
        </div>

        <div class="modal-body add-store-modal-body">
          <div v-if="addMode === 'single'" class="add-store-form">
            <div class="field field-50">
              <label class="field-label">Shop domain/URL</label>
              <input
                v-model="newDomain"
                class="inp domain_inp"
                type="text"
                placeholder="Your store domain (e.g., myshop.store)"
                @keyup.enter="addShop"
              />
            </div>
            <div class="field field-50">
              <label class="field-label">Sock/Proxy</label>
              <input
                v-model="newSock"
                type="text"
                class="inp"
                placeholder="IP:Port:User:Pass"
              />
            </div>
            <div class="field field-33">
              <label class="field-label">Store ID</label>
              <input
                v-model="newStoreId"
                type="text"
                class="inp"
                placeholder="e.g. mystore"
                @paste="handlePaste"
              />
            </div>
            <div class="field field-33">
              <label class="field-label">Client ID</label>
              <input
                v-model="newClientId"
                type="text"
                class="inp"
                placeholder="Client ID"
                @paste="handlePaste"
              />
            </div>
            <div class="field field-33">
              <label class="field-label">Client Secret</label>
              <input
                v-model="newClientSecret"
                type="password"
                class="inp"
                placeholder="Client Secret"
                @paste="handlePaste"
              />
            </div>
          </div>

          <div v-else class="add-store-form">
            <div class="field field-full">
              <label class="field-label">Shop domains</label>
              <textarea
                v-model="newDomain"
                placeholder="Your store domains (one per line, e.g. myshop.store)"
                class="inp domain_inp"
                rows="12"
              ></textarea>
            </div>
          </div>

          <div class="add-store-status">
            <div
              v-if="
                isFindingShop ||
                findShopSteps.some(
                  (s) => s.status !== 'pending' && s.status !== 'done',
                )
              "
              class="step-progress"
            >
              <div
                v-for="step in findShopSteps"
                :key="step.id"
                class="step-item"
                :class="'status-' + step.status"
              >
                <div class="step-icon">
                  <span v-if="step.status === 'active'" class="spinner-sm" />
                  <span v-else-if="step.status === 'done'"><IconsCheck /></span>
                  <span v-else-if="step.status === 'error'"><X :size="12" /></span>
                  <span v-else>-</span>
                </div>
                <span class="step-label">{{ step.label }}</span>
              </div>
            </div>

            <div v-if="genError" class="alert alert-err modal-alert">
              {{ genError }}
            </div>
            <div v-if="genSuccess" class="alert alert-ok modal-alert">
              {{ genSuccess }}
            </div>
          </div>
        </div>

        <div class="modal-actions add-store-modal-actions">
          <button
            class="btn-ghost"
            type="button"
            :disabled="isFindingShop"
            @click="clearInputs"
          >
            <Eraser :size="15" />
            Clear
          </button>
          <button
            class="btn-outline"
            type="button"
            @click="isAddModalOpen = false"
          >
            <X :size="15" />
            Cancel
          </button>
          <button
            class="btn-primary"
            type="button"
            :disabled="isFindingShop"
            @click="addShop"
          >
            <PlugZap :size="15" />
            {{ isFindingShop ? "Processing..." : "Add connect" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.shop-layout-container {
  display: flex;
  width: 1440px;
  max-width: none;
  min-height: calc(100vh - 64px);
  max-height: calc(100vh - 64px);
  margin: 0 auto;
  gap: 16px;
  padding: 0 20px;
  overflow: hidden !important;
}

.shop-layout-container.is-single-panel {
  max-width: none;
}

.shop-layout-container.is-single-panel .main-content {
  max-width: none;
}

.page-content {
  max-height: calc(100vh - 64px) !important;
  overflow-y: auto !important;
}

/* Sidebar Styling */
.sidebar {
  width: 286px;
  flex: 0 0 286px;
  position: sticky;
  top: 12px;
  align-self: flex-start;
  display: flex;
  flex-direction: column;
  margin: 12px 0;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-overlay);
  overflow: hidden;
  min-height: calc(100vh - 64px - 12px);
  max-height: calc(100vh - 64px - 12px);
  transition:
    width 0.18s ease,
    flex-basis 0.18s ease;
}

.sidebar.is-collapsed {
  width: 64px;
  flex-basis: 64px;
}

.sidebar-overview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 12px 10px 10px;
}

.sidebar-overview-actions {
  display: flex !important;
  grid-auto-flow: column;
  align-items: center;
  gap: 5px !important;
}

.sidebar-toggle {
  color: var(--text-sub);
  background: gray;
}

.sidebar.is-collapsed .sidebar-overview {
  justify-content: center;
  padding: 12px 8px 8px;
}

.sidebar.is-collapsed .sidebar-content {
  padding-inline: 6px;
}

.sidebar.is-collapsed .sidebar-item,
.sidebar.is-collapsed .sidebar-item-label {
  justify-content: center;
}

.search-container {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  border-radius: 6px;
}

.search-icon {
  position: absolute;
  left: 8px;
  color: var(--text-muted);
  pointer-events: none;
}

.sidebar-search {
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0 44px 0 30px;
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
  background: var(--surface);
}

.search-container .store-count {
  position: absolute;
  right: 6px;
  top: 50%;
  min-width: 24px;
  height: 22px;
  display: grid;
  place-items: center;
  border-radius: 7px;
  background: var(--green-soft);
  color: var(--green);
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
  transform: translateY(-50%);
  pointer-events: none;
}

.btn-manage {
  color: var(--text-muted);
  display: flex;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s linear;
}

.btn-manage:hover {
  background: var(--bg);
  color: var(--text-secondary);
}

.sidebar-item-action-wrapper {
  display: flex;
  align-items: center;
}

.sidebar-item-actions {
  display: flex;
  align-items: center;
  height: 100%;
  display: none;
}
.sidebar-item:hover .sidebar-item-actions,
.sidebar-item-actions:focus-within {
  display: inline-flex;
}
.btn-sidebar-more {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}
.btn-sidebar-more:hover,
.btn-sidebar-more.is-active {
  color: var(--text-primary);
}

.popover-menu {
  display: flex;
  flex-direction: column;
  padding: 4px 0;
}
.popover-item {
  padding: 8px 12px;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  gap: 4px;
  align-items: center;
  white-space: nowrap;
  color: var(--text-primary);
  transition: background 0.1s;
}
.popover-item:hover {
  background: var(--surface-soft);
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px 8px 10px;
}

.sidebar-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 48px;
  padding: 4px 8px;
  gap: 12px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  border-radius: 6px;
  border: 1px solid transparent;
}

.sidebar-item:hover {
  background: var(--surface-soft);
}

.sidebar-item.active {
  background: var(--badge-paid);
  color: var(--badge-paid-text);
  border-color: var(--badge-paid-border);
}

.sidebar-item-label {
  width: 100%;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 9px;
}

.store-mark {
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border: 1px solid rgba(31, 122, 77, 0.12);
  border-radius: 9px;
  background: var(--surface-soft);
  color: var(--green);
  font-size: 11px;
  font-weight: 900;
}

.sidebar-item.active .store-mark {
  background: var(--surface-raised);
}

.store-copy {
  min-width: 0;
  display: grid;
  line-height: 1.25;
}

.store-copy strong,
.store-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.store-copy strong {
  color: inherit;
  font-size: 12px;
  font-weight: 800;
}

.store-copy small {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 600;
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
  margin-bottom: 14px;
  border-bottom: 1px solid rgba(217, 228, 221, 0.72);
}

.shop-bar-left {
  flex: 1;
  min-width: 0;
}

.title-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.shop-bar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-lock,
.btn-fetch {
  min-height: 30px;
  border-radius: 8px;
  color: var(--text-sub);
  font-size: 13px;
  transition: all 0.2s;
}

.btn-lock:hover {
  border-color: rgba(31, 122, 77, 0.35);
  color: var(--green);
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
    min-height: auto;
    max-height: none;
    overflow: visible !important;
  }

  .shop-layout-container.is-single-panel .main-content {
    max-width: none;
  }

  .sidebar {
    width: 100%;
    flex-basis: auto;
    position: static;
    max-height: 230px;
    margin-bottom: 0;
  }

  .sidebar.is-collapsed {
    width: 100%;
    flex-basis: auto;
  }

  .sidebar.is-collapsed .sidebar-overview {
    justify-content: flex-end;
  }

  .page-content {
    max-height: none !important;
    overflow-y: visible !important;
  }

  .shop-bar {
    align-items: flex-start;
  }

  .title-container {
    align-items: flex-start;
    flex-direction: column;
    gap: 3px;
  }

  .title-container > svg {
    display: none;
  }
}

/* Sidebar Add Button */
.btn-sidebar-add {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 29.5px;
  background: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--bg);
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
  font-size: 13px;
  font-family: inherit;
  padding: 0 8px;
}

.sidebar.is-collapsed .btn-sidebar-add {
  width: 32px;
}

.btn-sidebar-add span {
  margin-left: 2px;
}

.btn-sidebar-add:hover {
  filter: brightness(1.3);
}

.btn-sidebar-add:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Modal Styles adapted from manager.vue */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal-card {
  background: var(--surface);
  width: 100%;
  max-width: 500px;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  max-height: 90vh;
}
.modal-head {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.modal-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.modal-body {
  padding: 20px;
  overflow-y: auto;
}
.modal-actions {
  padding: 16px 20px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
.btn-ghost {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: var(--text-muted);
  display: inline-grid;
  place-items: center;
}
.field {
  margin-bottom: 16px;
}
.field-row {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}
.field-row .field {
  flex: 1;
  margin-bottom: 0;
}
.field-label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  font-size: 13px;
}
.inp {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 14px;
}
.btn-primary {
  padding: 8px 16px;
  background: var(--blue);
  color: var(--bg);
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}
.btn-outline {
  padding: 8px 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  font-weight: 600;
  cursor: pointer;
}
.btn-primary,
.btn-outline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.alert {
  padding: 10px 12px;
  border-radius: 6px;
  margin-top: 12px;
  font-size: 13px;
}
.alert-err {
  background: var(--red-soft);
  color: var(--red);
}
.alert-ok {
  background: var(--green-soft);
  color: var(--green);
}

/* Step Progress */
.step-progress {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--surface-soft);
  border-radius: 8px;
  border: 1px solid var(--border);
}
.step-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--text-sub);
}
.step-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.status-active {
  color: var(--blue);
  font-weight: 600;
}
.status-done {
  color: var(--green);
}
.status-error {
  color: var(--red);
}

.spinner-sm {
  width: 14px;
  height: 14px;
  border: 2px solid var(--line);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.add-store-backdrop {
  z-index: 2550;
  padding: 20px;
  background: rgba(20, 34, 27, 0.46);
  backdrop-filter: blur(3px);
}

.add-store-modal {
  width: min(760px, 100%);
  max-width: 760px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  box-shadow: var(--shadow);
}

.add-store-modal-head {
  align-items: center;
  gap: 16px;
  padding: 14px 16px;
}

.add-store-title-block {
  min-width: 0;
}

.add-store-title-block .modal-title {
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 800;
}

.add-store-head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.add-store-mode-toggle {
  display: inline-flex;
  gap: 3px;
  padding: 4px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
}

.add-store-mode-toggle .toggle-btn {
  min-height: 30px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-sub);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  transition:
    background 0.15s,
    color 0.15s,
    box-shadow 0.15s;
}

.add-store-mode-toggle .toggle-btn.active {
  background: var(--surface);
  color: var(--text-primary);
  box-shadow: var(--shadow-soft);
}

.add-store-mode-toggle .toggle-btn :deep(svg) {
  width: 14px;
  height: 14px;
}

.add-store-close {
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--surface-raised);
  color: var(--text-sub);
}

.add-store-close:hover {
  background: var(--surface-soft);
  color: var(--text-primary);
}

.add-store-modal-body {
  padding: 0;
}

.add-store-form {
  display: grid;
  grid-template-columns: repeat(60, 1fr);
  gap: 12px;
  padding: 16px 18px;
}

.add-store-form .field {
  min-width: 0;
  margin-bottom: 0;
}

.add-store-form .field-50 {
  grid-column: span 30;
}

.add-store-form .field-33 {
  grid-column: span 20;
}

.add-store-form .field-full {
  grid-column: span 60;
}

.add-store-form .field-label {
  margin-bottom: 4px;
  color: var(--text-sub);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
}

.add-store-form .inp {
  min-height: 38px;
  padding: 7px 10px;
  border-radius: 7px;
  color: var(--text-primary);
  font: inherit;
  font-size: 13px;
}

.add-store-form .inp:focus {
  border-color: color-mix(in srgb, var(--green) 45%, var(--border));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--green-soft) 68%, transparent);
}

.add-store-form textarea.inp {
  min-height: 220px;
  line-height: 1.45;
  resize: vertical;
}

.add-store-status {
  display: grid;
  gap: 12px;
  padding: 0 18px 16px;
}

.add-store-modal .step-progress {
  margin: 0;
  padding: 12px 16px;
}

.add-store-modal .modal-alert {
  margin: 0;
  white-space: pre-wrap;
}

.add-store-modal-actions {
  gap: 10px;
  padding: 14px 18px;
  background: var(--surface-low);
}

.add-store-modal-actions .btn-ghost,
.add-store-modal-actions .btn-outline,
.add-store-modal-actions .btn-primary {
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font: inherit;
  font-size: 13px;
  font-weight: 800;
}

.add-store-modal-actions .btn-ghost {
  padding: 0 10px;
}

.add-store-modal-actions .btn-primary:disabled,
.add-store-modal-actions .btn-ghost:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

@media (max-width: 720px) {
  .add-store-backdrop {
    align-items: flex-start;
    padding: 12px;
  }

  .add-store-modal {
    max-height: calc(100vh - 24px);
  }

  .add-store-modal-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .add-store-head-actions {
    width: 100%;
    justify-content: space-between;
    margin-left: 0;
  }

  .add-store-form {
    grid-template-columns: 1fr;
  }

  .add-store-form .field-50,
  .add-store-form .field-33,
  .add-store-form .field-full {
    grid-column: auto;
  }

  .add-store-modal-actions {
    flex-direction: column-reverse;
  }
}
</style>
