import { computed } from "vue";
import { useCredentialVaultStore } from "~/stores/credentialVault";
import { useFormStore } from "~/stores/form";

export function useActiveShopAuth() {
  const formStore = useFormStore();
  const credentialVault = useCredentialVaultStore();
  const storeId = computed(() => formStore.storeId);
  const token = computed(() => {
    if (!storeId.value) return "";
    const data = credentialVault.getStoreData(storeId.value);
    if (!data.accessToken) return "";
    if (data.expiresTime && Date.now() >= data.expiresTime) return "";
    return data.accessToken;
  });

  return {
    storeId,
    token,
    isReady: computed(() => Boolean(storeId.value && token.value)),
  };
}
