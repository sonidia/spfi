import { defineStore } from "pinia";
import { ref } from "vue";
import { usePerStoreCache } from "~/composables/usePerStoreCache";
import type {
  ProductsResponse,
  ShopifyNumericId,
  ShopifyProduct,
  ShopifyProductInput,
} from "~~/types/shopify";
import type { ShopifyProductUpdateInput } from "~~/types/shopify-product";
import { getAppErrorMessage } from "~~/utils/error";

interface ProductStoreCache {
  products: ShopifyProduct[];
  hasFetchedAll: boolean;
}

export const useProductStore = defineStore("product", () => {
  const products = ref<ShopifyProduct[]>([]);
  const hasFetchedAll = ref(false);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const activeStoreId = ref("");
  let storeScopeVersion = 0;
  const storeCache = usePerStoreCache<ProductStoreCache>({
    activeStoreId,
    capture: () => ({
      products: [...products.value],
      hasFetchedAll: hasFetchedAll.value,
    }),
    restore: (cached) => {
      products.value = [...cached.products];
      hasFetchedAll.value = cached.hasFetchedAll;
      error.value = null;
    },
    reset: resetState,
    onStoreChange: () => {
      storeScopeVersion += 1;
    },
  });
  const activateStore = storeCache.activate;
  const hydrate = storeCache.hydrate;
  const evictStore = storeCache.evict;

  async function fetchAll(storeId: string, token: string, limit = 50) {
    if (!storeId || !token) {
      error.value = "Store ID and Access Token are required.";
      return;
    }

    activateStore(storeId);
    const requestScope = storeScopeVersion;
    isLoading.value = true;
    error.value = null;

    try {
      const response = await $fetch<ProductsResponse>("/api/product/all", {
        method: "POST",
        body: { storeId, token, limit },
      });

      const nextProducts = response.products || [];
      storeCache.set(storeId, {
        products: [...nextProducts],
        hasFetchedAll: true,
      });
      if (isActiveRequest(storeId, requestScope)) {
        products.value = nextProducts;
        hasFetchedAll.value = true;
      }
    } catch (err) {
      if (isActiveRequest(storeId, requestScope)) {
        error.value = getAppErrorMessage(err, "Failed to fetch product data.");
      }
    } finally {
      if (isActiveRequest(storeId, requestScope)) isLoading.value = false;
    }
  }

  function isActiveRequest(storeId: string, requestScope: number) {
    return activeStoreId.value === storeId && storeScopeVersion === requestScope;
  }

  async function createProduct(
    storeId: string,
    token: string,
    product: ShopifyProductInput,
  ) {
    if (!storeId || !token) return;
    isLoading.value = true;
    error.value = null;
    try {
      await $fetch("/api/product/create", {
        method: "POST",
        body: { storeId, token, product },
      });
      await fetchAll(storeId, token);
      return true;
    } catch (err) {
      error.value = getAppErrorMessage(err, "Create failed");
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function updateProduct(
    storeId: string,
    token: string,
    id: ShopifyNumericId,
    product: ShopifyProductUpdateInput,
  ) {
    if (!storeId || !token || !id) return;
    isLoading.value = true;
    error.value = null;
    try {
      await $fetch(`/api/product/${id}`, {
        method: "PUT",
        body: { storeId, token, product },
      });
      await fetchAll(storeId, token);
      return true;
    } catch (err) {
      error.value = getAppErrorMessage(err, "Update failed");
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function deleteProduct(storeId: string, token: string, id: ShopifyNumericId) {
    if (!storeId || !token || !id) return;
    isLoading.value = true;
    error.value = null;
    try {
      await $fetch(`/api/product/${id}`, {
        method: "DELETE",
        body: { storeId, token },
      });
      await fetchAll(storeId, token);
      return true;
    } catch (err) {
      error.value = getAppErrorMessage(err, "Delete failed");
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  function $reset() {
    storeScopeVersion += 1;
    resetState();
  }

  function resetState() {
    products.value = [];
    hasFetchedAll.value = false;
    error.value = null;
    isLoading.value = false;
  }

  return {
    products,
    hasFetchedAll,
    isLoading,
    error,
    activeStoreId,
    fetchAll,
    createProduct,
    updateProduct,
    deleteProduct,
    hydrate,
    evictStore,
    $reset,
  };
});
