import { defineStore } from "pinia";
import { ref } from "vue";
import { usePerStoreCache } from "~/composables/usePerStoreCache";
import type {
  ProductsListResponse,
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

export interface BulkProductPublicationResult {
  total: number;
  succeeded: number;
  failedIds: ShopifyNumericId[];
}

export const useProductStore = defineStore("product", () => {
  const products = ref<ShopifyProduct[]>([]);
  const hasFetchedAll = ref(false);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  let storeScopeVersion = 0;
  const storeCache = usePerStoreCache<ProductStoreCache>({
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
      const response = await $fetch<ProductsListResponse>("/api/product/all", {
        method: "POST",
        body: { storeId, token, limit },
      });

      const nextProducts = response.data.products;
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
    return storeCache.isActive(storeId) && storeScopeVersion === requestScope;
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
      await updateProductRequest(storeId, token, id, product);
      await fetchAll(storeId, token);
      return true;
    } catch (err) {
      error.value = getAppErrorMessage(err, "Update failed");
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function setProductsPublished(
    storeId: string,
    token: string,
    productIds: ShopifyNumericId[],
    publish: boolean,
  ): Promise<BulkProductPublicationResult> {
    const uniqueIds = Array.from(
      new Map(
        productIds
          .map((id) => [String(id), id] as const)
          .filter(([id]) => /^\d+$/.test(id)),
      ).values(),
    );
    const result: BulkProductPublicationResult = {
      total: uniqueIds.length,
      succeeded: 0,
      failedIds: [],
    };

    if (!storeId || !token || !uniqueIds.length) return result;

    activateStore(storeId);
    const requestScope = storeScopeVersion;
    isLoading.value = true;
    error.value = null;

    for (const id of uniqueIds) {
      try {
        await updateProductRequest(storeId, token, id, {
          ...(publish ? { status: "active" as const } : {}),
          published_at: publish ? new Date().toISOString() : null,
          ...(publish ? { published_scope: "web" as const } : {}),
        });
        result.succeeded += 1;
      } catch (err) {
        result.failedIds.push(id);
        if (isActiveRequest(storeId, requestScope)) {
          error.value = getAppErrorMessage(
            err,
            publish ? "Bulk publish failed." : "Bulk unpublish failed.",
          );
        }
      }
    }

    if (isActiveRequest(storeId, requestScope)) {
      await fetchAll(storeId, token);
      isLoading.value = false;
    }

    return result;
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
    isStoreActive: storeCache.isActive,
    fetchAll,
    createProduct,
    updateProduct,
    setProductsPublished,
    deleteProduct,
    hydrate,
    evictStore,
    $reset,
  };
});

function updateProductRequest(
  storeId: string,
  token: string,
  id: ShopifyNumericId,
  product: ShopifyProductUpdateInput,
) {
  return $fetch(`/api/product/${encodeURIComponent(String(id))}`, {
    method: "PUT",
    body: { storeId, token, product },
  });
}
