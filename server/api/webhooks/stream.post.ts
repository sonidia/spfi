import { useRuntimeConfig } from "#imports";
import {
  createError,
  createEventStream,
  defineEventHandler,
  readBody,
  setResponseHeader,
} from "h3";
import {
  getWebhookNotifications,
  getWebhookShop,
  matchesWebhookStreamToken,
  subscribeToWebhookNotifications,
} from "~~/server/utils/webhook-registry";
import type { WebhookNotification, WebhookStreamCredential } from "~~/types/webhook";

interface StreamBody {
  subscriptions?: WebhookStreamCredential[];
}

const SHARED_STORAGE_POLL_INTERVAL_MS = 2_000;

export default defineEventHandler(async (event) => {
  const body = (await readBody<StreamBody>(event)) || {};
  const subscriptions = Array.isArray(body.subscriptions)
    ? body.subscriptions.slice(0, 100)
    : [];
  if (!subscriptions.length) {
    throw createError({ statusCode: 400, statusMessage: "Subscriptions required" });
  }

  const encryptionKey =
    String(useRuntimeConfig(event).webhookEncryptionKey || "").trim() || undefined;
  const shopDomains = new Set<string>();
  for (const subscription of subscriptions) {
    const storeId = String(subscription?.storeId || "").trim();
    const token = String(subscription?.token || "").trim();
    if (!storeId || !token) continue;

    const candidates = await Promise.all(
      [...new Set([storeId, `${storeId}.myshopify.com`])].map((candidate) =>
        getWebhookShop(candidate.toLowerCase(), encryptionKey),
      ),
    );
    const shop = candidates.find((item) => item?.storeId === storeId) || null;
    if (shop && matchesWebhookStreamToken(shop.streamToken, token)) {
      shopDomains.add(shop.shopDomain);
    }
  }

  if (!shopDomains.size) {
    throw createError({ statusCode: 401, statusMessage: "Invalid stream token" });
  }

  setResponseHeader(event, "X-Accel-Buffering", "no");
  const stream = createEventStream(event);
  const deliveredIds = new Set<string>();
  const pushNotification = (notification: WebhookNotification) => {
    if (deliveredIds.has(notification.id)) return Promise.resolve();
    deliveredIds.add(notification.id);
    return stream.push({
      id: notification.id,
      event: "notification",
      data: JSON.stringify(notification),
    });
  };
  const unsubscribe = subscribeToWebhookNotifications({
    shopDomains,
    publish: pushNotification,
  });
  let isPolling = false;
  const pollSharedStorage = async () => {
    if (isPolling) return;
    isPolling = true;
    try {
      for (const notification of await getWebhookNotifications(shopDomains)) {
        await pushNotification(notification);
      }
    } catch {
      // The local subscriber remains available while shared storage recovers.
    } finally {
      isPolling = false;
    }
  };
  const storagePoll = setInterval(
    () => void pollSharedStorage(),
    SHARED_STORAGE_POLL_INTERVAL_MS,
  );
  const keepAlive = setInterval(() => {
    void stream.push({ event: "keepalive", data: new Date().toISOString() });
  }, 15_000);

  stream.onClosed(() => {
    clearInterval(keepAlive);
    clearInterval(storagePoll);
    unsubscribe();
  });

  await stream.push({
    event: "connected",
    data: JSON.stringify({ stores: shopDomains.size }),
  });
  for (const notification of await getWebhookNotifications(shopDomains)) {
    await pushNotification(notification);
  }

  return stream.send();
});
