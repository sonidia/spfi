import { randomUUID } from "node:crypto";
import { useRuntimeConfig } from "#imports";
import { defineEventHandler, readBody } from "h3";
import {
  createApiErrorFromMessage,
  resolveStoreAdminDomain,
} from "~~/server/utils/callShopifyApi";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";
import {
  listShopifyWebhookSubscriptions,
  resolveWebhookCallbackUrl,
} from "~~/server/utils/shopify-webhook-subscriptions";
import {
  getWebhookShop,
  publishWebhookNotification,
  saveWebhookNotification,
} from "~~/server/utils/webhook-registry";
import { normalizeShopifyShopDomain } from "~~/server/utils/webhook-verification";
import type { WebhookNotification } from "~~/types/webhook";

interface TestWebhookBody {
  storeId?: string;
  token?: string;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<TestWebhookBody>(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);
  const config = useRuntimeConfig(event);
  const shopDomain = normalizeShopifyShopDomain(resolveStoreAdminDomain(storeId));
  if (!shopDomain) {
    throw createApiErrorFromMessage("A valid Shopify store ID is required.", 400);
  }
  const webhookUrl = resolveWebhookCallbackUrl(event, config.webhookPublicUrl);
  const subscriptions = await listShopifyWebhookSubscriptions({
    event,
    storeId,
    token,
    callbackUrl: webhookUrl,
  });
  if (!subscriptions.some(({ isCurrentCallback }) => isCurrentCallback)) {
    throw createApiErrorFromMessage(
      "No active webhook subscription uses the current callback URL.",
      409,
    );
  }

  const shop = await getWebhookShop(
    shopDomain,
    String(config.webhookEncryptionKey || "").trim() || undefined,
  );
  if (!shop || shop.storeId !== storeId) {
    throw createApiErrorFromMessage(
      "Register this store before testing its notification pipeline.",
      409,
    );
  }

  const now = new Date().toISOString();
  const webhookId = `test-${randomUUID()}`;
  const notification: WebhookNotification = {
    id: webhookId,
    webhookId,
    eventId: null,
    storeId,
    shopDomain,
    topic: "ORDERS_UPDATED",
    kind: "order",
    resourceId: webhookId,
    orderId: null,
    orderName: "Webhook pipeline test",
    status: "test",
    occurredAt: now,
    receivedAt: now,
  };
  await saveWebhookNotification(notification);
  publishWebhookNotification(notification);
  return { accepted: true, notification };
});
