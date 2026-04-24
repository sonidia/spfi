import { defineStore } from "pinia";
import { ref } from "vue";

export const useOrderStore = defineStore("order", () => {
  const orders = ref<any[]>([]);
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
    } catch (err: any) {
      error.value =
        err?.data?.statusMessage ??
        err?.message ??
        "Failed to fetch order data.";
    } finally {
      isLoading.value = false;
    }
  }

  function $reset() {
    orders.value = [];
    error.value = null;
    isLoading.value = false;
  }

  return {
    orders,
    isLoading,
    error,
    fetchAll,
    $reset,
  };
});
