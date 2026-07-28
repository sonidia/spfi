import { defineStore } from "pinia";
import { ref } from "vue";
import type {
  ProductsResponse,
  ShopifyProduct,
  ShopifyProductInput,
} from "~~/types/shopify";
import { getAppErrorMessage } from "~~/utils/error";

export const useProductStore = defineStore("product", () => {
  const products = ref<ShopifyProduct[]>([]);
  const hasFetchedAll = ref(false);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const storeCache = ref<
    Record<string, { products: ShopifyProduct[]; hasFetchedAll: boolean }>
  >({});

  async function fetchAll(storeId: string, token: string, limit = 50) {
    if (!storeId || !token) {
      error.value = "Store ID and Access Token are required.";
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const response = await $fetch<ProductsResponse>("/api/product/all", {
        method: "POST",
        body: { storeId, token, limit },
      });

      products.value = response.products || [];
      hasFetchedAll.value = true;
      storeCache.value[storeId] = {
        products: [...products.value],
        hasFetchedAll: hasFetchedAll.value,
      };
    } catch (err) {
      error.value = getAppErrorMessage(err, "Failed to fetch product data.");
    } finally {
      isLoading.value = false;
    }
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
    id: number,
    product: ShopifyProductInput,
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

  async function deleteProduct(storeId: string, token: string, id: number) {
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

  function hydrate(storeId: string): boolean {
    const cached = storeCache.value[storeId];
    if (!cached) return false;
    products.value = [...cached.products];
    hasFetchedAll.value = cached.hasFetchedAll;
    error.value = null;
    return true;
  }

  function $reset() {
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
    fetchAll,
    createProduct,
    updateProduct,
    deleteProduct,
    hydrate,
    $reset,
  };
});
