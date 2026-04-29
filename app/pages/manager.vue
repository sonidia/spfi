<script lang="ts" setup>
import { useSheetService } from "~/composables/useSheetService";
import { useFormStore } from "~/stores/form";
import {
  QUAN_LY_SHEET_URL,
  getProxySheetPreset,
  machineSheets,
} from "~~/utils/sheets";

definePageMeta({ layout: false });

const formStore = useFormStore();

// ── Local state ───────────────────────────────────────────────────────────────
const newStoreId = ref("");
const newDomain = ref("");
const newSock = ref("");
const newClientId = ref("");
const newClientSecret = ref("");
const isGenerating = ref(false);
const isFindingShop = ref(false);
const rotatingIds = ref<Record<string, boolean>>({});
const testingProxies = ref<Record<string, boolean>>({});
const proxyResults = ref<
  Record<
    string,
    { success: boolean; ip?: string; duration?: number; error?: string }
  >
>({});
const genError = ref("");
const genSuccess = ref("");

// ── Search and Sort state ──────────────────────────────────────────────────
const searchQuery = ref("");
const sortOrder = ref("expiry_desc"); // domain_asc, domain_desc, expiry_asc, expiry_desc

// ── Progress steps for findShop ─────────────────────────────────────────────
const findShopSteps = ref([
  { id: "MASTER", label: "Searching master sheet", status: "pending" },
  { id: "MACHINE_FETCH", label: "Fetching credentials", status: "pending" },
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

const { readProxySheetRows, normalizeSpreadsheetId, buildRangeFromSheetName } =
  useSheetService();

// ── Load stores on mount ──────────────────────────────────────────────────────
onMounted(() => {
  formStore.loadKnownStores();
});

// ── Per-store cookie data ─────────────────────────────────────────────────────
interface StoreInfo {
  id: string;
  domain: string;
  hasToken: boolean;
  expired: boolean;
  expiryLabel: string;
}

function getStoreInfo(id: string): StoreInfo {
  const cookie = useCookie<any>(id);
  const data = cookie.value;
  if (!data || typeof data !== "object") {
    return {
      id,
      domain: "",
      hasToken: false,
      expired: false,
      expiryLabel: "",
    };
  }
  const now = Date.now();
  const hasToken = !!data.accessToken;
  const expired = hasToken && !!data.expiresTime && now >= data.expiresTime;
  const diff = data.expiresTime ? data.expiresTime - now : 0;
  let expiryLabel = "";
  if (hasToken && !expired && diff > 0) {
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    expiryLabel = h >= 1 ? `${h}h ${m}m remaining` : `${m}m remaining`;
  }
  return {
    id,
    domain: data.domain || "",
    hasToken,
    expired,
    expiryLabel,
  };
}

const storeList = computed<StoreInfo[]>(() =>
  formStore.knownStores.map(getStoreInfo),
);

const filteredStoreList = computed(() => {
  let list = [...storeList.value];

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase();
    list = list.filter((s) => s.domain.toLowerCase().includes(q));
  }

  list.sort((a, b) => {
    if (sortOrder.value === "domain_asc")
      return a.domain.localeCompare(b.domain);
    if (sortOrder.value === "domain_desc")
      return b.domain.localeCompare(a.domain);

    const cookieA = useCookie<any>(a.id).value || {};
    const cookieB = useCookie<any>(b.id).value || {};
    const timeA = cookieA.expiresTime || 0;
    const timeB = cookieB.expiresTime || 0;

    if (sortOrder.value === "expiry_asc") return timeA - timeB;
    if (sortOrder.value === "expiry_desc") return timeB - timeA;

    return 0;
  });

  return list;
});

// ── Delete store ──────────────────────────────────────────────────────────────
function deleteStore(id: string) {
  formStore.removeKnownStore(id);
}

// ── Edit store ───────────────────────────────────────────────────────────────
const showEditModal = ref(false);
const editingStoreId = ref("");
const editDomain = ref("");
const editSock = ref("");
const editClientId = ref("");
const editClientSecret = ref("");
const editError = ref("");

function openEditModal(id: string) {
  const cookie = useCookie<any>(id);
  const data = cookie.value || {};

  editingStoreId.value = id;
  editDomain.value = data.domain || "";
  editSock.value = data.sock || "";
  editClientId.value = data.clientId || "";
  editClientSecret.value = data.clientSecret || "";
  editError.value = "";
  showEditModal.value = true;
}

function closeEditModal() {
  showEditModal.value = false;
  editingStoreId.value = "";
  editDomain.value = "";
  editSock.value = "";
  editClientId.value = "";
  editClientSecret.value = "";
  editError.value = "";
}

function saveEditedStore() {
  if (!editingStoreId.value) return;

  const id = editingStoreId.value;
  const cookie = useCookie<any>(id, { maxAge: 60 * 60 * 24 * 365 * 10 });
  const previous =
    cookie.value && typeof cookie.value === "object" ? cookie.value : {};

  if (!editClientId.value.trim() || !editClientSecret.value.trim()) {
    editError.value = "Client ID và Client Secret không được để trống.";
    return;
  }

  cookie.value = {
    ...previous,
    domain: editDomain.value.trim(),
    sock: editSock.value.trim(),
    clientId: editClientId.value.trim(),
    clientSecret: editClientSecret.value.trim(),
  };

  genSuccess.value = `Store \"${id}\" updated successfully.`;
  editError.value = "";
  closeEditModal();
}

async function addShop() {
  genError.value = "";
  genSuccess.value = "";
  resetSteps();

  const domain = newDomain.value.trim();
  const sock = newSock.value.trim();
  let sId = newStoreId.value.trim();
  let cId = newClientId.value.trim();
  let cSec = newClientSecret.value.trim();

  isFindingShop.value = true;
  try {
    // 1. Discovery Phase (Only if Domain is provided and credentials are empty)
    if (domain && (!sId || !cId || !cSec)) {
      const domainSearch = domain.toLowerCase();
      const quanLyUrl = QUAN_LY_SHEET_URL;

      setStep("MASTER", "active");
      const presetQuanLy = getProxySheetPreset(quanLyUrl);
      const quanLyRows = await readProxySheetRows({
        spreadsheetId: normalizeSpreadsheetId(quanLyUrl),
        range: buildRangeFromSheetName(""),
        dataRowStart: presetQuanLy?.startRow || 3,
        mapping: presetQuanLy?.columns,
      });

      const foundShop = quanLyRows.find(
        (r) => r.domain.trim().toLowerCase() === domainSearch,
      );

      if (!foundShop) {
        setStep("MASTER", "error");
        throw new Error(`Không tìm thấy shop nào với domain: ${domain}`);
      }
      setStep("MASTER", "done");

      setStep("MACHINE_FETCH", "active");
      const machineNameRaw = foundShop.proxyUrl;
      const targetMachineUrl = machineNameRaw
        ? Object.entries(machineSheets).find(
            ([key]) =>
              machineNameRaw.trim().toUpperCase() === key.toUpperCase(),
          )?.[1]
        : null;

      if (!targetMachineUrl) {
        setStep("MACHINE_FETCH", "error");
        throw new Error(`Không xác định được máy cho shop này.`);
      }

      const machineRows = await readProxySheetRows({
        spreadsheetId: normalizeSpreadsheetId(targetMachineUrl),
        range: buildRangeFromSheetName(""),
        dataRowStart: 2,
      });

      const machineMatch = machineRows.find(
        (r) => r.domain.trim().toLowerCase() === domainSearch,
      );

      if (!machineMatch) {
        setStep("MACHINE_FETCH", "error");
        throw new Error(`Không tìm thấy thông tin trên sheet máy.`);
      }

      if (machineMatch.proxyUrl && !newSock.value.trim())
        newSock.value = machineMatch.proxyUrl.trim();
      if (machineMatch.storeId && !newStoreId.value.trim())
        newStoreId.value = machineMatch.storeId;
      if (machineMatch.clientId && !newClientId.value.trim())
        newClientId.value = machineMatch.clientId;
      if (machineMatch.clientSecret && !newClientSecret.value.trim())
        newClientSecret.value = machineMatch.clientSecret;

      // Update local variables for token gen
      sId = newStoreId.value;
      cId = newClientId.value;
      cSec = newClientSecret.value;
      setStep("MACHINE_FETCH", "done");
    }

    // 1.5 – Check if this store is already configured
    if (sId && formStore.knownStores.includes(sId)) {
      const dom = newDomain.value.trim() || sId;
      genError.value = `"${dom}" is already in the configured stores list (store: ${sId}).`;
      isFindingShop.value = false;
      resetSteps();
      return;
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
        sock: newSock.value.trim(), // Use the updated value
      },
    });

    if (!res?.access_token) {
      setStep("TOKEN_GEN", "error");
      throw new Error("Failed to retrieve access token");
    }
    setStep("TOKEN_GEN", "done");

    // 3. Storage Phase
    setStep("DONE", "active");
    const now = Date.now();
    const expiresTime = now + 24 * 60 * 60 * 1000;
    const cookie = useCookie<any>(sId, { maxAge: 60 * 60 * 24 * 365 * 10 });
    cookie.value = {
      clientId: cId,
      clientSecret: cSec,
      accessToken: res.access_token,
      expiresTime,
      domain: newDomain.value,
      sock: newSock.value,
    };

    formStore.addKnownStore(sId);
    formStore.storeId = sId;

    genSuccess.value = `Shop "${sId}" added successfully!`;
    newStoreId.value = "";
    newClientId.value = "";
    newClientSecret.value = "";
    newDomain.value = "";
    newSock.value = "";
    setStep("DONE", "done");
  } catch (err: any) {
    setStep("TOKEN_GEN", "error");
    genError.value = toUserFriendlyMessage(err);
  } finally {
    isFindingShop.value = false;
  }
}

async function rotateToken(id: string) {
  const storeInfo = getStoreInfo(id);
  const cookie = useCookie<any>(id);
  const data = cookie.value;

  if (!data?.clientId || !data?.clientSecret) {
    alert("Missing client ID or secret for this store. Please re-add it.");
    return;
  }

  rotatingIds.value[id] = true;
  try {
    const res: any = await $fetch("/api/generate-token", {
      method: "POST",
      body: {
        storeId: id,
        clientId: data.clientId,
        clientSecret: data.clientSecret,
        sock: data.sock,
      },
    });

    if (res?.access_token) {
      const now = Date.now();
      const expiresTime = now + 24 * 60 * 60 * 1000;
      cookie.value = {
        ...data,
        accessToken: res.access_token,
        expiresTime,
      };
    } else {
      throw new Error("Failed to rotate token");
    }
  } catch (e: any) {
    alert("Rotate failed: " + toUserFriendlyMessage(e));
  } finally {
    rotatingIds.value[id] = false;
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

async function testProxy(id: string) {
  const cookie = useCookie<any>(id);
  const data = cookie.value;
  if (!data?.sock) {
    alert("No sock/proxy information found for this store.");
    return;
  }

  testingProxies.value[id] = true;
  delete proxyResults.value[id];

  try {
    const res: any = await $fetch("/api/check-proxy", {
      method: "POST",
      body: { proxy: data.sock },
    });
    proxyResults.value[id] = res;
  } catch (err: any) {
    proxyResults.value[id] = {
      success: false,
      error: err.message || "Request failed",
    };
  } finally {
    testingProxies.value[id] = false;
  }
}
</script>

<template>
  <div class="token-page">
    <div class="page-header">
      <h1 class="page-title">Shop Management</h1>
      <p class="page-sub">
        Manage your Shopify store access tokens and credentials
      </p>
    </div>

    <!-- ── Add new store ── -->
    <section class="card">
      <div class="card-head">
        <input
          v-model="newDomain"
          type="text"
          placeholder="Your store domain (e.g., myshop.store)"
          class="inp domain_inp"
        />
        <div class="card-actions">
          <button
            class="btn-primary"
            :disabled="isFindingShop"
            @click="addShop"
          >
            {{ isFindingShop ? "Processing…" : "Add connect" }}
          </button>
        </div>
      </div>
      <div class="add-form">
        <div class="field field-50">
          <label class="field-label">Sock/Proxy</label>
          <input
            v-model="newSock"
            type="text"
            placeholder="IP:Port:User:Pass"
            class="inp"
          />
        </div>
        <div class="field field-50">
          <label class="field-label">Store ID</label>
          <input
            v-model="newStoreId"
            type="text"
            placeholder="e.g. mystore"
            class="inp"
            @paste="handlePaste"
          />
        </div>

        <div class="field field-50">
          <label class="field-label">Client ID</label>
          <input
            v-model="newClientId"
            type="text"
            placeholder="Client ID"
            class="inp"
            @paste="handlePaste"
          />
        </div>
        <div class="field field-50">
          <label class="field-label">Client Secret</label>
          <input
            v-model="newClientSecret"
            type="password"
            placeholder="Client Secret"
            class="inp"
            @paste="handlePaste"
          />
        </div>
      </div>

      <!-- ── Step Progress Indicator ── -->
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
      <div v-if="genError" class="alert alert-err">{{ genError }}</div>
      <div v-if="genSuccess" class="alert alert-ok">{{ genSuccess }}</div>
    </section>

    <!-- ── Store list ── -->
    <section class="card" v-if="storeList.length">
      <div class="card-head">
        <div class="card-head-title">
          <span class="card-title">Configured Stores</span>
          <span class="count-badge">{{ filteredStoreList.length }}</span>
        </div>
        <div class="card-head-actions">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search domain..."
            class="search-inp"
          />
          <BasePopover align="right">
            <template #trigger="{ isOpen }">
              <button class="btn-sort" :class="{ 'is-active': isOpen }">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M3 6h14M3 10h10M3 14h7" />
                </svg>
              </button>
            </template>
            <template #default="{ close }">
              <div class="popover-menu">
                <div
                  class="popover-item"
                  :class="{ active: sortOrder === 'domain_asc' }"
                  @click="
                    sortOrder = 'domain_asc';
                    close();
                  "
                >
                  Domain (A-Z)
                </div>
                <div
                  class="popover-item"
                  :class="{ active: sortOrder === 'domain_desc' }"
                  @click="
                    sortOrder = 'domain_desc';
                    close();
                  "
                >
                  Domain (Z-A)
                </div>
                <div class="popover-divider"></div>
                <div
                  class="popover-item"
                  :class="{ active: sortOrder === 'expiry_asc' }"
                  @click="
                    sortOrder = 'expiry_asc';
                    close();
                  "
                >
                  Expiry (Oldest)
                </div>
                <div
                  class="popover-item"
                  :class="{ active: sortOrder === 'expiry_desc' }"
                  @click="
                    sortOrder = 'expiry_desc';
                    close();
                  "
                >
                  Expiry (Newest)
                </div>
              </div>
            </template>
          </BasePopover>
        </div>
      </div>
      <div class="store-row" v-for="store in filteredStoreList" :key="store.id">
        <div class="store-id">{{ store.domain || "(No domain)" }}</div>
        <div class="store-meta">
          <span v-if="!store.hasToken" class="tag tag-warn">No token</span>
          <span v-else-if="store.expired" class="tag tag-err">Expired</span>
          <span v-else class="tag tag-ok">
            <svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor">
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                clip-rule="evenodd"
              />
            </svg>
            Valid
          </span>
          <span v-if="store.expiryLabel" class="expiry">{{
            store.expiryLabel
          }}</span>

          <!-- proxy check result tooltip-like tag -->
          <span
            v-if="proxyResults[store.id]"
            class="tag"
            :class="proxyResults[store.id]?.success ? 'tag-ok' : 'tag-err'"
          >
            {{
              proxyResults[store.id]?.success
                ? `${proxyResults[store.id]?.ip} (${proxyResults[store.id]?.duration}ms)`
                : "Proxy Fail"
            }}
          </span>
        </div>
        <div class="store-actions">
          <button
            class="btn-outline"
            :disabled="testingProxies[store.id]"
            @click="testProxy(store.id)"
          >
            {{ testingProxies[store.id] ? "Testing…" : "Test Proxy" }}
          </button>
          <button
            class="btn-outline"
            :disabled="rotatingIds[store.id]"
            @click="rotateToken(store.id)"
          >
            {{ rotatingIds[store.id] ? "Rotating…" : "Rotate" }}
          </button>
          <button class="btn-outline" @click="openEditModal(store.id)">
            Edit
          </button>
          <button class="btn-danger" @click="deleteStore(store.id)">
            Delete
          </button>
        </div>
      </div>
    </section>

    <div v-else class="empty-state">
      No stores configured yet. Add one below.
    </div>

    <div
      v-if="showEditModal"
      class="modal-backdrop"
      @click.self="closeEditModal"
    >
      <div class="modal-card">
        <div class="modal-head">
          <h3 class="modal-title">Edit Store</h3>
          <button class="btn-ghost" @click="closeEditModal">✕</button>
        </div>

        <div class="modal-body">
          <div class="field field-full">
            <label class="field-label">Store ID</label>
            <input class="inp" :value="editingStoreId" disabled />
          </div>
          <div class="field field-full">
            <label class="field-label">Domain</label>
            <input
              v-model="editDomain"
              type="text"
              class="inp"
              placeholder="myshop.store"
            />
          </div>
          <div class="field field-full">
            <label class="field-label">Sock (Proxy URL)</label>
            <input
              v-model="editSock"
              type="text"
              class="inp"
              placeholder="IP:Port:User:Pass"
            />
          </div>
          <div class="field field-50">
            <label class="field-label">Client ID</label>
            <input v-model="editClientId" type="text" class="inp" />
          </div>
          <div class="field field-50">
            <label class="field-label">Client Secret</label>
            <input v-model="editClientSecret" type="text" class="inp" />
          </div>
        </div>

        <div v-if="editError" class="alert alert-err modal-alert">
          {{ editError }}
        </div>

        <div class="modal-actions">
          <button class="btn-outline" @click="closeEditModal">Cancel</button>
          <button class="btn-primary" @click="saveEditedStore">Save</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.token-page {
  max-width: 760px;
  margin: 0 auto;
  padding: 28px 20px 48px;
  font-size: 14px;
}
.page-header {
  margin-bottom: 24px;
}
.page-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 4px;
}
.page-sub {
  font-size: 13px;
  color: var(--text-secondary, #6d6d6d);
}
/* Card */
.card {
  background: var(--surface);
  border-radius: var(--radius, 8px);
  box-shadow: var(--shadow);
  margin-bottom: 20px;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 18px;
  border-bottom: 1px solid var(--border);
}
.card-head-title {
  display: flex;
  align-items: center;
  gap: 8px;
}
.card-head-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.card-actions {
  display: flex;
  gap: 8px;
}

.card-title {
  font-weight: 600;
  font-size: 14px;
}
.count-badge {
  background: #e8e8e8;
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 20px;
}
/* Store rows */
.store-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}
.store-row:last-child {
  border-bottom: none;
}
.store-id {
  font-weight: 600;
  font-size: 13px;
  color: var(--text-primary);
  width: fit-content;
}
.store-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  flex-wrap: wrap;
}
.tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 9px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
}
.tag-ok {
  background: #e6f4ea;
  color: #2d7a45;
}
.tag-warn {
  background: #fff3cd;
  color: #856404;
}
.tag-err {
  background: #fce8e8;
  color: #c0392b;
}
.expiry {
  font-size: 12px;
  color: var(--text-secondary, #6d6d6d);
}
.store-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}
.btn-outline {
  padding: 5px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  transition:
    background 0.15s,
    opacity 0.15s;
}
.btn-outline:hover:not(:disabled) {
  background: var(--bg);
}
.btn-outline:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-danger {
  padding: 5px 12px;
  border: 1px solid #fcc;
  border-radius: 6px;
  background: #fff;
  color: var(--red);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s;
}
.btn-danger:hover {
  background: #fce8e8;
}
/* Add form */
.inp {
  width: 100%;
  border: 1px solid var(--border);
  padding: 7px 10px;
  border-radius: 6px;
  font-family: inherit;
  font-size: 13px;
  box-sizing: border-box;
}
.inp:focus {
  outline: 2px solid var(--blue);
  outline-offset: 1px;
}
.domain_inp {
  width: 40%;
}
.search-inp {
  border: 1px solid var(--border);
  padding: 5px 10px;
  border-radius: 6px;
  font-family: inherit;
  font-size: 12px;
  width: 180px;
  background: var(--surface);
  transition: border-color 0.15s;
}
.search-inp:focus {
  outline: none;
  border-color: var(--blue);
}
.btn-sort {
  display: flex;
  align-items: center;
  padding: 5px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-sort:hover,
.btn-sort.is-active {
  background: #f6f6f6;
  border-color: var(--blue);
}
.popover-menu {
  padding: 4px;
}
.popover-item {
  padding: 8px 12px;
  font-size: 13px;
  cursor: pointer;
  border-radius: 4px;
  color: var(--text-primary);
  transition: background 0.1s;
}
.popover-item:hover {
  background: #f4f6f8;
}
.popover-item.active {
  color: var(--blue);
  font-weight: 600;
  background: #f0f7ff;
}
.popover-divider {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
}
.field-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-sub);
  margin-bottom: 4px;
  text-transform: uppercase;
}
.add-form {
  display: grid;
  grid-template-columns: repeat(20, 1fr);
  gap: 12px;
  padding: 16px 18px;
}

.field-50 {
  grid-column: span 10;
}

.field-full {
  grid-column: span 20;
}

/* Steps */
.step-progress {
  margin: 0 18px 18px;
  padding: 12px 16px;
  background: #f8f9fa;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid var(--border);
}
.step-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--text-sub);
  transition: color 0.2s;
}
.step-icon {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
}
.step-item.status-active {
  color: var(--blue);
  font-weight: 500;
}
.step-item.status-done {
  color: #2d7a45;
}
.step-item.status-error {
  color: var(--red);
}

.spinner-sm {
  width: 12px;
  height: 12px;
  border: 2px solid #ddd;
  border-top-color: var(--blue);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.btn-primary {
  height: 30px;
  padding: 0 14px;
  background: var(--text-primary, #1a1a1a);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: opacity 0.15s;
}
.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-primary:hover:not(:disabled) {
  opacity: 0.85;
}
/* Alerts */
.alert {
  margin: 0 18px 14px;
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 13px;
}
.alert-err {
  background: #fce8e8;
  color: var(--red);
}
.alert-ok {
  background: #e6f4ea;
  color: #2d7a45;
}
/* Empty */
.empty-state {
  text-align: center;
  padding: 24px;
  color: var(--text-muted, #9e9e9e);
  font-size: 13px;
  background: var(--surface);
  border-radius: var(--radius, 8px);
  box-shadow: var(--shadow);
  margin-bottom: 20px;
}

/* Modal */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200;
  padding: 16px;
}
.modal-card {
  width: min(640px, 100%);
  background: var(--surface);
  border-radius: 10px;
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.18);
  overflow: hidden;
}
.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}
.modal-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.btn-ghost {
  border: none;
  background: transparent;
  color: var(--text-sub);
  cursor: pointer;
  font-size: 16px;
  padding: 4px 6px;
  border-radius: 6px;
}
.btn-ghost:hover {
  background: var(--bg);
}
.modal-body {
  display: grid;
  grid-template-columns: repeat(20, 1fr);
  gap: 12px;
  padding: 16px;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px 16px;
}
.modal-alert {
  margin: 0 16px;
}
</style>
