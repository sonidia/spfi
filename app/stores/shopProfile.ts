import { defineStore } from "pinia";
import { ref } from "vue";
import type { ShopifyShop, ShopProfileResponse } from "~~/types/shopify";
import { getAppErrorMessage } from "~~/utils/error";

export const useShopProfileStore = defineStore("shopProfile", () => {
  const shop = ref<ShopifyShop | null>(null);
  const hasFetchedProfile = ref(false);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const activeStoreId = ref("");
  let requestSequence = 0;
  const storeCache = ref<
    Record<string, { shop: ShopifyShop | null; hasFetchedProfile: boolean }>
  >({});

  async function fetchProfile(storeId: string, token: string) {
    if (!storeId || !token) {
      error.value = "Store ID and Access Token are required.";
      return;
    }

    activateStore(storeId);
    isLoading.value = true;
    error.value = null;
    const requestId = ++requestSequence;

    try {
      const response = await $fetch<ShopProfileResponse>("/api/shop/profile", {
        method: "POST",
        body: { storeId, token },
      });

      const nextShop = response.shop ?? null;
      storeCache.value[storeId] = {
        shop: nextShop ? { ...nextShop } : null,
        hasFetchedProfile: true,
      };
      if (
        requestId === requestSequence &&
        activeStoreId.value === storeId
      ) {
        shop.value = nextShop;
        hasFetchedProfile.value = true;
      }
    } catch (err) {
      if (
        requestId === requestSequence &&
        activeStoreId.value === storeId
      ) {
        error.value = getAppErrorMessage(err, "Failed to fetch shop profile.");
      }
    } finally {
      if (
        requestId === requestSequence &&
        activeStoreId.value === storeId
      ) {
        isLoading.value = false;
      }
    }
  }

  function activateStore(storeId: string) {
    if (activeStoreId.value !== storeId) hydrate(storeId);
  }

  function hydrate(storeId: string): boolean {
    activeStoreId.value = storeId;
    requestSequence += 1;
    const cached = storeCache.value[storeId];
    if (!cached) {
      $reset();
      return false;
    }

    shop.value = cached.shop ? { ...cached.shop } : null;
    hasFetchedProfile.value = cached.hasFetchedProfile;
    error.value = null;
    return true;
  }

  function $reset() {
    requestSequence += 1;
    shop.value = null;
    hasFetchedProfile.value = false;
    error.value = null;
    isLoading.value = false;
  }

  function evictStore(storeId: string) {
    delete storeCache.value[storeId];
    if (activeStoreId.value === storeId) $reset();
  }

  return {
    shop,
    hasFetchedProfile,
    isLoading,
    error,
    activeStoreId,
    fetchProfile,
    hydrate,
    evictStore,
    $reset,
  };
});
