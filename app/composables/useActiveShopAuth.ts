import { computed } from "vue";
import { useCredentialVaultStore } from "~/stores/credentialVault";
import { useFormStore } from "~/stores/form";
import { resolveStoreAccessToken } from "~~/utils/shop-auth";

export function useActiveShopAuth() {
  const formStore = useFormStore();
  const credentialVault = useCredentialVaultStore();
  const storeId = computed(() => formStore.storeId);
  const token = computed(() => {
    if (!storeId.value) return "";
    return resolveStoreAccessToken(credentialVault.getStoreData(storeId.value));
  });

  return {
    storeId,
    token,
    isReady: computed(() => Boolean(storeId.value && token.value)),
  };
}
