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
            <div class="profile-avatar" aria-hidden="true">
              {{ shopInitials }}
            </div>
            <div class="profile-hero-copy">
              <div class="hero-kicker-row">
                <span class="hero-kicker">Shop profile</span>
                <span
                  class="connection-pill"
                  :class="`is-${tokenStatus.toLowerCase()}`"
                >
                  <i />
                  {{ tokenStatus }} token
                </span>
              </div>
              <h1>{{ shopTitle }}</h1>
              <p>{{ shopDomain }}</p>
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
                <NuxtLink class="profile-action" to="/manager">
                  Manage credentials
                </NuxtLink>
              </div>
            </div>
          </div>

          <div class="profile-metrics">
            <div class="metric-item">
              <span>Products</span>
              <strong>{{ products.length }}</strong>
            </div>
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
        </section>

        <div v-if="profileStore.error" class="alert alert-err">
          {{ profileStore.error }}
        </div>

        <div class="profile-detail-grid">
          <div class="profile-detail-column">
            <div class="section-label">
              <span>Connection</span>
              <small>AES-GCM protected locally</small>
            </div>
            <ProfileFieldGrid title="Access & security" :rows="connectionRows" />
          </div>
          <div class="profile-detail-column">
            <div class="section-label">
              <span>Store details</span>
              <small>Synced from Shopify</small>
            </div>
            <ProfileFieldGrid title="Shop information" :rows="shopRows" />
          </div>
        </div>
        <ProfileProductsTable
          :products="products"
          :loading="productStore.isLoading"
          :error="productStore.error"
        />
      </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useCredentialVaultStore } from "~/stores/credentialVault";
import { useFormStore } from "~/stores/form";
import { useProductStore } from "~/stores/product";
import { useShopProfileStore } from "~/stores/shopProfile";
import type { StoreLocalData } from "~~/types/shopify";
import {
  buildShopProfileRows,
  formatProfileTimestamp,
  maskSensitiveValue,
  type ProfileFieldRow,
} from "~~/utils/shop-profile";

const formStore = useFormStore();
const credentialVault = useCredentialVaultStore();
const productStore = useProductStore();
const profileStore = useShopProfileStore();

const shop = computed(() => profileStore.shop);
const products = computed(() => productStore.products);
const noStores = computed(() => formStore.knownStores.length === 0);
const profileEmptyState = computed(() => {
  if (noStores.value) {
    return {
      title: "No stores connected yet",
      description:
        "Connect a Shopify store first, then its profile and products will appear here.",
    };
  }

  return {
    title: "Select a shop",
    description:
      "Choose a store from the sidebar to view its profile and products.",
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
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("") || "SP";
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
    value: tokenStatus.value,
  },
  {
    key: "tokenExpires",
    label: "Token expires",
    value: formatProfileTimestamp(currentStoreData.value.expiresTime),
  },
  {
    key: "clientId",
    label: "Client ID",
    value: maskSensitiveValue(currentStoreData.value.clientId),
  },
  {
    key: "clientSecret",
    label: "Client secret",
    value: maskSensitiveValue(currentStoreData.value.clientSecret),
  },
  {
    key: "proxy",
    label: "Proxy",
    value: maskSensitiveValue(currentStoreData.value.sock, 6),
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
  align-items: center;
  gap: 18px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background:
    linear-gradient(
      135deg,
      rgba(223, 244, 232, 0.74),
      rgba(226, 238, 249, 0.78)
    ),
    var(--surface);
  padding: 26px;
  box-shadow: 0 18px 50px rgba(20, 34, 27, 0.08);
  overflow: hidden;
  position: relative;
}

.profile-hero::after {
  content: "";
  position: absolute;
  width: 180px;
  height: 180px;
  right: -72px;
  top: -94px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.44);
}

.profile-identity {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.profile-avatar {
  width: 58px;
  height: 58px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.76);
  border-radius: 17px;
  background: linear-gradient(145deg, #1f7a4d, #275c91);
  color: white;
  font-size: 17px;
  font-weight: 900;
  letter-spacing: 0.04em;
  box-shadow: 0 10px 24px rgba(31, 122, 77, 0.2);
}

.profile-hero-copy {
  min-width: 0;
  display: grid;
  gap: 5px;
}

.hero-kicker {
  color: var(--green);
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
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
  background: rgba(255, 255, 255, 0.72);
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
  border: 1px solid rgba(31, 122, 77, 0.2);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.7);
  color: var(--green);
  font-size: 12px;
  font-weight: 800;
}

.profile-action.primary {
  border-color: var(--green);
  background: var(--green);
  color: white;
}

.profile-action svg {
  width: 13px;
  height: 13px;
}

.profile-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(96px, 1fr));
  gap: 10px;
}

.metric-item {
  display: grid;
  gap: 2px;
  min-width: 0;
  border: 1px solid rgba(31, 122, 77, 0.14);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.74);
  padding: 12px 14px;
  backdrop-filter: blur(8px);
}

.profile-detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: 16px;
  align-items: start;
}

.profile-detail-column {
  min-width: 0;
  display: grid;
  gap: 8px;
}

.section-label {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 0 2px;
}

.section-label span {
  color: var(--text);
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.section-label small {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 700;
}

.metric-item span {
  color: var(--text-sub);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
}

.metric-item strong {
  color: var(--text-primary);
  font-size: 18px;
  overflow-wrap: anywhere;
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

@media (max-width: 900px) {
  .profile-hero {
    grid-template-columns: 1fr;
  }

  .profile-metrics {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .profile-detail-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .profile-metrics {
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

  .section-label {
    align-items: flex-start;
    flex-direction: column;
    gap: 2px;
  }
}
</style>
