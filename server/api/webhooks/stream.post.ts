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
  const pushNotification = (notification: WebhookNotification) =>
    stream.push({
      id: notification.id,
      event: "notification",
      data: JSON.stringify(notification),
    });
  const unsubscribe = subscribeToWebhookNotifications({
    shopDomains,
    publish: pushNotification,
  });
  const keepAlive = setInterval(() => {
    void stream.push({ event: "keepalive", data: new Date().toISOString() });
  }, 15_000);

  stream.onClosed(() => {
    clearInterval(keepAlive);
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
