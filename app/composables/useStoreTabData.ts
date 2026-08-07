import { useCredentialVaultStore } from "~/stores/credentialVault";
import { useCustomerStore } from "~/stores/customers";
import { useFormStore } from "~/stores/form";
import { useLocationStore } from "~/stores/locations";
import { useOrderStore } from "~/stores/order";
import { usePaymentStore } from "~/stores/payment";
import { useProductStore } from "~/stores/product";
import { useShopProfileStore } from "~/stores/shopProfile";
import type { StoreTab } from "~~/types/store";

const MISSING_TOKEN_MESSAGE =
  "Access token is missing. Update this store's credentials and try again.";
const EXPIRED_TOKEN_MESSAGE =
  "Access token has expired. Update this store's credentials and try again.";

export function useStoreTabData() {
  const formStore = useFormStore();
  const credentialVault = useCredentialVaultStore();
  const customerStore = useCustomerStore();
  const locationStore = useLocationStore();
  const orderStore = useOrderStore();
  const paymentStore = usePaymentStore();
  const productStore = useProductStore();
  const profileStore = useShopProfileStore();

  function hydrateStoreData(storeId: string) {
    const hasOrders = orderStore.hydrate(storeId);
    if (!hasOrders) orderStore.$reset();

    const hasPayments = paymentStore.hydrate(storeId);
    if (!hasPayments) paymentStore.$reset();

    const hasProducts = productStore.hydrate(storeId);
    if (!hasProducts) productStore.$reset();

    const hasLocations = locationStore.hydrate(storeId);
    if (!hasLocations) locationStore.$reset();

    const hasCustomers = customerStore.hydrate(storeId);
    if (!hasCustomers) customerStore.$reset();

    const hasProfile = profileStore.hydrate(storeId);
    if (!hasProfile) profileStore.$reset();
  }

  function ensureStoreScope(storeId: string) {
    const isCurrentStore =
      orderStore.activeStoreId === storeId &&
      paymentStore.activeStoreId === storeId &&
      productStore.activeStoreId === storeId &&
      customerStore.activeStoreId === storeId &&
      profileStore.activeStoreId === storeId;

    if (!isCurrentStore) hydrateStoreData(storeId);
  }

  function getToken(storeId: string) {
    const data = credentialVault.getStoreData(storeId);
    if (!data.accessToken) {
      return { token: "", error: MISSING_TOKEN_MESSAGE };
    }
    if (data.expiresTime && Date.now() >= data.expiresTime) {
      return { token: "", error: EXPIRED_TOKEN_MESSAGE };
    }
    return { token: data.accessToken, error: "" };
  }

  function setTabError(tab: StoreTab, message: string | null) {
    if (["transactions", "payouts", "disputes"].includes(tab)) {
      paymentStore.error = message;
    } else if (tab === "orders") {
      orderStore.error = message;
    } else if (tab === "products") {
      productStore.error = message;
    } else if (tab === "customers") {
      customerStore.error = message;
    } else {
      profileStore.error = message;
    }
  }

  function getTabError(tab: StoreTab) {
    if (["transactions", "payouts", "disputes"].includes(tab)) {
      return paymentStore.error;
    }
    if (tab === "orders") return orderStore.error;
    if (tab === "products") return productStore.error;
    if (tab === "customers") return customerStore.error;
    return profileStore.error;
  }

  async function loadPaymentData(
    storeId: string,
    token: string,
    force: boolean,
  ) {
    if (force || !paymentStore.hasFetchedAll || paymentStore.error) {
      await paymentStore.fetchAll(storeId, token, force);
      return;
    }

    if (!paymentStore.hasFetchedBalanceTransactions) {
      await paymentStore.fetchBalanceTransactions(storeId, token, force);
    }
  }

  async function loadStoreTabData(
    tab: StoreTab,
    storeId = formStore.storeId,
    force = false,
  ): Promise<boolean> {
    if (!storeId) return false;

    ensureStoreScope(storeId);
    const { token, error: tokenError } = getToken(storeId);
    if (!token) {
      setTabError(tab, tokenError);
      return false;
    }

    const shouldForce = force || Boolean(getTabError(tab));
    setTabError(tab, null);

    if (["transactions", "payouts", "disputes"].includes(tab)) {
      await loadPaymentData(storeId, token, shouldForce);
      if (
        tab === "disputes" &&
        !paymentStore.error &&
        (shouldForce || !paymentStore.hasFetchedDisputes)
      ) {
        await paymentStore.fetchDisputes(storeId, token);
      }
      return !paymentStore.error;
    }

    if (tab === "orders") {
      const requests: Promise<unknown>[] = [];
      if (shouldForce || !orderStore.hasFetchedAll || orderStore.error) {
        requests.push(orderStore.fetchAll(storeId, token, shouldForce));
      }
      if (shouldForce || !paymentStore.hasFetchedBalanceTransactions) {
        requests.push(
          paymentStore.fetchBalanceTransactions(storeId, token, shouldForce),
        );
      }
      await Promise.all(requests);
      return !orderStore.error;
    }

    if (tab === "products") {
      if (shouldForce || !productStore.hasFetchedAll || productStore.error) {
        await productStore.fetchAll(storeId, token);
      }
      return !productStore.error;
    }

    if (tab === "customers") {
      if (shouldForce || !customerStore.hasFetchedAll || customerStore.error) {
        await customerStore.fetchAll(
          storeId,
          token,
          customerStore.activeQuery,
        );
      }
      return !customerStore.error;
    }

    const requests: Promise<unknown>[] = [];
    if (shouldForce || !profileStore.hasFetchedProfile || profileStore.error) {
      requests.push(profileStore.fetchProfile(storeId, token));
    }
    if (
      shouldForce ||
      !paymentStore.hasFetchedAll ||
      !paymentStore.hasFetchedBalanceTransactions ||
      paymentStore.error
    ) {
      requests.push(loadPaymentData(storeId, token, shouldForce));
    }
    if (shouldForce || !orderStore.hasFetchedAll || orderStore.error) {
      requests.push(orderStore.fetchAll(storeId, token, shouldForce));
    }
    await Promise.all(requests);
    return !profileStore.error;
  }

  return {
    hydrateStoreData,
    loadStoreTabData,
  };
}
