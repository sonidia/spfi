import { storeToRefs } from "pinia";
import { ref, watch } from "vue";
import { useCredentialVaultStore } from "~/stores/credentialVault";
import { useCustomerStore } from "~/stores/customers";
import { useFormStore } from "~/stores/form";

export function useCustomers() {
  const customerStore = useCustomerStore();
  const credentialVault = useCredentialVaultStore();
  const formStore = useFormStore();
  const {
    customers,
    selectedCustomer,
    selectedCustomerOrders,
    activeQuery,
    isLoading,
    isLoadingDetail,
    error,
  } = storeToRefs(customerStore);
  const searchQuery = ref(activeQuery.value);

  watch(activeQuery, (query) => {
    searchQuery.value = query;
  });

  function getCredentials() {
    const storeId = formStore.storeId;
    const storeData = storeId ? credentialVault.getStoreData(storeId) : null;

    return {
      storeId,
      token: String(storeData?.accessToken || ""),
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

  function clearSelection() {
    customerStore.clearSelection();
  }

  return {
    customers,
    selectedCustomer,
    selectedCustomerOrders,
    activeQuery,
    searchQuery,
    isLoading,
    isLoadingDetail,
    error,
    search,
    selectCustomer,
    clearSelection,
  };
}
