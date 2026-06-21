<script lang="ts" setup>
import { useSheetService } from "~/composables/useSheetService";
import { SPF_SHEET_TABS } from "~~/utils/sheetConfig";
import { getSheetUrls } from "~~/utils/sheets";
import { useLoading } from "../composables/useLoading";
import { useFormStore } from "../stores/form";
import { useOrderStore } from "../stores/order";
import { usePaymentStore } from "../stores/payment";
import { useProductStore } from "../stores/product";
import { useShopProfileStore } from "../stores/shopProfile";

const { SPF_SHEET_URL } = getSheetUrls();

const formStore = useFormStore();
const paymentStore = usePaymentStore(); // Moved up and ensured it's available
const orderStore = useOrderStore();
const productStore = useProductStore();
const shopProfileStore = useShopProfileStore();
const route = useRoute();
const router = useRouter();

const { loading: globalLoading } = useLoading();
const isLayoutActive = ref(true);
const hasSkippedInitialActivation = ref(false);

onMounted(() => {
  formStore.loadKnownStores();
  syncShopFromRoute(true);
});

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
  if (path.startsWith("/payment")) return paymentStore.isLoading;
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
      newPath.startsWith("/payment") ||
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
function hydrateStoreData(storeId: string) {
  const hasOrders = orderStore.hydrate(storeId);
  if (!hasOrders) orderStore.$reset();

  const hasPayments = paymentStore.hydrate(storeId);
  if (!hasPayments) paymentStore.$reset();

  const hasProducts = productStore.hydrate(storeId);
  if (!hasProducts) productStore.$reset();

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
  const queryShop = getRouteShop();

  if (!queryShop) {
    // If no query shop, we don't auto-select from cookie anymore.
    formStore.storeId = "";
    return;
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
  formStore.storeId = id;
  useLocalStorage("active_store_id", "").state.value = id;

  // Sync URL query param
  router.replace({ query: { ...route.query, shop: id } });

  // Hydrate cached data for quick switch, fallback to reset
  hydrateStoreData(id);
  fetchCurrent();
}

// ── Resolve valid token for current storeId ──────────────────────────────────
function resolveToken(sid: string): string | null {
  if (!sid) return null;
  const storeCookie = useLocalStorage<any>(sid, {}).state;
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
    if (route.path === "/profile") shopProfileStore.error = msg;
    return;
  }

  // Clear previous errors
  if (route.path.startsWith("/order")) orderStore.error = null;
  if (route.path.startsWith("/payment")) paymentStore.error = null;
  if (route.path === "/profile") shopProfileStore.error = null;

  if (route.path === "/order") {
    if (force || !orderStore.hasFetchedAll) orderStore.fetchAll(sid, token);
    paymentStore.fetchBalanceTransactions(sid, token, force);
  } else if (route.path.startsWith("/order/")) {
    const idMatch = route.path.match(/\/order\/(\d+)/);
    if (idMatch && idMatch[1]) {
      orderStore.fetchById(sid, token, idMatch[1], force);
    }
  } else if (route.path === "/payment") {
    if (force || !paymentStore.hasFetchedAll) {
      paymentStore.fetchAll(sid, token, force);
    }
  } else if (route.path === "/payment/transactions") {
    paymentStore.fetchBalanceTransactions(sid, token, force);
  } else if (route.path.startsWith("/payment/payout/")) {
    const idMatch = route.path.match(/\/payment\/payout\/(\d+)/);
    if (idMatch && idMatch[1]) {
      paymentStore.fetchPayoutDetail(sid, token, Number(idMatch[1]), force);
    }
  } else if (route.path === "/product") {
    if (force || !productStore.hasFetchedAll) productStore.fetchAll(sid, token);
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
  const cookie = useLocalStorage<any>(id, {}).state;
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

function toUserFriendlyMessage(error: any) {
  const rawMessage = String(
    error?.data?.statusMessage || error?.data?.message || error?.message || "",
  );
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
    const spfRowsCache: Record<string, any[]> = {};

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

          let foundShop = null;

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

            foundShop = spfRowsCache[sheetName].find(
              (r: any) => r.domain?.trim().toLowerCase() === domainSearch,
            );

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
        const res: any = await $fetch("/api/generate-token", {
          method: "POST",
          body: {
            storeId: sId,
            clientId: cId,
            clientSecret: cSec,
            sock: sock,
          },
        });

        if (!res?.access_token) {
          throw new Error("Failed to retrieve access token");
        }
        setStep("TOKEN_GEN", "done");

        // 3. Storage Phase
        setStep("DONE", "active");
        const now = Date.now();
        const expiresTime = now + 24 * 60 * 60 * 1000;
        const cookie = useLocalStorage<any>(
          sId,
          {},
          { ttl: 60 * 60 * 24 * 365 * 10 * 1000 },
        ).state;
        cookie.value = {
          clientId: cId,
          clientSecret: cSec,
          accessToken: res.access_token,
          expiresTime,
          domain: domain,
          sock: sock,
        };

        formStore.addKnownStore(sId);
        if (domains.length === 1) {
          formStore.storeId = sId;
        }

        successCount++;
        setStep("DONE", "done");
      } catch (err: any) {
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
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(id);
    }
  }
}
</script>

<template>
  <div class="shop-layout-container" :class="{ 'is-single-panel': noStores }">
    <!-- Sidebar Navigation -->
    <aside v-if="!noStores" class="sidebar">
      <div class="sidebar-header">
        <button
          class="btn-sidebar-add"
          title="Add new store"
          @click="isAddModalOpen = true"
        >
          <IconsAdd />
        </button>
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
            :class="{
              active: formStore.storeId === id,
            }"
          >
            <div class="sidebar-item-label" @click="onSelectStore(id)">
              {{ getStoreDomain(id) || id }}
            </div>
            <div class="sidebar-item-action-wrapper">
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
          <div class="title-container">
            <slot name="title" />
            <IconsArrowRight v-if="formStore.storeId" />
            <h3 v-if="formStore.storeId">
              {{ getStoreDomain(formStore.storeId) || formStore.storeId }}
            </h3>
          </div>
        </div>

        <div class="shop-bar-right">
          <button
            v-if="formStore.storeId"
            class="btn-fetch"
            :disabled="isFetching"
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
            <IconsRefresh v-else />
            {{ isFetching ? "Loading…" : "Refresh" }}
          </button>
        </div>
      </div>

      <div class="page-content">
        <slot />
      </div>
    </main>

    <!-- ── Add Store Modal ── -->
    <div
      v-if="isAddModalOpen"
      class="modal-backdrop"
      @click.self="isAddModalOpen = false"
    >
      <div class="modal-card">
        <div
          class="modal-head"
          style="
            align-items: flex-start;
            justify-content: space-between;
            display: flex;
          "
        >
          <div>
            <h3 class="modal-title">Connect New Store</h3>
          </div>
          <div style="display: flex; gap: 8px; align-items: center">
            <div
              class="mode-toggle"
              style="
                display: flex;
                background: var(--bg);
                border-radius: 8px;
                padding: 4px;
                border: 1px solid var(--border);
              "
            >
              <button
                class="toggle-btn"
                :class="{ active: addMode === 'single' }"
                @click="addMode = 'single'"
                style="
                  padding: 6px 12px;
                  background: transparent;
                  border: none;
                  font-size: 13px;
                  font-weight: 500;
                  border-radius: 6px;
                  cursor: pointer;
                  transition: all 0.2s;
                "
                :style="
                  addMode === 'single'
                    ? 'background: var(--surface); color: var(--text-primary); box-shadow: var(--shadow);'
                    : 'color: var(--text-sub);'
                "
              >
                Single
              </button>
              <button
                class="toggle-btn"
                :class="{ active: addMode === 'bulking' }"
                @click="addMode = 'bulking'"
                style="
                  padding: 6px 12px;
                  background: transparent;
                  border: none;
                  font-size: 13px;
                  font-weight: 500;
                  border-radius: 6px;
                  cursor: pointer;
                  transition: all 0.2s;
                "
                :style="
                  addMode === 'bulking'
                    ? 'background: var(--surface); color: var(--text-primary); box-shadow: var(--shadow);'
                    : 'color: var(--text-sub);'
                "
              >
                Bulking
              </button>
            </div>
            <button class="btn-ghost" @click="isAddModalOpen = false">✕</button>
          </div>
        </div>

        <div class="modal-body">
          <div class="field field-full">
            <label class="field-label">Domain</label>
            <input
              v-if="addMode === 'single'"
              v-model="newDomain"
              class="inp"
              placeholder="Your store domains (e.g. myshop.store)"
              @keyup.enter="addShop"
            />
            <textarea
              v-else
              v-model="newDomain"
              placeholder="Your store domains (one per line, e.g. myshop.store)"
              class="inp"
              rows="6"
            ></textarea>
          </div>
          <template v-if="addMode === 'single'">
            <div class="field field-full">
              <label class="field-label">Sock/Proxy URL</label>
              <input
                v-model="newSock"
                type="text"
                class="inp"
                placeholder="IP:Port:User:Pass"
              />
            </div>
            <div class="field-row">
              <div class="field field-50">
                <label class="field-label">Store ID</label>
                <input
                  v-model="newStoreId"
                  type="text"
                  class="inp"
                  placeholder="mystore"
                  @paste="handlePaste"
                />
              </div>
            </div>
            <div class="field-row">
              <div class="field field-50">
                <label class="field-label">Client ID</label>
                <input
                  v-model="newClientId"
                  type="text"
                  class="inp"
                  @paste="handlePaste"
                />
              </div>
              <div class="field field-50">
                <label class="field-label">Client Secret</label>
                <input
                  v-model="newClientSecret"
                  type="password"
                  class="inp"
                  @paste="handlePaste"
                />
              </div>
            </div>
          </template>

          <!-- Step Progress -->
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
                <span v-else-if="step.status === 'done'">✓</span>
                <span v-else-if="step.status === 'error'">✕</span>
                <span v-else>○</span>
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

        <div class="modal-actions">
          <button
            class="btn-ghost"
            @click="clearInputs"
            :disabled="isFindingShop"
          >
            Clear
          </button>
          <button class="btn-outline" @click="isAddModalOpen = false">
            Cancel
          </button>
          <button
            class="btn-primary"
            :disabled="isFindingShop"
            @click="addShop"
          >
            {{ isFindingShop ? "Processing…" : "Add Connect" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.shop-layout-container {
  display: flex;
  min-height: calc(100vh - 64px - var(--footer-height, 36px));
  max-height: calc(100vh - 64px - var(--footer-height, 36px));
  max-width: 1400px;
  margin: 0 auto;
  gap: 24px;
  padding: 0 20px;
  overflow: hidden !important;
}

.shop-layout-container.is-single-panel {
  max-width: 900px;
  justify-content: center;
}

.shop-layout-container.is-single-panel .main-content {
  max-width: 760px;
}

.page-content {
  max-height: calc(100vh - 64px - var(--footer-height, 36px)) !important;
  overflow-y: auto !important;
}

/* Sidebar Styling */
.sidebar {
  width: 286px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  margin: 12px 0px;
  overflow: hidden;
  max-height: calc(100vh - 64px - var(--footer-height, 36px));
}

.sidebar-header {
  padding: 6px 4px;
  display: flex;
  align-items: center;
  gap: 2px;
  border-bottom: 1px solid var(--border);
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
  background: var(--surface);
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
  background: #f6f6f6;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px 4px;
}

.sidebar-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
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

.sidebar-item-label {
  width: 100%;
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
  margin-bottom: 20px;
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
  gap: 10px;
}

.btn-fetch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
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

  .shop-layout-container.is-single-panel .main-content {
    max-width: none;
  }

  .sidebar {
    width: 100%;
    max-height: 200px;
  }
}

/* Sidebar Add Button */
.btn-sidebar-add {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
  font-size: 0.8em;
  padding: 0 8px;
}

.btn-sidebar-add span {
  margin-left: 2px;
}

.btn-sidebar-add:hover {
  background: var(--surface);
  color: var(--blue);
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
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}
.btn-outline {
  padding: 8px 16px;
  background: white;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}
.alert {
  padding: 10px 12px;
  border-radius: 6px;
  margin-top: 12px;
  font-size: 13px;
}
.alert-err {
  background: #fce8e8;
  color: #c0392b;
}
.alert-ok {
  background: #e4f2e8;
  color: #1a7f37;
}

/* Step Progress */
.step-progress {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
}
.step-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: #666;
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
  color: #1a7f37;
}
.status-error {
  color: #c0392b;
}

.spinner-sm {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
</style>
