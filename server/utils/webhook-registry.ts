import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import type { WebhookNotification } from "~~/types/webhook";

const MAX_NOTIFICATIONS_PER_SHOP = 100;
const MAX_DELIVERY_IDS_PER_SHOP = 500;

interface EncryptedValue {
  iv: string;
  tag: string;
  value: string;
}

interface StoredWebhookShop {
  storeId: string;
  shopDomain: string;
  encryptedClientSecret: EncryptedValue;
  encryptedStreamToken: EncryptedValue;
  updatedAt: string;
}

interface ResolvedWebhookShop {
  storeId: string;
  shopDomain: string;
  clientSecret: string;
  streamToken: string;
}

interface LiveSubscriber {
  shopDomains: Set<string>;
  publish: (notification: WebhookNotification) => void | Promise<void>;
}

const memoryShops = new Map<string, ResolvedWebhookShop>();
const subscribers = new Map<string, LiveSubscriber>();
const processingDeliveries = new Set<string>();
const shopQueues = new Map<string, Promise<void>>();

export async function upsertWebhookShop(input: {
  storeId: string;
  shopDomain: string;
  clientSecret: string;
  encryptionKey?: string;
}) {
  const existing = await getWebhookShop(input.shopDomain, input.encryptionKey);
  const streamToken = existing?.streamToken || randomBytes(32).toString("base64url");
  const shop: ResolvedWebhookShop = {
    storeId: input.storeId,
    shopDomain: input.shopDomain,
    clientSecret: input.clientSecret,
    streamToken,
  };
  memoryShops.set(input.shopDomain, shop);

  if (input.encryptionKey) {
    const stored: StoredWebhookShop = {
      storeId: shop.storeId,
      shopDomain: shop.shopDomain,
      encryptedClientSecret: encryptValue(shop.clientSecret, input.encryptionKey),
      encryptedStreamToken: encryptValue(shop.streamToken, input.encryptionKey),
      updatedAt: new Date().toISOString(),
    };
    await useStorage("webhooks").setItem(shopKey(shop.shopDomain), stored);
  }

  return shop;
}

export async function getWebhookShop(shopDomain: string, encryptionKey?: string) {
  const memoryShop = memoryShops.get(shopDomain);
  if (memoryShop) return memoryShop;
  if (!encryptionKey) return null;

  const stored = await useStorage("webhooks").getItem<StoredWebhookShop>(
    shopKey(shopDomain),
  );
  if (!stored) return null;

  try {
    const shop: ResolvedWebhookShop = {
      storeId: stored.storeId,
      shopDomain: stored.shopDomain,
      clientSecret: decryptValue(stored.encryptedClientSecret, encryptionKey),
      streamToken: decryptValue(stored.encryptedStreamToken, encryptionKey),
    };
    memoryShops.set(shopDomain, shop);
    return shop;
  } catch {
    return null;
  }
}

export function matchesWebhookStreamToken(expected: string, supplied: string) {
  const expectedHash = createHash("sha256").update(expected).digest();
  const suppliedHash = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(expectedHash, suppliedHash);
}

export async function claimWebhookDelivery(shopDomain: string, webhookId: string) {
  const key = `${shopDomain}:${webhookId}`;
  if (processingDeliveries.has(key)) return false;

  const storage = useStorage("webhooks");
  const deliveryIds =
    (await storage.getItem<string[]>(deliveryIndexKey(shopDomain))) || [];
  if (deliveryIds.includes(webhookId)) return false;

  processingDeliveries.add(key);
  return true;
}

export async function completeWebhookDelivery(shopDomain: string, webhookId: string) {
  const key = `${shopDomain}:${webhookId}`;
  const storage = useStorage("webhooks");
  const deliveryIds =
    (await storage.getItem<string[]>(deliveryIndexKey(shopDomain))) || [];
  const nextIds = [webhookId, ...deliveryIds.filter((id) => id !== webhookId)].slice(
    0,
    MAX_DELIVERY_IDS_PER_SHOP,
  );
  await storage.setItem(deliveryIndexKey(shopDomain), nextIds);
  processingDeliveries.delete(key);
}

export function releaseWebhookDelivery(shopDomain: string, webhookId: string) {
  processingDeliveries.delete(`${shopDomain}:${webhookId}`);
}

export async function withWebhookShopLock<T>(
  shopDomain: string,
  operation: () => Promise<T>,
) {
  const previous = shopQueues.get(shopDomain) || Promise.resolve();
  let release: () => void = () => {};
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  shopQueues.set(shopDomain, current);
  await previous;

  try {
    return await operation();
  } finally {
    release();
    if (shopQueues.get(shopDomain) === current) shopQueues.delete(shopDomain);
  }
}

export async function saveWebhookNotification(notification: WebhookNotification) {
  const storage = useStorage("webhooks");
  const existing =
    (await storage.getItem<WebhookNotification[]>(
      notificationsKey(notification.shopDomain),
    )) || [];
  const next = [
    notification,
    ...existing.filter((item) => item.id !== notification.id),
  ].slice(0, MAX_NOTIFICATIONS_PER_SHOP);
  await storage.setItem(notificationsKey(notification.shopDomain), next);
}

export async function getWebhookNotifications(shopDomains: Iterable<string>) {
  const storage = useStorage("webhooks");
  const lists = await Promise.all(
    [...shopDomains].map(
      async (shopDomain) =>
        (await storage.getItem<WebhookNotification[]>(notificationsKey(shopDomain))) ||
        [],
    ),
  );

  return lists
    .flat()
    .sort((left, right) => Date.parse(left.receivedAt) - Date.parse(right.receivedAt));
}

export function subscribeToWebhookNotifications(input: LiveSubscriber) {
  const id = randomUUID();
  subscribers.set(id, input);
  return () => subscribers.delete(id);
}

export function publishWebhookNotification(notification: WebhookNotification) {
  for (const subscriber of subscribers.values()) {
    if (!subscriber.shopDomains.has(notification.shopDomain)) continue;
    void Promise.resolve(subscriber.publish(notification)).catch(() => undefined);
  }
}

function encryptValue(value: string, encryptionKey: string): EncryptedValue {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(encryptionKey), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return {
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    value: encrypted.toString("base64"),
  };
}

function decryptValue(value: EncryptedValue, encryptionKey: string) {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    deriveKey(encryptionKey),
    Buffer.from(value.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(value.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(value.value, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function deriveKey(value: string) {
  return createHash("sha256").update(value).digest();
}

function shopKey(shopDomain: string) {
  return `shops:${shopDomain}`;
}

function deliveryIndexKey(shopDomain: string) {
  return `deliveries:${shopDomain}`;
}

function notificationsKey(shopDomain: string) {
  return `notifications:${shopDomain}`;
}
