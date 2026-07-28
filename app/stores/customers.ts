import { defineStore } from "pinia";
import { ref } from "vue";
import type {
  CustomerDetailResponse,
  CustomersResponse,
  ShopifyCustomer,
  ShopifyOrder,
} from "~~/types/shopify";
import { getAppErrorMessage } from "~~/utils/error";

interface CustomerStoreCache {
  customers: ShopifyCustomer[];
  hasFetchedAll: boolean;
  activeQuery: string;
}

export const useCustomerStore = defineStore("customers", () => {
  const customers = ref<ShopifyCustomer[]>([]);
  const selectedCustomer = ref<ShopifyCustomer | null>(null);
  const selectedCustomerOrders = ref<ShopifyOrder[]>([]);
  const hasFetchedAll = ref(false);
  const activeQuery = ref("");
  const isLoading = ref(false);
  const isLoadingDetail = ref(false);
  const error = ref<string | null>(null);
  const storeCache = ref<Record<string, CustomerStoreCache>>({});

  async function fetchAll(
    storeId: string,
    token: string,
    query = "",
    limit = 250,
  ) {
    if (!storeId || !token) {
      error.value = "Store ID and Access Token are required.";
      return false;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const normalizedQuery = query.trim();
      const response = await $fetch<CustomersResponse>("/api/customer/all", {
        method: "POST",
        body: {
          storeId,
          token,
          limit,
          ...(normalizedQuery ? { query: normalizedQuery } : {}),
        },
      });

      customers.value = response.customers || [];
      activeQuery.value = normalizedQuery;
      hasFetchedAll.value = true;
      persist(storeId);
      return true;
    } catch (err) {
      error.value = getAppErrorMessage(err, "Failed to fetch customer data.");
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchById(storeId: string, token: string, id: string | number) {
    if (!storeId || !token || !id) {
      error.value = "Customer ID, Store ID and Access Token are required.";
      return false;
    }

    isLoadingDetail.value = true;
    error.value = null;

    try {
      const response = await $fetch<CustomerDetailResponse>(
        `/api/customer/${id}`,
        { params: { storeId, token } },
      );

      selectedCustomer.value = response.customer;
      selectedCustomerOrders.value = response.orders || [];

      if (response.customer?.id) {
        const index = customers.value.findIndex(
          (customer) => customer.id === response.customer?.id,
        );

        if (index >= 0) {
          customers.value[index] = response.customer;
        }
      }

      persist(storeId);
      return true;
    } catch (err) {
      error.value = getAppErrorMessage(err, "Failed to fetch customer detail.");
      return false;
    } finally {
      isLoadingDetail.value = false;
    }
  }

  function clearSelection() {
    selectedCustomer.value = null;
    selectedCustomerOrders.value = [];
  }

  function hydrate(storeId: string): boolean {
    const cached = storeCache.value[storeId];

    if (!cached) {
      return false;
    }

    customers.value = [...cached.customers];
    hasFetchedAll.value = cached.hasFetchedAll;
    activeQuery.value = cached.activeQuery;
    error.value = null;
    clearSelection();
    return true;
  }

  function persist(storeId: string) {
    storeCache.value[storeId] = {
      customers: [...customers.value],
      hasFetchedAll: hasFetchedAll.value,
      activeQuery: activeQuery.value,
    };
  }

  function $reset() {
    customers.value = [];
    hasFetchedAll.value = false;
    activeQuery.value = "";
    error.value = null;
    isLoading.value = false;
    isLoadingDetail.value = false;
    clearSelection();
  }

  return {
    customers,
    selectedCustomer,
    selectedCustomerOrders,
    hasFetchedAll,
    activeQuery,
    isLoading,
    isLoadingDetail,
    error,
    fetchAll,
    fetchById,
    clearSelection,
    hydrate,
    $reset,
  };
});
