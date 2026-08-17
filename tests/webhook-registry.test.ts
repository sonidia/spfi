import assert from "node:assert/strict";
import test from "node:test";
import {
  claimWebhookDelivery,
  completeWebhookDelivery,
  getWebhookNotifications,
  getWebhookShop,
  releaseWebhookDelivery,
  saveWebhookNotification,
  upsertWebhookShop,
  withWebhookShopLock,
} from "../server/utils/webhook-registry.ts";
import type { WebhookNotification } from "../types/webhook.ts";

const items = new Map<string, unknown>();
const storage = {
  async getItem<T>(key: string) {
    return (items.get(key) as T | undefined) ?? null;
  },
  async setItem(key: string, value: unknown) {
    items.set(key, structuredClone(value));
  },
  async removeItem(key: string) {
    items.delete(key);
  },
  async getKeys(base = "") {
    return [...items.keys()].filter((key) => key.startsWith(base));
  },
  async getItems<T>(keys: string[]) {
    return keys.map((key) => ({ key, value: items.get(key) as T }));
  },
};

Object.assign(globalThis, { useStorage: () => storage });

test("webhook delivery claims survive completion and distinguish active work", async () => {
  const shop = "claim-test.myshopify.com";
  assert.equal(await claimWebhookDelivery(shop, "delivery-1"), "claimed");
  assert.equal(await claimWebhookDelivery(shop, "delivery-1"), "busy");

  await releaseWebhookDelivery(shop, "delivery-1");
  assert.equal(await claimWebhookDelivery(shop, "delivery-1"), "claimed");
  await completeWebhookDelivery(shop, "delivery-1");
  assert.equal(await claimWebhookDelivery(shop, "delivery-1"), "duplicate");
});

test("webhook shop locks serialize work for one shop", async () => {
  const order: string[] = [];
  let releaseFirst = () => {};
  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });

  const first = withWebhookShopLock("lock-test.myshopify.com", async () => {
    order.push("first:start");
    await firstGate;
    order.push("first:end");
  });
  const second = withWebhookShopLock("lock-test.myshopify.com", async () => {
    order.push("second");
  });
  await Promise.resolve();
  assert.deepEqual(order, ["first:start"]);
  releaseFirst();
  await Promise.all([first, second]);
  assert.deepEqual(order, ["first:start", "first:end", "second"]);
});

test("webhook secrets are encrypted at rest and decrypt only with the right key", async () => {
  const key = "stable-deployment-key";
  const sourceDomain = "encrypted-source.myshopify.com";
  await upsertWebhookShop({
    storeId: "encrypted-source",
    shopDomain: sourceDomain,
    clientSecret: "shopify-client-secret",
    encryptionKey: key,
  });

  const stored = items.get(`shops:${sourceDomain}`);
  assert.ok(stored);
  assert.equal(JSON.stringify(stored).includes("shopify-client-secret"), false);

  const readableDomain = "encrypted-copy.myshopify.com";
  const readable = structuredClone(stored) as { shopDomain: string };
  readable.shopDomain = readableDomain;
  items.set(`shops:${readableDomain}`, readable);
  assert.equal(
    (await getWebhookShop(readableDomain, key))?.clientSecret,
    "shopify-client-secret",
  );

  const unreadableDomain = "encrypted-wrong-key.myshopify.com";
  const unreadable = structuredClone(stored) as { shopDomain: string };
  unreadable.shopDomain = unreadableDomain;
  items.set(`shops:${unreadableDomain}`, unreadable);
  assert.equal(await getWebhookShop(unreadableDomain, "rotated-key"), null);
});

test("notifications are idempotent per delivery ID", async () => {
  const notification = makeNotification("notification-test.myshopify.com");
  await saveWebhookNotification(notification);
  await saveWebhookNotification({ ...notification, status: "paid" });

  const stored = await getWebhookNotifications([notification.shopDomain]);
  assert.equal(stored.length, 1);
  assert.equal(stored[0]?.status, "paid");
});

test("item storage takes precedence over legacy notification arrays", async () => {
  const notification = makeNotification("notification-migration.myshopify.com");
  items.set(`notifications:${notification.shopDomain}`, [
    { ...notification, status: "legacy" },
  ]);
  await saveWebhookNotification({ ...notification, status: "current" });

  const stored = await getWebhookNotifications([notification.shopDomain]);
  assert.equal(stored.length, 1);
  assert.equal(stored[0]?.status, "current");
});

function makeNotification(shopDomain: string): WebhookNotification {
  return {
    id: "delivery-notification-1",
    webhookId: "delivery-notification-1",
    eventId: null,
    storeId: shopDomain.split(".")[0] || "shop",
    shopDomain,
    topic: "ORDERS_UPDATED",
    kind: "order",
    resourceId: "1001",
    orderId: "1001",
    orderName: "#1001",
    status: "updated",
    occurredAt: "2026-08-17T02:00:00.000Z",
    receivedAt: "2026-08-17T02:00:01.000Z",
  };
}
