import { storeToRefs } from "pinia";
import { getCurrentScope, onScopeDispose, ref, watch } from "vue";
import { useCredentialVaultStore } from "~/stores/credentialVault";
import { useCustomerStore } from "~/stores/customers";
import { useFormStore } from "~/stores/form";
import type {
  ShopifyCustomerAddressInput,
  ShopifyCustomerInput,
  ShopifyCustomerInviteInput,
} from "~~/types/shopify-customer";
import { resolveStoreAccessToken } from "~~/utils/shop-auth";

export function useCustomers() {
  const customerStore = useCustomerStore();
  const credentialVault = useCredentialVaultStore();
  const formStore = useFormStore();
  const {
    customers,
    selectedCustomer,
    selectedCustomerOrders,
    activeQuery,
    totalCount,
    addresses,
    isLoading,
    isLoadingDetail,
    isMutating,
    error,
  } = storeToRefs(customerStore);
  const searchQuery = ref(activeQuery.value);

  const stopActiveQueryWatch = watch(activeQuery, (query) => {
    searchQuery.value = query;
  });
  if (getCurrentScope()) onScopeDispose(stopActiveQueryWatch);

  function getCredentials() {
    const storeId = formStore.storeId;
    const storeData = storeId ? credentialVault.getStoreData(storeId) : null;

    return {
      storeId,
      token: resolveStoreAccessToken(storeData),
    };
  }

  async function search(query = searchQuery.value) {
    const { storeId, token } = getCredentials();

    if (!storeId || !token) {
      customerStore.error = "Store ID and Access Token are required.";
      return false;
    }

    searchQuery.value = query;
    return customerStore.fetchAll(storeId, token, query);
  }

  async function selectCustomer(id: string | number) {
    const { storeId, token } = getCredentials();

    if (!storeId || !token) {
      customerStore.error = "Store ID and Access Token are required.";
      return false;
    }

    return customerStore.fetchById(storeId, token, id);
  }

  async function withCredentials<T>(
    operation: (storeId: string, token: string) => Promise<T>,
  ): Promise<T | false> {
    const { storeId, token } = getCredentials();

    if (!storeId || !token) {
      customerStore.error = "Store ID and Access Token are required.";
      return false;
    }

    return operation(storeId, token);
  }

  function createCustomer(customer: ShopifyCustomerInput) {
    return withCredentials((storeId, token) =>
      customerStore.createCustomer(storeId, token, customer),
    );
  }

  function updateCustomer(customerId: string | number, customer: ShopifyCustomerInput) {
    return withCredentials((storeId, token) =>
      customerStore.updateCustomer(storeId, token, customerId, customer),
    );
  }

  function deleteCustomer(customerId: string | number) {
    return withCredentials((storeId, token) =>
      customerStore.deleteCustomer(storeId, token, customerId),
    );
  }

  function fetchAddresses(customerId: string | number) {
    return withCredentials((storeId, token) =>
      customerStore.fetchAddresses(storeId, token, customerId),
    );
  }

  function saveAddress(
    customerId: string | number,
    address: ShopifyCustomerAddressInput,
    addressId?: string | number,
  ) {
    return withCredentials((storeId, token) =>
      customerStore.saveAddress(storeId, token, customerId, address, addressId),
    );
  }

  function deleteAddress(customerId: string | number, addressId: string | number) {
    return withCredentials((storeId, token) =>
      customerStore.deleteAddress(storeId, token, customerId, addressId),
    );
  }

  function setDefaultAddress(customerId: string | number, addressId: string | number) {
    return withCredentials((storeId, token) =>
      customerStore.setDefaultAddress(storeId, token, customerId, addressId),
    );
  }

  function createActivationUrl(customerId: string | number) {
    return withCredentials((storeId, token) =>
      customerStore.createActivationUrl(storeId, token, customerId),
    );
  }

  function sendInvite(
    customerId: string | number,
    invite: ShopifyCustomerInviteInput = {},
  ) {
    return withCredentials((storeId, token) =>
      customerStore.sendInvite(storeId, token, customerId, invite),
    );
  }

  function clearSelection() {
    customerStore.clearSelection();
  }

  return {
    customers,
    selectedCustomer,
    selectedCustomerOrders,
    activeQuery,
    totalCount,
    addresses,
    searchQuery,
    isLoading,
    isLoadingDetail,
    isMutating,
    error,
    search,
    selectCustomer,
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
  };
}
