import { computed, ref } from "vue";
import { useCredentialVaultStore } from "~/stores/credentialVault";
import { useFormStore } from "~/stores/form";
import { useNotificationStore } from "~/stores/notifications";
import { useToastStore } from "~/stores/toast";
import type {
  ShopifyWebhookSubscription,
  WebhookConfigurationResponse,
  WebhookStoreStatusResponse,
  WebhookStreamTokenRotationResponse,
} from "~~/types/webhook";
import { getAppErrorMessage } from "~~/utils/error";
import { mapSettledWithConcurrency, settlePromise } from "~~/utils/promise-concurrency";
import { getStoreTokenState, resolveStoreAccessToken } from "~~/utils/shop-auth";

export interface WebhookStoreStatusView {
  storeId: string;
  status: WebhookStoreStatusResponse | null;
  error: string;
  loading: boolean;
}

const WEBHOOK_STATUS_CONCURRENCY = 3;

export function useWebhookSettings() {
  const credentialVault = useCredentialVaultStore();
  const formStore = useFormStore();
  const notificationStore = useNotificationStore();
  const toast = useToastStore();
  const { t } = useLocalization();
  const { requestConfirmation } = useConfirmDialog();
  const configuration = ref<WebhookConfigurationResponse | null>(null);
  const configurationError = ref("");
  const stores = ref<WebhookStoreStatusView[]>([]);
  const actionKey = ref("");
  const isRefreshing = ref(false);

  const configuredStoreCount = computed(
    () => stores.value.filter(({ status }) => Boolean(status && !status.error)).length,
  );

  async function refresh() {
    credentialVault.initialize();
    formStore.loadKnownStores();
    isRefreshing.value = true;
    configurationError.value = "";

    const candidates = formStore.knownStores.flatMap((storeId) => {
      const data = credentialVault.getStoreData(storeId);
      const token = resolveStoreAccessToken(data);
      return getStoreTokenState(data) === "valid" && token && data.clientSecret
        ? [{ storeId, token }]
        : [];
    });
    stores.value = candidates.map(({ storeId }) => ({
      storeId,
      status: null,
      error: "",
      loading: true,
    }));

    const [configResult, statusResults] = await Promise.all([
      settlePromise($fetch<WebhookConfigurationResponse>("/api/webhooks/config")),
      mapSettledWithConcurrency(
        candidates,
        WEBHOOK_STATUS_CONCURRENCY,
        ({ storeId, token }) =>
          $fetch<WebhookStoreStatusResponse>("/api/webhooks/status", {
            method: "POST",
            body: { storeId, token },
          }),
      ),
    ]);

    if (configResult.status === "fulfilled") {
      configuration.value = configResult.value;
    } else {
      configurationError.value = getAppErrorMessage(
        configResult.reason,
        "Webhook configuration diagnostics are unavailable.",
      );
    }
    stores.value = candidates.map(({ storeId }, index) => {
      const result = statusResults[index];
      return result?.status === "fulfilled"
        ? { storeId, status: result.value, error: "", loading: false }
        : {
            storeId,
            status: null,
            error: getAppErrorMessage(
              result?.status === "rejected" ? result.reason : null,
              "Webhook status is unavailable.",
            ),
            loading: false,
          };
    });
    isRefreshing.value = false;
  }

  async function synchronizeAndRefresh() {
    actionKey.value = "synchronize";
    try {
      await notificationStore.synchronize();
      await refresh();
      toast.success(t("webhook.syncSuccess"));
    } catch (error) {
      toast.error(getAppErrorMessage(error, t("webhook.syncFailed")));
    } finally {
      actionKey.value = "";
    }
  }

  async function testWebhook(storeId: string) {
    const token = resolveStoreAccessToken(credentialVault.getStoreData(storeId));
    if (!token) return;
    actionKey.value = `test:${storeId}`;
    try {
      await $fetch("/api/webhooks/test", {
        method: "POST",
        body: { storeId, token },
      });
      toast.success(t("webhook.testSuccess"));
    } catch (error) {
      toast.error(getAppErrorMessage(error, t("webhook.testFailed")));
    } finally {
      actionKey.value = "";
    }
  }

  async function removeSubscription(
    storeId: string,
    subscription: ShopifyWebhookSubscription,
  ) {
    const confirmed = await requestConfirmation({
      title: t("webhook.removeTitle"),
      message: t("webhook.removeMessage", {
        topic: subscription.topic,
        url: subscription.uri,
      }),
      confirmLabel: t("webhook.remove"),
    });
    if (!confirmed) return;

    const token = resolveStoreAccessToken(credentialVault.getStoreData(storeId));
    if (!token) return;
    actionKey.value = `delete:${subscription.id}`;
    try {
      await $fetch("/api/webhooks/subscription", {
        method: "DELETE",
        body: { storeId, token, subscriptionId: subscription.id },
      });
      await refresh();
      toast.success(t("webhook.removeSuccess"));
    } catch (error) {
      toast.error(getAppErrorMessage(error, t("webhook.removeFailed")));
    } finally {
      actionKey.value = "";
    }
  }

  async function rotateStreamToken(storeId: string) {
    const confirmed = await requestConfirmation({
      title: t("webhook.rotateTitle"),
      message: t("webhook.rotateMessage"),
      confirmLabel: t("webhook.rotate"),
    });
    if (!confirmed) return;

    const storeData = credentialVault.getStoreData(storeId);
    const token = resolveStoreAccessToken(storeData);
    const clientSecret = String(storeData.clientSecret || "").trim();
    if (!token || !clientSecret) return;
    actionKey.value = `rotate:${storeId}`;
    try {
      await $fetch<WebhookStreamTokenRotationResponse>(
        "/api/webhooks/stream-token/rotate",
        {
          method: "POST",
          body: { storeId, token, clientSecret },
        },
      );
      notificationStore.invalidateRegistration(storeId);
      await notificationStore.synchronize();
      await refresh();
      toast.success(t("webhook.rotateSuccess"));
    } catch (error) {
      toast.error(getAppErrorMessage(error, t("webhook.rotateFailed")));
    } finally {
      actionKey.value = "";
    }
  }

  return {
    actionKey,
    configuration,
    configurationError,
    configuredStoreCount,
    isRefreshing,
    stores,
    refresh,
    removeSubscription,
    rotateStreamToken,
    synchronizeAndRefresh,
    testWebhook,
  };
}
