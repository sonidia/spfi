<template>
  <NuxtLayout name="shop">
    <template #title>
      <span class="page-title">Profile</span>
    </template>

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
          <div class="profile-hero-copy">
            <span class="hero-kicker">Shop profile</span>
            <h1>{{ shopTitle }}</h1>
            <p>{{ shopDomain }}</p>
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

        <ProfileFieldGrid title="Connection" :rows="connectionRows" />
        <ProfileFieldGrid title="Shop Information" :rows="shopRows" />
        <ProfileProductsTable
          :products="products"
          :loading="productStore.isLoading"
          :error="productStore.error"
        />
      </div>
    </section>
  </NuxtLayout>
</template>

<script setup lang="ts">
import {
  computed,
  onActivated,
  onDeactivated,
  onMounted,
  ref,
  watch,
} from "vue";
import { useFormStore } from "~/stores/form";
import { useProductStore } from "~/stores/product";
import { useShopProfileStore } from "~/stores/shopProfile";
import {
  buildShopProfileRows,
  formatProfileTimestamp,
  maskSensitiveValue,
  type ProfileFieldRow,
} from "~~/utils/shop-profile";

definePageMeta({ layout: false });

const formStore = useFormStore();
const productStore = useProductStore();
const profileStore = useShopProfileStore();
const isPageActive = ref(true);
const hasSkippedInitialActivation = ref(false);

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

const currentStoreData = computed<Record<string, any>>(() => {
  if (!formStore.storeId) return {};

  return useLocalStorage<any>(formStore.storeId, {}).state.value || {};
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

onMounted(() => {
  loadProfileData();
});

onActivated(() => {
  isPageActive.value = true;

  if (!hasSkippedInitialActivation.value) {
    hasSkippedInitialActivation.value = true;
    return;
  }

  loadProfileData();
});

onDeactivated(() => {
  isPageActive.value = false;
});

watch(
  () => formStore.storeId,
  () => {
    if (!isPageActive.value) return;

    loadProfileData();
  },
);

async function loadProfileData(force = false) {
  const storeId = formStore.storeId;
  if (!storeId) return;

  const token = resolveToken(storeId);
  if (!token) {
    profileStore.error = "Token expired or missing. Please go to Token page.";
    return;
  }

  const requests: Promise<any>[] = [];

  if (force || (!profileStore.hasFetchedProfile && !profileStore.isLoading)) {
    requests.push(profileStore.fetchProfile(storeId, token));
  }

  if (force || (!productStore.hasFetchedAll && !productStore.isLoading)) {
    requests.push(productStore.fetchAll(storeId, token));
  }

  await Promise.all(requests);
}

function resolveToken(storeId: string): string | null {
  const data = useLocalStorage<any>(storeId, {}).state.value;
  const now = Date.now();

  if (data?.accessToken && data?.expiresTime && now < data.expiresTime) {
    return data.accessToken;
  }

  return null;
}
</script>

<style scoped>
.profile-page {
  width: 100%;
  padding-bottom: 32px;
}

.page-title {
  color: var(--text);
  font-size: 1.2rem;
  font-weight: 600;
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
  border-radius: var(--radius);
  background:
    linear-gradient(
      135deg,
      rgba(223, 244, 232, 0.74),
      rgba(226, 238, 249, 0.78)
    ),
    var(--surface);
  padding: 22px;
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
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.74);
  padding: 10px 12px;
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
}

@media (max-width: 640px) {
  .profile-metrics {
    grid-template-columns: 1fr;
  }
}
</style>
