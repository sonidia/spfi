<script lang="ts" setup>
import { useFormStore } from "../stores/form";

definePageMeta({ layout: false }); // uses default layout (no shop bar)

const formStore = useFormStore();

// ── Local state ───────────────────────────────────────────────────────────────
const newStoreId = ref("");
const newClientId = ref("");
const newClientSecret = ref("");
const isGenerating = ref(false);
const rotatingIds = ref<Record<string, boolean>>({});
const genError = ref("");
const genSuccess = ref("");

// ── Load stores on mount ──────────────────────────────────────────────────────
onMounted(() => {
  formStore.loadKnownStores();
});

// ── Per-store cookie data ─────────────────────────────────────────────────────
interface StoreInfo {
  id: string;
  hasToken: boolean;
  expired: boolean;
  expiryLabel: string;
  clientId: string;
}

function getStoreInfo(id: string): StoreInfo {
  const cookie = useCookie<any>(id);
  const data = cookie.value;
  if (!data || typeof data !== "object") {
    return {
      id,
      hasToken: false,
      expired: false,
      expiryLabel: "",
      clientId: "",
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
    hasToken,
    expired,
    expiryLabel,
    clientId: data.clientId || "",
  };
}

const storeList = computed<StoreInfo[]>(() =>
  formStore.knownStores.map(getStoreInfo),
);

// ── Delete store ──────────────────────────────────────────────────────────────
function deleteStore(id: string) {
  formStore.removeKnownStore(id);
}

async function generateToken() {
  genError.value = "";
  genSuccess.value = "";
  if (!newStoreId.value || !newClientId.value || !newClientSecret.value) {
    genError.value = "Please fill in all three fields.";
    return;
  }
  isGenerating.value = true;
  try {
    const res: any = await $fetch("/api/generate-token", {
      method: "POST",
      body: {
        storeId: newStoreId.value,
        clientId: newClientId.value,
        clientSecret: newClientSecret.value,
      },
    });

    if (res?.access_token) {
      const now = Date.now();
      const expiresTime = now + 24 * 60 * 60 * 1000;
      const cookie = useCookie<any>(newStoreId.value, {
        maxAge: 60 * 60 * 24 * 365 * 10,
      });
      cookie.value = {
        clientId: newClientId.value,
        clientSecret: newClientSecret.value,
        accessToken: res.access_token,
        expiresTime,
      };

      formStore.addKnownStore(newStoreId.value);
      formStore.storeId = newStoreId.value;

      genSuccess.value = `Token generated for "${newStoreId.value}". Valid for 24 hours.`;
      newStoreId.value = "";
      newClientId.value = "";
      newClientSecret.value = "";
    } else {
      throw new Error("Failed to retrieve access token");
    }
  } catch (err: any) {
    genError.value =
      err?.data?.statusMessage || err.message || "Token generation failed.";
  } finally {
    isGenerating.value = false;
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
      
      // Update storeId to trigger UI refresh implicitly or re-apply 
      // (Since it uses useCookie it's reactive)
    } else {
      throw new Error("Failed to rotate token");
    }
  } catch (e: any) {
    alert("Rotate failed: " + (e?.data?.statusMessage || e.message || ""));
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
</script>

<template>
  <div class="token-page">
    <div class="page-header">
      <h1 class="page-title">Token Management</h1>
      <p class="page-sub">Manage your Shopify store access tokens</p>
    </div>

    <!-- ── Add new store ── -->
    <section class="card">
      <div class="card-head">
        <span class="card-title">Add Store</span>
      </div>
      <div class="add-form">
        <div class="field">
          <input
            v-model="newStoreId"
            type="text"
            placeholder="e.g. mystore"
            class="inp"
            @paste="handlePaste"
          />
        </div>
        <div class="field field-wide">
          <input
            v-model="newClientId"
            type="text"
            placeholder="Client ID"
            class="inp"
            @paste="handlePaste"
          />
        </div>
        <div class="field field-wide">
          <input
            v-model="newClientSecret"
            type="password"
            placeholder="Client Secret"
            class="inp"
            @paste="handlePaste"
          />
        </div>
        <button
          class="btn-primary"
          :disabled="isGenerating"
          @click="generateToken"
        >
          {{ isGenerating ? "Generating…" : "Generate Token" }}
        </button>
      </div>
      <div v-if="genError" class="alert alert-err">{{ genError }}</div>
      <div v-if="genSuccess" class="alert alert-ok">{{ genSuccess }}</div>
    </section>

    <!-- ── Store list ── -->
    <section class="card" v-if="storeList.length">
      <div class="card-head">
        <span class="card-title">Configured Stores</span>
        <span class="count-badge">{{ storeList.length }}</span>
      </div>
      <div class="store-row" v-for="store in storeList" :key="store.id">
        <div class="store-id">{{ store.id }}</div>
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
          <span v-if="store.clientId" class="client-id">{{
            store.clientId
          }}</span>
        </div>
        <div class="store-actions">
          <button 
            class="btn-outline" 
            :disabled="rotatingIds[store.id]"
            @click="rotateToken(store.id)"
          >
            {{ rotatingIds[store.id] ? "Rotating…" : "Rotate" }}
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
  overflow: hidden;
}
.card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
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
.client-id {
  font-size: 11px;
  color: var(--text-muted, #9e9e9e);
  font-family: monospace;
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
  transition: background 0.15s, opacity 0.15s;
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
.add-form {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  padding: 16px 18px;
  flex-wrap: wrap;
}
.field {
  flex: 1;
  min-width: 120px;
}
.field-wide {
  flex: 2;
  min-width: 160px;
}
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
.btn-primary {
  height: 32px;
  padding: 0 16px;
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
</style>
