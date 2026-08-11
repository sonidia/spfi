import { defineStore } from "pinia";
import { ref } from "vue";
import { usePerStoreCache } from "~/composables/usePerStoreCache";
import type { ShopifyShop, ShopProfileResponse } from "~~/types/shopify";
import { getAppErrorMessage } from "~~/utils/error";

interface ShopProfileCache {
  shop: ShopifyShop | null;
  hasFetchedProfile: boolean;
}

export const useShopProfileStore = defineStore("shopProfile", () => {
  const shop = ref<ShopifyShop | null>(null);
  const hasFetchedProfile = ref(false);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  let requestSequence = 0;
  const storeCache = usePerStoreCache<ShopProfileCache>({
    capture: () => ({
      shop: shop.value ? { ...shop.value } : null,
      hasFetchedProfile: hasFetchedProfile.value,
    }),
    restore: (cached) => {
      shop.value = cached.shop ? { ...cached.shop } : null;
      hasFetchedProfile.value = cached.hasFetchedProfile;
      error.value = null;
    },
    reset: resetState,
    onStoreChange: () => {
      requestSequence += 1;
    },
  });
  const activateStore = storeCache.activate;
  const hydrate = storeCache.hydrate;
  const evictStore = storeCache.evict;

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
      storeCache.set(storeId, {
        shop: nextShop ? { ...nextShop } : null,
        hasFetchedProfile: true,
      });
      if (requestId === requestSequence && storeCache.isActive(storeId)) {
        shop.value = nextShop;
        hasFetchedProfile.value = true;
      }
    } catch (err) {
      if (requestId === requestSequence && storeCache.isActive(storeId)) {
        error.value = getAppErrorMessage(err, "Failed to fetch shop profile.");
      }
    } finally {
      if (requestId === requestSequence && storeCache.isActive(storeId)) {
        isLoading.value = false;
      }
    }
  }

  function $reset() {
    requestSequence += 1;
    resetState();
  }

  function resetState() {
    shop.value = null;
    hasFetchedProfile.value = false;
    error.value = null;
    isLoading.value = false;
  }

  return {
    shop,
    hasFetchedProfile,
    isLoading,
    error,
    isStoreActive: storeCache.isActive,
    fetchProfile,
    hydrate,
    evictStore,
    $reset,
  };
});
