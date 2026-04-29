import { defineStore } from "pinia";
import { ref } from "vue";

export const useOrderStore = defineStore("order", () => {
  const orders = ref<any[]>([]);
  const hasFetchedAll = ref(false);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  async function fetchAll(storeId: string, token: string) {
    if (!storeId || !token) {
      error.value = "Store ID and Access Token are required.";
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const response = await $fetch<any>("/api/order/all", {
        method: "POST",
        body: { storeId, token },
      });

      orders.value = response.orders || (response.order ? [response.order] : []);
      hasFetchedAll.value = true;
    } catch (err: any) {
      error.value =
        err?.data?.statusMessage ??
        err?.message ??
        "Failed to fetch order data.";
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchById(storeId: string, token: string, id: string, force = false) {
    if (!storeId || !token || !id) return;

    // Check if already in list and not forcing
    const existing = orders.value.find(o => o.id?.toString() === id);
    if (!force && existing) return;

    isLoading.value = true;
    error.value = null;

    try {
      const response = await $fetch<any>(`/api/order/${id}`, {
        params: { storeId, token },
      });

      if (response.order) {
        const index = orders.value.findIndex(o => o.id?.toString() === id);
        if (index > -1) {
          orders.value[index] = response.order;
        } else {
          orders.value.push(response.order);
        }
      }
    } catch (err: any) {
      error.value = err.message || "Failed to fetch order detail.";
    } finally {
      isLoading.value = false;
    }
  }

  function $reset() {
    orders.value = [];
    hasFetchedAll.value = false;
    error.value = null;
    isLoading.value = false;
  }

  return {
    orders,
    hasFetchedAll,
    isLoading,
    error,
    fetchAll,
    fetchById,
    $reset,
  };
});
