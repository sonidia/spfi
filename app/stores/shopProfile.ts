import { defineStore } from "pinia";
import { ref } from "vue";
import type { ShopifyShop, ShopProfileResponse } from "~~/types/shopify";
import { getAppErrorMessage } from "~~/utils/error";

export const useShopProfileStore = defineStore("shopProfile", () => {
  const shop = ref<ShopifyShop | null>(null);
  const hasFetchedProfile = ref(false);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const storeCache = ref<
    Record<string, { shop: ShopifyShop | null; hasFetchedProfile: boolean }>
  >({});

  async function fetchProfile(storeId: string, token: string) {
    if (!storeId || !token) {
      error.value = "Store ID and Access Token are required.";
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const response = await $fetch<ShopProfileResponse>("/api/shop/profile", {
        method: "POST",
        body: { storeId, token },
      });

      shop.value = response.shop ?? null;
      hasFetchedProfile.value = true;
      storeCache.value[storeId] = {
        shop: shop.value ? { ...shop.value } : null,
        hasFetchedProfile: hasFetchedProfile.value,
      };
    } catch (err) {
      error.value = getAppErrorMessage(err, "Failed to fetch shop profile.");
    } finally {
      isLoading.value = false;
    }
  }

  function hydrate(storeId: string): boolean {
    const cached = storeCache.value[storeId];
    if (!cached) return false;

    shop.value = cached.shop ? { ...cached.shop } : null;
    hasFetchedProfile.value = cached.hasFetchedProfile;
    error.value = null;
    return true;
  }

  function $reset() {
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
    fetchProfile,
    hydrate,
    $reset,
  };
});
