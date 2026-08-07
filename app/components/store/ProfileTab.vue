<template>
  <section class="profile-page">
    <ShopEmptyState
      v-if="!formStore.storeId"
      :title="profileEmptyState.title"
      :description="profileEmptyState.description"
    >
      <template #icon>
        <IconsHero v-if="noStores" />
        <IconsCheck v-else />
      </template>
      <template #actions>
        <NuxtLink
          v-if="noStores"
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

    <ShopEmptyState
      v-else-if="profileStore.isLoading && !shop"
      title="Loading profile"
      description="Fetching shop information from Shopify."
      loading
    >
      <template #icon>
        <IconsSync />
      </template>
    </ShopEmptyState>

    <div v-else class="profile-stack">
      <section class="profile-hero">
        <div class="profile-identity">
          <div class="profile-hero-copy">
            <div class="hero-kicker-row">
              <h2>{{ shopTitle }}</h2>
              <span
                class="connection-pill"
                :class="`is-${tokenStatus.toLowerCase()}`"
              >
                <i />
                {{ tokenStatus }} token
              </span>
            </div>
            <div class="profile-actions">
              <a
                v-if="shopUrl"
                class="profile-action primary"
                :href="shopUrl"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open storefront
                <IconsArrowRight />
              </a>
              <button
                class="profile-action"
                type="button"
                @click="openCredentialModal"
              >
                Manage credentials
              </button>
            </div>
          </div>
        </div>

        <div class="profile-metrics">
          <div class="metric-item">
            <span>Currency</span>
            <strong>{{ shop?.currency || "-" }}</strong>
          </div>
          <div class="metric-item">
            <span>Plan</span>
            <strong>{{
              shop?.plan_display_name || shop?.plan_name || "-"
            }}</strong>
          </div>
        </div>

        <section class="finance-summary" aria-label="Store finance summary">
          <article
            v-for="balanceItem in formattedBalances"
            :key="balanceItem.currency"
            class="summary-card is-balance"
          >
            <span>Available balance</span>
            <strong>{{ balanceItem.formatted }}</strong>
            <small>{{ balanceItem.currency }}</small>
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
      </section>

      <div v-if="profileStore.error" class="alert alert-err">
        {{ profileStore.error }}
      </div>

      <div class="profile-detail-grid">
        <ProfileFieldGrid
          title="Access & security"
          :icon="KeyRound"
          :rows="connectionRows"
        >
          <template #actions>
            <button
              v-if="formStore.storeId"
              class="profile-card-action"
              type="button"
              @click="openCredentialModal"
            >
              <Pencil aria-hidden="true" />
              Edit credentials
            </button>
          </template>
        </ProfileFieldGrid>
        <ProfileFieldGrid
          title="Shop information"
          :icon="Store"
          :rows="shopRows"
        />
      </div>
      <div
        v-if="showCredentialModal"
        class="credential-modal-backdrop"
        @click.self="closeCredentialModal"
      >
        <div
          class="credential-modal-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="credential-modal-title"
        >
          <div class="credential-modal-head">
            <div class="credential-modal-title-block">
              <h3 id="credential-modal-title">Edit credentials</h3>
            </div>
            <button
              class="credential-close"
              type="button"
              title="Close"
              aria-label="Close"
              @click="closeCredentialModal"
            >
              <X aria-hidden="true" />
            </button>
          </div>

          <div class="credential-modal-body">
            <div class="credential-form">
              <div class="credential-field is-half">
                <label>Domain</label>
                <input
                  v-model="editDomain"
                  class="credential-input"
                  type="text"
                  placeholder="myshop.store"
                />
              </div>
              <div class="credential-field is-half">
                <label>Sock/Proxy</label>
                <input
                  v-model="editSock"
                  class="credential-input"
                  type="text"
                  placeholder="IP:Port:User:Pass"
                />
              </div>
              <div class="credential-field is-third">
                <label>Store ID</label>
                <input
                  class="credential-input"
                  :value="formStore.storeId"
                  type="text"
                  disabled
                />
              </div>
              <div class="credential-field is-third">
                <label>Client ID</label>
                <input
                  v-model="editClientId"
                  class="credential-input"
                  type="text"
                  placeholder="Client ID"
                />
              </div>
              <div class="credential-field is-third">
                <label>Client Secret</label>
                <input
                  v-model="editClientSecret"
                  class="credential-input"
                  type="text"
                  placeholder="Client Secret"
                />
              </div>
            </div>

            <div
              v-if="editError"
              class="alert alert-err credential-modal-alert"
            >
              {{ editError }}
            </div>
          </div>

          <div class="credential-modal-actions">
            <button
              class="profile-action"
              type="button"
              @click="closeCredentialModal"
            >
              Cancel
            </button>
            <button
              class="profile-action primary"
              type="button"
              @click="saveCredentialEdits"
            >
              <IconsCheck />
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { KeyRound, Pencil, Store, X } from "@lucide/vue";
import { computed, ref } from "vue";
import { useCredentialVaultStore } from "~/stores/credentialVault";
import { useFormStore } from "~/stores/form";
import { useOrderStore } from "~/stores/order";
import { usePaymentStore } from "~/stores/payment";
import { useShopProfileStore } from "~/stores/shopProfile";
import type { StoreLocalData } from "~~/types/shopify";
import {
  buildShopProfileRows,
  formatProfileTimestamp,
  type ProfileFieldRow,
} from "~~/utils/shop-profile";

const formStore = useFormStore();
const credentialVault = useCredentialVaultStore();
const profileStore = useShopProfileStore();
const paymentStore = usePaymentStore();
const orderStore = useOrderStore();

const shop = computed(() => profileStore.shop);
const noStores = computed(() => formStore.knownStores.length === 0);
const profileEmptyState = computed(() => {
  if (noStores.value) {
    return {
      title: "No stores connected yet",
      description:
        "Connect a Shopify store first, then its profile details will appear here.",
    };
  }

  return {
    title: "Select a shop",
    description: "Choose a store from the sidebar to view its profile details.",
  };
});

const currentStoreData = computed<StoreLocalData>(() => {
  if (!formStore.storeId) return {};

  return credentialVault.getStoreData(formStore.storeId);
});

const tokenStatus = computed(() => {
  const data = currentStoreData.value;
  if (!data.accessToken) return "Missing";
  if (data.expiresTime && Date.now() >= data.expiresTime) return "Expired";
  return "Valid";
});

const balances = computed(() => {
  const balance = paymentStore.balance;
  if (!balance) return [];
  return Array.isArray(balance) ? balance : [balance];
});

const transactionsCount = computed(
  () => paymentStore.balanceTransactions.length,
);
const payoutsCount = computed(() => paymentStore.payouts.length);
const ordersCount = computed(() => orderStore.orders.length);
const formattedBalances = computed(() => {
  if (!balances.value.length) {
    return [
      {
        currency: "Store currency",
        formatted: "—",
      },
    ];
  }

  return balances.value.map((balanceItem) => {
    const amount = Number(balanceItem.amount || 0);
    try {
      return {
        currency: balanceItem.currency,
        formatted: new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: balanceItem.currency,
        }).format(amount),
      };
    } catch {
      return {
        currency: balanceItem.currency,
        formatted: `${amount.toFixed(2)} ${balanceItem.currency}`,
      };
    }
  });
});
const showCredentialModal = ref(false);
const editDomain = ref("");
const editSock = ref("");
const editClientId = ref("");
const editClientSecret = ref("");
const editError = ref("");

function openCredentialModal() {
  if (!formStore.storeId) return;

  const data = credentialVault.getStoreData(formStore.storeId);
  editDomain.value = data.domain || "";
  editSock.value = data.sock || "";
  editClientId.value = data.clientId || "";
  editClientSecret.value = data.clientSecret || "";
  editError.value = "";
  showCredentialModal.value = true;
}

function closeCredentialModal() {
  showCredentialModal.value = false;
  editError.value = "";
}

async function saveCredentialEdits() {
  const storeId = formStore.storeId;
  if (!storeId) return;

  if (!editClientId.value.trim() || !editClientSecret.value.trim()) {
    editError.value = "Client ID and Client Secret cannot be empty.";
    return;
  }

  const previous = credentialVault.getStoreData(storeId);

  try {
    await credentialVault.saveStoreData(storeId, {
      ...previous,
      domain: editDomain.value.trim(),
      sock: editSock.value.trim(),
      clientId: editClientId.value.trim(),
      clientSecret: editClientSecret.value.trim(),
    });
    closeCredentialModal();
  } catch (error) {
    editError.value =
      error instanceof Error ? error.message : "Unable to save credentials.";
  }
}
const shopTitle = computed(() => {
  return (
    shop.value?.name ||
    currentStoreData.value.domain ||
    formStore.storeId ||
    "Shop"
  );
});

const shopDomain = computed(() => {
  return (
    shop.value?.domain ||
    shop.value?.myshopify_domain ||
    currentStoreData.value.domain ||
    formStore.storeId ||
    "-"
  );
});

const shopInitials = computed(() => {
  const words = shopTitle.value.trim().split(/\s+/).filter(Boolean);
  return (
    words
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join("") || "SP"
  );
});

const shopUrl = computed(() => {
  const domain = shopDomain.value;
  if (!domain || domain === "-") return "";
  return /^https?:\/\//i.test(domain) ? domain : `https://${domain}`;
});

const connectionRows = computed<ProfileFieldRow[]>(() => [
  {
    key: "storeId",
    label: "Store ID",
    value: formStore.storeId || "-",
  },
  {
    key: "domain",
    label: "Configured domain",
    value: currentStoreData.value.domain || "-",
  },
  {
    key: "tokenStatus",
    label: "Token status",
    value: `${tokenStatus.value} - ${formatProfileTimestamp(currentStoreData.value.expiresTime)}`,
  },
  {
    key: "clientId",
    label: "Client ID",
    // value: maskSensitiveValue(currentStoreData.value.clientId),
    value: currentStoreData.value.clientId || "-",
  },
  {
    key: "clientSecret",
    label: "Client secret",
    // value: maskSensitiveValue(currentStoreData.value.clientSecret),
    value: currentStoreData.value.clientSecret || "-",
  },
  {
    key: "proxy",
    label: "Proxy",
    // value: maskSensitiveValue(currentStoreData.value.sock, 6),
    value: currentStoreData.value.sock || "-",
  },
]);

const shopRows = computed(() => buildShopProfileRows(shop.value));
</script>

<style scoped>
.profile-page {
  width: 100%;
  padding-bottom: 32px;
}

.profile-stack {
  display: grid;
  gap: 16px;
}

.profile-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 18px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background:
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--green-soft) 74%, var(--surface)),
      color-mix(in srgb, var(--blue-soft) 78%, var(--surface))
    ),
    var(--surface);
  padding: 22px;
  box-shadow: var(--shadow-soft);
  overflow: hidden;
  position: relative;
}

.profile-identity {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.profile-hero-copy {
  min-width: 0;
  display: grid;
  gap: 5px;
}
.hero-kicker-row {
  display: flex;
  align-items: center;
  gap: 9px;
  flex-wrap: wrap;
}

.connection-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface-raised) 82%, transparent);
  color: var(--text-sub);
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
}

.connection-pill i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.connection-pill.is-valid {
  color: var(--green);
}

.connection-pill.is-expired,
.connection-pill.is-missing {
  color: var(--red);
}

.profile-hero h1 {
  margin: 0;
  color: var(--text-primary);
  font-size: clamp(1.45rem, 4vw, 2.25rem);
  line-height: 1.1;
  overflow-wrap: anywhere;
}

.profile-hero p {
  margin: 0;
  color: var(--text-sub);
  font-size: 13px;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.profile-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.profile-action {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 11px;
  border: 1px solid color-mix(in srgb, var(--green) 4%, var(--border));
  border-radius: 8px;
  background: color-mix(in srgb, var(--surface-raised) 84%, transparent);
  color: var(--green);
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
  font-weight: 800;
  text-decoration: none;
}

.profile-action.primary {
  border-color: var(--green);
  background: var(--green);
  color: var(--bg);
  min-height: 32px;
}

.profile-action svg {
  width: 13px;
  height: 13px;
}

.profile-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(96px, 1fr));
  gap: 10px;
}

.finance-summary {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: 1.45fr repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 2px;
}

.summary-card {
  min-width: 0;
  display: grid;
  gap: 3px;
  padding: 14px;
  border: 1px solid color-mix(in srgb, var(--green) 10%, var(--border));
  border-radius: 8px;
  background: color-mix(in srgb, var(--surface-raised) 88%, transparent);
  box-shadow: var(--shadow-soft);
}

.summary-card.is-balance {
  border-color: color-mix(in srgb, var(--green) 28%, var(--border));
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--green-soft) 82%, var(--surface-raised)),
    var(--surface-raised)
  );
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
  font-size: clamp(1.18rem, 2.4vw, 1.55rem);
  line-height: 1.2;
}

.metric-item {
  display: grid;
  gap: 2px;
  min-width: 0;
  border: 1px solid color-mix(in srgb, var(--green) 18%, var(--border));
  border-radius: 8px;
  background: color-mix(in srgb, var(--surface-raised) 86%, transparent);
  padding: 8px 14px;
  backdrop-filter: blur(8px);
}

.profile-detail-grid {
  display: grid;
  grid-row: 2;
  gap: 16px;
  align-items: start;
}

.profile-detail-column {
  min-width: 0;
  display: grid;
  gap: 8px;
}

.metric-item span {
  color: var(--text-sub);
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
}

.metric-item strong {
  color: var(--text-primary);
  font-size: 18px;
  overflow-wrap: anywhere;
}

.profile-card-action {
  min-height: 28px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 9px;
  border: 1px solid color-mix(in srgb, var(--green) 26%, var(--border));
  border-radius: 6px;
  background: var(--surface-raised);
  color: var(--green);
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}

.profile-card-action:hover {
  background: var(--green-soft);
}

.profile-card-action :deep(svg) {
  width: 13px;
  height: 13px;
  flex: 0 0 13px;
}

.alert {
  border-radius: 8px;
  padding: 11px 13px;
  font-size: 13px;
  font-weight: 600;
}

.alert-err {
  background: var(--red-soft);
  color: var(--red);
}

.credential-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2600;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(20, 34, 27, 0.46);
  backdrop-filter: blur(3px);
}

.credential-modal-card {
  width: min(760px, 100%);
  max-height: calc(100vh - 40px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  box-shadow: var(--shadow);
}

.credential-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
}

.credential-modal-title-block {
  min-width: 0;
}

.credential-modal-title-block h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 800;
}

.credential-modal-title-block p {
  margin: 1px 0 0;
  color: var(--text-sub);
  font-size: 12px;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.credential-close {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  display: inline-grid;
  place-items: center;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--surface-raised);
  color: var(--text-sub);
  cursor: pointer;
}

.credential-close:hover {
  background: var(--surface-soft);
  color: var(--text-primary);
}

.credential-close svg {
  width: 15px;
  height: 15px;
}

.credential-modal-body {
  overflow-y: auto;
}

.credential-form {
  display: grid;
  grid-template-columns: repeat(60, 1fr);
  gap: 12px;
  padding: 16px 18px;
}

.credential-field {
  min-width: 0;
}

.credential-field.is-half {
  grid-column: span 30;
}

.credential-field.is-third {
  grid-column: span 20;
}

.credential-field label {
  display: block;
  margin-bottom: 4px;
  color: var(--text-sub);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
}

.credential-input {
  width: 100%;
  min-height: 38px;
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--surface);
  color: var(--text-primary);
  font: inherit;
  font-size: 13px;
}

.credential-input:focus {
  border-color: color-mix(in srgb, var(--green) 45%, var(--border));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--green-soft) 68%, transparent);
}

.credential-input:disabled {
  background: var(--surface-soft);
  color: var(--text-sub);
  cursor: not-allowed;
}

.credential-modal-alert {
  margin: 0 18px 16px;
  white-space: pre-wrap;
}

.credential-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 18px;
  border-top: 1px solid var(--border);
  background: var(--surface-low);
}

.credential-modal-actions .profile-action {
  min-height: 32px;
}
@media (max-width: 900px) {
  .profile-hero {
    grid-template-columns: 1fr;
  }

  .profile-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .finance-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .profile-detail-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .profile-metrics,
  .finance-summary {
    grid-template-columns: 1fr;
  }

  .profile-identity {
    flex-direction: column;
  }

  .profile-hero {
    padding: 20px;
  }

  .profile-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .profile-action {
    justify-content: center;
  }
}

@media (max-width: 640px) {
  .credential-modal-backdrop {
    padding: 12px;
  }

  .credential-form {
    grid-template-columns: 1fr;
  }

  .credential-field.is-half,
  .credential-field.is-third {
    grid-column: auto;
  }

  .credential-modal-actions {
    flex-direction: column-reverse;
  }
}
</style>
