import { computed } from "vue";
import { useCredentialVaultStore } from "~/stores/credentialVault";
import { useFormStore } from "~/stores/form";
import { useLocationStore } from "~/stores/locations";
import type { ShopifyNumericId, ShopifyProduct } from "~~/types/shopify";
import { resolveStoreAccessToken } from "~~/utils/shop-auth";
import { markStoreResourceLoaded } from "~~/utils/store-resource-cache";

export function getProductInventoryItemIds(product?: ShopifyProduct | null) {
  const ids = new Map<string, ShopifyNumericId>();
  for (const variant of product?.variants || []) {
    const id = variant.inventory_item_id;
    const key = String(id ?? "").trim();
    if (!/^\d+$/.test(key) || ids.has(key)) continue;
    ids.set(key, id as ShopifyNumericId);
  }
  return [...ids.values()];
}

export function useLocations() {
  const formStore = useFormStore();
  const locationStore = useLocationStore();
  const credentialVault = useCredentialVaultStore();

  function resolveToken(storeId = formStore.storeId): string | null {
    if (!storeId || typeof window === "undefined") return null;
    return resolveStoreAccessToken(credentialVault.getStoreData(storeId)) || null;
  }

  async function fetchLocations(force = false) {
    const storeId = formStore.storeId;
    const token = resolveToken(storeId);

    if (!storeId || !token) return;

    await locationStore.fetchAll(storeId, token, force);
    if (!locationStore.error) markStoreResourceLoaded(storeId, "locations");
  }

  async function fetchProductInventory(product?: ShopifyProduct | null, force = false) {
    const storeId = formStore.storeId;
    const token = resolveToken(storeId);

    if (!storeId || !token) return;

    await locationStore.fetchForInventoryItems(
      storeId,
      token,
      getProductInventoryItemIds(product),
      force,
    );
    if (!locationStore.error) markStoreResourceLoaded(storeId, "locations");
  }

  return {
    locations: computed(() => locationStore.locations),
    inventoryLevels: computed(() => locationStore.inventoryLevels),
    activeInventoryItemIdsKey: computed(() => locationStore.activeInventoryItemIdsKey),
    isLoadingLocations: computed(() => locationStore.isLoading),
    locationError: computed(() => locationStore.error),
    fetchLocations,
    fetchProductInventory,
    getProductInventoryItemIds,
  };
}
