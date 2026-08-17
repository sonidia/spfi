import { computed, ref, watch } from "vue";
import { defineStore } from "pinia";
import { useCredentialVaultStore } from "~/stores/credentialVault";
import { useDashboardStore } from "~/stores/dashboard";
import { useFormStore } from "~/stores/form";
import type {
  ClientWebhookNotification,
  WebhookNotification,
  WebhookRegistrationResponse,
  WebhookStreamCredential,
} from "~~/types/webhook";
import { SHOPIFY_WEBHOOK_TOPICS } from "~~/types/webhook";
import { getAppErrorMessage } from "~~/utils/error";
import { getStoreTokenState, resolveStoreAccessToken } from "~~/utils/shop-auth";
import { extractServerSentEvents } from "~~/utils/sse";

const NOTIFICATION_STORAGE_KEY = "spf_webhook_notifications";
const MAX_CLIENT_NOTIFICATIONS = 100;

type ConnectionState = "idle" | "registering" | "connecting" | "connected" | "error";

export const useNotificationStore = defineStore("notifications", () => {
  const formStore = useFormStore();
  const credentialVault = useCredentialVaultStore();
  const dashboardStore = useDashboardStore();
  const notifications = ref<ClientWebhookNotification[]>([]);
  const connectionState = ref<ConnectionState>("idle");
  const connectionError = ref("");
  const connectedStores = ref(0);
  const registrationWarnings = ref<string[]>([]);
  const isInitialized = ref(false);
  const unreadCount = computed(
    () => notifications.value.filter((notification) => !notification.read).length,
  );

  let streamController: AbortController | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let synchronizeTimer: ReturnType<typeof setTimeout> | null = null;
  let synchronizationSequence = 0;
  let reconnectAttempt = 0;
  let streamCredentials: WebhookStreamCredential[] = [];

  function initialize() {
    if (typeof window === "undefined" || isInitialized.value) return;
    isInitialized.value = true;
    loadStoredNotifications();
    formStore.loadKnownStores();
    credentialVault.initialize();

    watch(
      () => `${formStore.knownStores.join("|")}:${credentialVault.storeDataRevision}`,
      scheduleSynchronization,
    );
    void synchronize();
  }

  function scheduleSynchronization() {
    if (synchronizeTimer) clearTimeout(synchronizeTimer);
    synchronizeTimer = setTimeout(() => void synchronize(), 350);
  }

  async function synchronize() {
    if (typeof window === "undefined") return;
    const sequence = ++synchronizationSequence;
    stopStream();
    connectionError.value = "";
    registrationWarnings.value = [];
    connectedStores.value = 0;

    const candidates = formStore.knownStores.flatMap((storeId) => {
      const data = credentialVault.getStoreData(storeId);
      const token = resolveStoreAccessToken(data);
      const clientSecret = String(data.clientSecret || "").trim();
      return getStoreTokenState(data) === "valid" && token && clientSecret
        ? [{ storeId, token, clientSecret }]
        : [];
    });
    if (!candidates.length) {
      connectionState.value = "idle";
      return;
    }

    connectionState.value = "registering";
    const results = await Promise.allSettled(
      candidates.map(({ storeId, token, clientSecret }) =>
        $fetch<WebhookRegistrationResponse>("/api/webhooks/register", {
          method: "POST",
          body: { storeId, token, clientSecret },
        }),
      ),
    );
    if (sequence !== synchronizationSequence) return;

    const registrations = results.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    );
    registrationWarnings.value = registrations.flatMap((result) => result.warnings);
    if (!registrations.length) {
      connectionState.value = "error";
      connectionError.value = getRegistrationError(results);
      return;
    }

    streamCredentials = registrations.map((registration) => ({
      storeId: registration.storeId,
      token: registration.streamToken,
    }));
    connectedStores.value = registrations.length;
    reconnectAttempt = 0;
    void connectStream(sequence);
  }

  async function connectStream(sequence: number) {
    if (!streamCredentials.length || sequence !== synchronizationSequence) return;
    streamController = new AbortController();
    connectionState.value = "connecting";

    try {
      const response = await fetch("/api/webhooks/stream", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptions: streamCredentials }),
        signal: streamController.signal,
      });
      if (!response.ok || !response.body) {
        if (response.status === 401) {
          scheduleSynchronization();
          return;
        }
        throw new Error(`Notification stream returned HTTP ${response.status}.`);
      }

      await consumeStream(response.body, sequence);
      if (sequence === synchronizationSequence && !streamController.signal.aborted) {
        throw new Error("Notification stream closed unexpectedly.");
      }
    } catch (error) {
      if (isAbortError(error) || sequence !== synchronizationSequence) return;
      connectionState.value = "error";
      connectionError.value =
        error instanceof Error ? error.message : "Notification stream unavailable.";
      scheduleStreamReconnect(sequence);
    }
  }

  async function consumeStream(stream: ReadableStream<Uint8Array>, sequence: number) {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (sequence === synchronizationSequence) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const extracted = extractServerSentEvents(buffer);
        buffer = extracted.remainder;

        for (const event of extracted.events) {
          if (event.event === "connected") {
            reconnectAttempt = 0;
            connectionState.value = "connected";
            connectionError.value = "";
          } else if (event.event === "notification") {
            receiveNotification(event.data);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  function receiveNotification(serialized: string) {
    let notification: WebhookNotification;
    try {
      notification = JSON.parse(serialized) as WebhookNotification;
    } catch {
      return;
    }
    if (
      !notification?.id ||
      notifications.value.some((item) => item.id === notification.id)
    ) {
      return;
    }

    notifications.value = [
      { ...notification, read: false },
      ...notifications.value,
    ].slice(0, MAX_CLIENT_NOTIFICATIONS);
    persistNotifications();
    dashboardStore.refreshFromWebhook();
  }

  function markRead(id: string) {
    const notification = notifications.value.find((item) => item.id === id);
    if (!notification || notification.read) return;
    notification.read = true;
    persistNotifications();
  }

  function markAllRead() {
    let changed = false;
    for (const notification of notifications.value) {
      if (!notification.read) {
        notification.read = true;
        changed = true;
      }
    }
    if (changed) persistNotifications();
  }

  function clearNotifications() {
    notifications.value = [];
    persistNotifications();
  }

  function scheduleStreamReconnect(sequence: number) {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    const delay = Math.min(30_000, 1_000 * 2 ** reconnectAttempt++);
    reconnectTimer = setTimeout(() => void connectStream(sequence), delay);
  }

  function stopStream() {
    streamController?.abort();
    streamController = null;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  function loadStoredNotifications() {
    try {
      const parsed = JSON.parse(localStorage.getItem(NOTIFICATION_STORAGE_KEY) || "[]");
      if (Array.isArray(parsed)) {
        notifications.value = parsed
          .filter(isStoredNotification)
          .slice(0, MAX_CLIENT_NOTIFICATIONS) as ClientWebhookNotification[];
      }
    } catch {
      notifications.value = [];
    }
  }

  function persistNotifications() {
    if (typeof window === "undefined") return;
    localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(notifications.value));
  }

  return {
    notifications,
    unreadCount,
    connectionState,
    connectionError,
    connectedStores,
    registrationWarnings,
    isInitialized,
    initialize,
    synchronize,
    markRead,
    markAllRead,
    clearNotifications,
  };
});

function getRegistrationError(results: PromiseSettledResult<unknown>[]) {
  const rejected = results.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (!rejected) return "Webhook registration unavailable.";

  return getAppErrorMessage(rejected.reason, "Webhook registration unavailable.");
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function isStoredNotification(value: unknown): value is ClientWebhookNotification {
  if (!value || typeof value !== "object") return false;
  const notification = value as Partial<ClientWebhookNotification>;
  return (
    typeof notification.id === "string" &&
    typeof notification.storeId === "string" &&
    typeof notification.shopDomain === "string" &&
    typeof notification.occurredAt === "string" &&
    typeof notification.read === "boolean" &&
    SHOPIFY_WEBHOOK_TOPICS.includes(
      notification.topic as (typeof SHOPIFY_WEBHOOK_TOPICS)[number],
    )
  );
}
