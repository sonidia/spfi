import { defineStore } from "pinia";
import { ref } from "vue";

export const useProductStore = defineStore("product", () => {
  const products = ref<any[]>([]);
  const hasFetchedAll = ref(false);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  async function fetchAll(storeId: string, token: string, limit = 50) {
    if (!storeId || !token) {
      error.value = "Store ID and Access Token are required.";
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const response = await $fetch<any>("/api/product/all", {
        method: "POST",
        body: { storeId, token, limit },
      });

      products.value = response.products || [];
      hasFetchedAll.value = true;
    } catch (err: any) {
      error.value =
        err?.data?.statusMessage ??
        err?.message ??
        "Failed to fetch product data.";
    } finally {
      isLoading.value = false;
    }
  }

  async function createProduct(storeId: string, token: string, product: any) {
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
    } catch (err: any) {
      error.value = err.data?.statusMessage || err.message || "Create failed";
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function updateProduct(storeId: string, token: string, id: number, product: any) {
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
    } catch (err: any) {
      error.value = err.data?.statusMessage || err.message || "Update failed";
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
    } catch (err: any) {
      error.value = err.data?.statusMessage || err.message || "Delete failed";
      return false;
    } finally {
      isLoading.value = false;
    }
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
    $reset,
  };
});
