import { defineStore } from "pinia";
import { ref } from "vue";
import type { OrdersResponse, ShopifyOrder } from "~~/types/shopify";
import { getAppErrorMessage } from "~~/utils/error";

export const useOrderStore = defineStore("order", () => {
  const orders = ref<ShopifyOrder[]>([]);
  const hasFetchedAll = ref(false);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const activeStoreId = ref("");
  const currentPage = ref(1);
  const pageSize = ref(20);
  const storeCache = ref<
    Record<
      string,
      {
        orders: ShopifyOrder[];
        hasFetchedAll: boolean;
        currentPage: number;
        pageSize: number;
      }
    >
  >({});

  function rememberStore(storeId = activeStoreId.value) {
    if (!storeId) return;
    storeCache.value[storeId] = {
      orders: [...orders.value],
      hasFetchedAll: hasFetchedAll.value,
      currentPage: currentPage.value,
      pageSize: pageSize.value,
    };
  }

  function activateStore(storeId: string) {
    if (activeStoreId.value === storeId) return;
    hydrate(storeId);
  }

  async function fetchAll(storeId: string, token: string, force = false) {
    if (!storeId || !token) {
      error.value = "Store ID and Access Token are required.";
      return;
    }

    activateStore(storeId);
    if (!force && hasFetchedAll.value) return;

    isLoading.value = true;
    error.value = null;

    try {
      const response = await $fetch<OrdersResponse>("/api/order/all", {
        method: "POST",
        body: { storeId, token },
      });

      storeCache.value[storeId] = {
        orders: response.orders || (response.order ? [response.order] : []),
        hasFetchedAll: true,
        currentPage: force ? 1 : currentPage.value,
        pageSize: pageSize.value,
      };
      if (activeStoreId.value === storeId) {
        orders.value = [...storeCache.value[storeId].orders];
        hasFetchedAll.value = true;
        if (force) currentPage.value = 1;
      }
    } catch (err) {
      if (activeStoreId.value === storeId) {
        error.value = getAppErrorMessage(err, "Failed to fetch order data.");
      }
    } finally {
      if (activeStoreId.value === storeId) {
        isLoading.value = false;
      }
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

    activateStore(storeId);
    isLoading.value = true;
    error.value = null;

    try {
      const response = await $fetch<OrdersResponse>(`/api/order/${id}`, {
        params: { storeId, token },
      });

      if (response.order && activeStoreId.value === storeId) {
        const index = orders.value.findIndex(
          (order) => order.id?.toString() === id,
        );
        if (index > -1) {
          orders.value[index] = response.order;
        } else {
          orders.value.push(response.order);
        }
        rememberStore(storeId);
      }
    } catch (err) {
      if (activeStoreId.value === storeId) {
        error.value = getAppErrorMessage(err, "Failed to fetch order detail.");
      }
    } finally {
      if (activeStoreId.value === storeId) {
        isLoading.value = false;
      }
    }
  }

  function hydrate(storeId: string): boolean {
    activeStoreId.value = storeId;
    const cached = storeCache.value[storeId];
    if (!cached) {
      $reset();
      return false;
    }
    orders.value = [...cached.orders];
    hasFetchedAll.value = cached.hasFetchedAll;
    currentPage.value = cached.currentPage;
    pageSize.value = cached.pageSize;
    error.value = null;
    return true;
  }

  function setPage(page: number) {
    currentPage.value = Math.max(1, Math.floor(page));
    rememberStore();
  }

  function setPageSize(size: number) {
    pageSize.value = Math.max(1, Math.floor(size));
    currentPage.value = 1;
    rememberStore();
  }

  function $reset() {
    orders.value = [];
    hasFetchedAll.value = false;
    currentPage.value = 1;
    pageSize.value = 20;
    error.value = null;
    isLoading.value = false;
  }

  return {
    orders,
    hasFetchedAll,
    isLoading,
    error,
    activeStoreId,
    currentPage,
    pageSize,
    fetchAll,
    fetchById,
    hydrate,
    setPage,
    setPageSize,
    $reset,
  };
});
