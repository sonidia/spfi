import { computed } from "vue";
import { useCredentialVaultStore } from "~/stores/credentialVault";
import { useFormStore } from "~/stores/form";
import { useLocationStore } from "~/stores/locations";
import type { ShopifyProduct } from "~~/types/shopify";

function getProductInventoryItemIds(product?: ShopifyProduct | null) {
  return Array.from(
    new Set(
      (product?.variants || [])
        .map((variant) => variant.inventory_item_id)
        .filter((id): id is number => typeof id === "number"),
    ),
  );
}

export function useLocations() {
  const formStore = useFormStore();
  const locationStore = useLocationStore();
  const credentialVault = useCredentialVaultStore();

  function resolveToken(storeId = formStore.storeId): string | null {
    if (!storeId || typeof window === "undefined") return null;

    const data = credentialVault.getStoreData(storeId);
    const now = Date.now();

    if (data?.accessToken && data?.expiresTime && now < data.expiresTime) {
      return data.accessToken;
    }

    return null;
  }

  async function fetchLocations(force = false) {
    const storeId = formStore.storeId;
    const token = resolveToken(storeId);

    if (!storeId || !token) return;

    await locationStore.fetchAll(storeId, token, force);
  }

  async function fetchProductInventory(
    product?: ShopifyProduct | null,
    force = false,
  ) {
    const storeId = formStore.storeId;
    const token = resolveToken(storeId);

    if (!storeId || !token) return;

    await locationStore.fetchForInventoryItems(
      storeId,
      token,
      getProductInventoryItemIds(product),
      force,
    );
  }

  return {
    locations: computed(() => locationStore.locations),
    inventoryLevels: computed(() => locationStore.inventoryLevels),
    activeInventoryItemIdsKey: computed(
      () => locationStore.activeInventoryItemIdsKey,
    ),
    isLoadingLocations: computed(() => locationStore.isLoading),
    locationError: computed(() => locationStore.error),
    fetchLocations,
    fetchProductInventory,
    getProductInventoryItemIds,
  };
}
