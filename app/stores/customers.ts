import { defineStore } from "pinia";
import { ref } from "vue";
import { usePerStoreCache } from "~/composables/usePerStoreCache";
import type {
  CustomerDetailResponse,
  CustomersResponse,
  ShopifyCustomer,
  ShopifyCustomerAddress,
  ShopifyOrder,
} from "~~/types/shopify";
import type {
  CustomerAccountActivationUrlResponse,
  CustomerAddressResponse,
  CustomerAddressesResponse,
  CustomerCountResponse,
  CustomerInviteResponse,
  CustomerResponse,
  ShopifyCustomerAddressInput,
  ShopifyCustomerInput,
  ShopifyCustomerInviteInput,
} from "~~/types/shopify-customer";
import { getAppErrorMessage } from "~~/utils/error";

interface CustomerStoreCache {
  customers: ShopifyCustomer[];
  hasFetchedAll: boolean;
  activeQuery: string;
  totalCount: number;
}

export const useCustomerStore = defineStore("customers", () => {
  const customers = ref<ShopifyCustomer[]>([]);
  const selectedCustomer = ref<ShopifyCustomer | null>(null);
  const selectedCustomerOrders = ref<ShopifyOrder[]>([]);
  const hasFetchedAll = ref(false);
  const activeQuery = ref("");
  const totalCount = ref(0);
  const addresses = ref<ShopifyCustomerAddress[]>([]);
  const isLoading = ref(false);
  const isLoadingDetail = ref(false);
  const isMutating = ref(false);
  const error = ref<string | null>(null);
  const activeStoreId = ref("");
  let listRequestSequence = 0;
  let detailRequestSequence = 0;
  let addressRequestSequence = 0;
  const storeCache = usePerStoreCache<CustomerStoreCache>({
    activeStoreId,
    capture: () => ({
      customers: [...customers.value],
      hasFetchedAll: hasFetchedAll.value,
      activeQuery: activeQuery.value,
      totalCount: totalCount.value,
    }),
    restore: (cached) => {
      customers.value = [...cached.customers];
      hasFetchedAll.value = cached.hasFetchedAll;
      activeQuery.value = cached.activeQuery;
      totalCount.value = cached.totalCount ?? cached.customers.length;
      error.value = null;
      clearSelection();
    },
    reset: resetState,
    onStoreChange: () => {
      listRequestSequence += 1;
    },
  });
  const activateStore = storeCache.activate;
  const hydrate = storeCache.hydrate;
  const evictStore = storeCache.evict;
  const persist = storeCache.remember;

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

    activateStore(storeId);
    isLoading.value = true;
    error.value = null;
    const requestId = ++listRequestSequence;

    try {
      const normalizedQuery = query.trim();
      const [response, countResponse] = await Promise.all([
        $fetch<CustomersResponse>("/api/customer/all", {
          method: "POST",
          body: {
            storeId,
            token,
            limit,
            ...(normalizedQuery ? { query: normalizedQuery } : {}),
          },
        }),
        normalizedQuery
          ? Promise.resolve<CustomerCountResponse | null>(null)
          : $fetch<CustomerCountResponse>("/api/customer/count", {
              method: "POST",
              body: { storeId, token },
            }),
      ]);

      if (requestId !== listRequestSequence) return false;

      const nextCustomers = response.customers || [];
      customers.value = nextCustomers;
      totalCount.value = countResponse?.count ?? nextCustomers.length;
      activeQuery.value = normalizedQuery;
      hasFetchedAll.value = true;
      persist(storeId);
      return true;
    } catch (err) {
      if (requestId === listRequestSequence) {
        error.value = getAppErrorMessage(err, "Failed to fetch customer data.");
      }
      return false;
    } finally {
      if (requestId === listRequestSequence) {
        isLoading.value = false;
      }
    }
  }

  async function fetchById(storeId: string, token: string, id: string | number) {
    if (!storeId || !token || !id) {
      error.value = "Customer ID, Store ID and Access Token are required.";
      return false;
    }

    activateStore(storeId);
    isLoadingDetail.value = true;
    error.value = null;
    const requestId = ++detailRequestSequence;
    if (String(selectedCustomer.value?.id || "") !== String(id)) {
      addressRequestSequence += 1;
      selectedCustomer.value = null;
      selectedCustomerOrders.value = [];
      addresses.value = [];
    }

    try {
      const response = await $fetch<CustomerDetailResponse>(
        `/api/customer/${id}`,
        {
          params: { storeId },
          headers: { "x-shopify-access-token": token },
        },
      );

      if (requestId !== detailRequestSequence) return false;

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
      if (requestId === detailRequestSequence) {
        error.value = getAppErrorMessage(
          err,
          "Failed to fetch customer detail.",
        );
      }
      return false;
    } finally {
      if (requestId === detailRequestSequence) {
        isLoadingDetail.value = false;
      }
    }
  }

  function clearSelection() {
    detailRequestSequence += 1;
    addressRequestSequence += 1;
    selectedCustomer.value = null;
    selectedCustomerOrders.value = [];
    addresses.value = [];
    isLoadingDetail.value = false;
  }

  async function createCustomer(
    storeId: string,
    token: string,
    customer: ShopifyCustomerInput,
  ) {
    return runMutation("Failed to create customer.", async () => {
      const response = await $fetch<CustomerResponse>("/api/customer/create", {
        method: "POST",
        body: { storeId, token, customer },
      });
      await fetchAll(storeId, token, activeQuery.value);
      if (response.customer?.id) {
        await fetchById(storeId, token, response.customer.id);
      }
      return response.customer || null;
    });
  }

  async function updateCustomer(
    storeId: string,
    token: string,
    customerId: string | number,
    customer: ShopifyCustomerInput,
  ) {
    return runMutation("Failed to update customer.", async () => {
      const response = await $fetch<CustomerResponse>(
        `/api/customer/${customerId}`,
        {
          method: "PUT",
          body: { storeId, token, customer },
        },
      );
      await fetchAll(storeId, token, activeQuery.value);
      await fetchById(storeId, token, customerId);
      return response.customer || null;
    });
  }

  async function deleteCustomer(
    storeId: string,
    token: string,
    customerId: string | number,
  ) {
    return runMutation("Failed to delete customer.", async () => {
      await $fetch(`/api/customer/${customerId}`, {
        method: "DELETE",
        params: { storeId },
        headers: { "x-shopify-access-token": token },
      });
      clearSelection();
      await fetchAll(storeId, token, activeQuery.value);
      return true;
    });
  }

  async function fetchAddresses(
    storeId: string,
    token: string,
    customerId: string | number,
  ) {
    error.value = null;
    const requestId = ++addressRequestSequence;
    try {
      const response = await $fetch<CustomerAddressesResponse>(
        `/api/customer/${customerId}/address/all`,
        {
          params: { storeId },
          headers: { "x-shopify-access-token": token },
        },
      );
      if (
        requestId !== addressRequestSequence ||
        String(selectedCustomer.value?.id || "") !== String(customerId)
      ) {
        return false;
      }
      addresses.value = response.addresses || [];
      return true;
    } catch (err) {
      if (requestId === addressRequestSequence) {
        error.value = getAppErrorMessage(err, "Failed to fetch addresses.");
      }
      return false;
    }
  }

  async function saveAddress(
    storeId: string,
    token: string,
    customerId: string | number,
    address: ShopifyCustomerAddressInput,
    addressId?: string | number,
  ) {
    return runMutation("Failed to save address.", async () => {
      const path = addressId
        ? `/api/customer/${customerId}/address/${addressId}`
        : `/api/customer/${customerId}/address/create`;
      const response = await $fetch<CustomerAddressResponse>(path, {
        method: addressId ? "PUT" : "POST",
        body: { storeId, token, address },
      });
      await Promise.all([
        fetchAddresses(storeId, token, customerId),
        fetchById(storeId, token, customerId),
      ]);
      return response.customer_address || null;
    });
  }

  async function deleteAddress(
    storeId: string,
    token: string,
    customerId: string | number,
    addressId: string | number,
  ) {
    return runMutation("Failed to delete address.", async () => {
      await $fetch(`/api/customer/${customerId}/address/${addressId}`, {
        method: "DELETE",
        params: { storeId },
        headers: { "x-shopify-access-token": token },
      });
      await Promise.all([
        fetchAddresses(storeId, token, customerId),
        fetchById(storeId, token, customerId),
      ]);
      return true;
    });
  }

  async function setDefaultAddress(
    storeId: string,
    token: string,
    customerId: string | number,
    addressId: string | number,
  ) {
    return runMutation("Failed to set the default address.", async () => {
      await $fetch<CustomerAddressResponse>(
        `/api/customer/${customerId}/address/${addressId}/default`,
        { method: "PUT", body: { storeId, token } },
      );
      await Promise.all([
        fetchAddresses(storeId, token, customerId),
        fetchById(storeId, token, customerId),
      ]);
      return true;
    });
  }

  async function createActivationUrl(
    storeId: string,
    token: string,
    customerId: string | number,
  ) {
    return runMutation("Failed to create activation URL.", () =>
      $fetch<CustomerAccountActivationUrlResponse>(
        `/api/customer/${customerId}/account-activation-url`,
        { method: "POST", body: { storeId, token } },
      ),
    );
  }

  async function sendInvite(
    storeId: string,
    token: string,
    customerId: string | number,
    customerInvite: ShopifyCustomerInviteInput = {},
  ) {
    return runMutation("Failed to send the customer invite.", () =>
      $fetch<CustomerInviteResponse>(
        `/api/customer/${customerId}/send-invite`,
        {
          method: "POST",
          body: {
            storeId,
            token,
            customer_invite: customerInvite,
          },
        },
      ),
    );
  }

  async function runMutation<T>(
    fallbackMessage: string,
    operation: () => Promise<T>,
  ): Promise<T | null> {
    isMutating.value = true;
    error.value = null;
    try {
      return await operation();
    } catch (err) {
      error.value = getAppErrorMessage(err, fallbackMessage);
      return null;
    } finally {
      isMutating.value = false;
    }
  }

  function $reset() {
    listRequestSequence += 1;
    resetState();
  }

  function resetState() {
    detailRequestSequence += 1;
    addressRequestSequence += 1;
    customers.value = [];
    hasFetchedAll.value = false;
    activeQuery.value = "";
    totalCount.value = 0;
    error.value = null;
    isLoading.value = false;
    isLoadingDetail.value = false;
    isMutating.value = false;
    clearSelection();
  }

  return {
    customers,
    selectedCustomer,
    selectedCustomerOrders,
    hasFetchedAll,
    activeQuery,
    totalCount,
    addresses,
    isLoading,
    isLoadingDetail,
    isMutating,
    error,
    activeStoreId,
    fetchAll,
    fetchById,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    fetchAddresses,
    saveAddress,
    deleteAddress,
    setDefaultAddress,
    createActivationUrl,
    sendInvite,
    clearSelection,
    hydrate,
    evictStore,
    $reset,
  };
});
