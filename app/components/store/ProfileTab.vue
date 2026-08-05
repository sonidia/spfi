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
              <NuxtLink class="profile-action" to="/manager">
                Manage credentials
              </NuxtLink>
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
      </section>

      <div v-if="profileStore.error" class="alert alert-err">
        {{ profileStore.error }}
      </div>

      <div class="profile-detail-grid">
        <ProfileFieldGrid title="Access & security" :rows="connectionRows" />
        <ProfileFieldGrid title="Shop information" :rows="shopRows" />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useCredentialVaultStore } from "~/stores/credentialVault";
import { useFormStore } from "~/stores/form";
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
  font-size: 12px;
  font-weight: 800;
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
}
</style>
