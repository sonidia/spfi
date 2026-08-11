<script lang="ts" setup>
import {
  ArrowLeftToLine,
  ArrowRightToLine,
  Eraser,
  PlugZap,
  Search,
  X,
} from "@lucide/vue";
import {
  useSheetService,
  type ProxySheetRow,
} from "~/composables/useSheetService";
import { useStoreTabData } from "~/composables/useStoreTabData";
import { useCredentialVaultStore } from "~/stores/credentialVault";
import type { ShopifyAccessTokenResponse } from "~~/types/shopify";
import { resolveStoreTab } from "~~/types/store";
import { getAppErrorMessage } from "~~/utils/error";
import { resolveStoreAccessToken } from "~~/utils/shop-auth";
import { SPF_SHEET_TABS } from "~~/utils/sheetConfig";
import { getSheetUrls } from "~~/utils/sheets";
import { useLoading } from "../composables/useLoading";
import { useCustomerStore } from "../stores/customers";
import { useFormStore } from "../stores/form";
import { useOrderStore } from "../stores/order";
import { usePaymentStore } from "../stores/payment";
import { useProductStore } from "../stores/product";
import { useShopProfileStore } from "../stores/shopProfile";

const { SPF_SHEET_URL } = getSheetUrls();

const formStore = useFormStore();
const { t } = useLocalization();
const { requestConfirmation } = useConfirmDialog();
const credentialVault = useCredentialVaultStore();
const customerStore = useCustomerStore();
const paymentStore = usePaymentStore(); // Moved up and ensured it's available
const orderStore = useOrderStore();
const productStore = useProductStore();
const shopProfileStore = useShopProfileStore();
const route = useRoute();
const router = useRouter();
const { hydrateStoreData, loadStoreTabData } = useStoreTabData();
const { state: activeStoreStorage } = useLocalStorage("active_store_id", "");

const { loading: globalLoading } = useLoading();
const isLayoutActive = ref(true);
const hasSkippedInitialActivation = ref(false);
const isSidebarCollapsed = ref(false);

onMounted(() => {
  isSidebarCollapsed.value =
    localStorage.getItem("spf-sidebar-collapsed") === "true";
  formStore.loadKnownStores();
  syncShopFromRoute(true);
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

// ── Shop selector ────────────────────────────────────────────────────────────
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
      activeStoreStorage.value ||
      "";
    if (!queryShop) return;
    router.replace({ query: { ...route.query, shop: queryShop } });
  }

  const didChangeShop = formStore.storeId !== queryShop;
  formStore.storeId = queryShop;
  activeStoreStorage.value = queryShop;

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
  activeStoreStorage.value = id;

  // Sync URL query param
  router.replace({ query: { ...route.query, shop: id } });

  // Hydrate cached data for quick switch, fallback to reset
  hydrateStoreData(id);
}

// ── Resolve valid token for current storeId ──────────────────────────────────
function resolveToken(sid: string): string | null {
  if (!sid) return null;
  return resolveStoreAccessToken(credentialVault.getStoreData(sid)) || null;
}

// ── Fetch for the current page ───────────────────────────────────────────────
function fetchCurrent(force = false) {
  const sid = formStore.storeId;
  if (!sid) return;

  if (route.path === "/store") {
    if (force) {
      void loadStoreTabData(resolveStoreTab(route.query.tab), sid, true);
    }
    return;
  }

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
  } else if (route.path.startsWith("/store/payout/")) {
    const idMatch = route.path.match(/\/store\/payout\/(\d+)/);
    if (idMatch && idMatch[1]) {
      paymentStore.fetchPayoutDetail(sid, token, Number(idMatch[1]), force);
    }
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
  const errors: string[] = [];

  try {
    // 0. SPF cache setup
    const spfUrl = SPF_SHEET_URL.trim();
    const spfSheetNames: string[] = [...SPF_SHEET_TABS];
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

async function deleteStoreOption(id: string) {
  if (
    !(await requestConfirmation({
      title: t("confirm.deleteTitle"),
      message: t("store.deleteConfirm", { id }),
      confirmLabel: t("common.delete"),
    }))
  ) {
    return;
  }
  formStore.removeKnownStore(id);
  credentialVault.removeStoreData(id);
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
                  <template #trigger="{ isOpen, triggerProps }">
                    <button
                      v-bind="triggerProps"
                      type="button"
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
                      <button
                        type="button"
                        role="menuitem"
                        class="popover-item"
                        @click="
                          deleteStoreOption(id);
                          close();
                        "
                        style="color: var(--badge-cancelled-text, #d72c0d)"
                      >
                        <IconsDelete />
                        Remove shop
                      </button>
                    </div>
                  </template>
                </BasePopover>
              </div>
            </div>
          </div>
        </template>
      </div>

      <ShopRateLimitQuota :collapsed="isSidebarCollapsed" />
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

<style scoped src="../assets/styles/layouts/shop.css"></style>
