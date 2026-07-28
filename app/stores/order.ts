import { defineStore } from "pinia";
import { ref } from "vue";
import type { OrdersResponse, ShopifyOrder } from "~~/types/shopify";
import { getAppErrorMessage } from "~~/utils/error";

export const useOrderStore = defineStore("order", () => {
  const orders = ref<ShopifyOrder[]>([]);
  const hasFetchedAll = ref(false);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const storeCache = ref<
    Record<string, { orders: ShopifyOrder[]; hasFetchedAll: boolean }>
  >({});

  async function fetchAll(storeId: string, token: string) {
    if (!storeId || !token) {
      error.value = "Store ID and Access Token are required.";
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const response = await $fetch<OrdersResponse>("/api/order/all", {
        method: "POST",
        body: { storeId, token },
      });

      orders.value = response.orders || (response.order ? [response.order] : []);
      hasFetchedAll.value = true;
      storeCache.value[storeId] = {
        orders: [...orders.value],
        hasFetchedAll: hasFetchedAll.value,
      };
    } catch (err) {
      error.value = getAppErrorMessage(err, "Failed to fetch order data.");
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchById(
    storeId: string,
    token: string,
    id: string,
    force = false,
  ) {
    void force;
    if (!storeId || !token || !id) return;

    isLoading.value = true;
    error.value = null;

    try {
      const response = await $fetch<OrdersResponse>(`/api/order/${id}`, {
        params: { storeId, token },
      });

      if (response.order) {
        const index = orders.value.findIndex((order) => order.id?.toString() === id);
        if (index > -1) {
          orders.value[index] = response.order;
        } else {
          orders.value.push(response.order);
        }
        storeCache.value[storeId] = {
          orders: [...orders.value],
          hasFetchedAll: hasFetchedAll.value,
        };
      }
    } catch (err) {
      error.value = getAppErrorMessage(err, "Failed to fetch order detail.");
    } finally {
      isLoading.value = false;
    }
  }

  function hydrate(storeId: string): boolean {
    const cached = storeCache.value[storeId];
    if (!cached) return false;
    orders.value = [...cached.orders];
    hasFetchedAll.value = cached.hasFetchedAll;
    error.value = null;
    return true;
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
    hydrate,
    $reset,
  };
});
