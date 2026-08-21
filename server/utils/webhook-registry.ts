import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import type {
  ShopifyWebhookTopic,
  WebhookDeliveryHealth,
  WebhookDeliveryStatus,
  WebhookNotification,
} from "~~/types/webhook";
import {
  claimRedisWebhookDelivery,
  completeRedisWebhookDelivery,
  releaseRedisWebhookDelivery,
} from "./webhook-redis.ts";

const MAX_NOTIFICATIONS_PER_SHOP = 100;
const MAX_DELIVERY_RECORDS_PER_SHOP = 500;
const DELIVERY_CLAIM_TTL_MS = 2 * 60 * 1000;

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
  streamTokenVersion?: number;
  streamTokenIssuedAt?: string;
  streamTokenRotatedAt?: string | null;
  updatedAt: string;
}

interface ResolvedWebhookShop {
  storeId: string;
  shopDomain: string;
  clientSecret: string;
  streamToken: string;
  streamTokenVersion: number;
  streamTokenIssuedAt: string;
  streamTokenRotatedAt: string | null;
}

interface StoredDeliveryClaim {
  status: "processing" | "complete";
  owner: string;
  claimedAt: string;
  expiresAt: string | null;
  completedAt: string | null;
}

interface LiveSubscriber {
  shopDomains: Set<string>;
  publish: (notification: WebhookNotification) => void | Promise<void>;
  revoke?: (shopDomain: string) => void | Promise<void>;
}

export type WebhookDeliveryClaimResult = "claimed" | "duplicate" | "busy";

const memoryShops = new Map<string, ResolvedWebhookShop>();
const subscribers = new Map<string, LiveSubscriber>();
const localDeliveryOwners = new Map<string, string>();
const shopQueues = new Map<string, Promise<void>>();

export async function upsertWebhookShop(input: {
  storeId: string;
  shopDomain: string;
  clientSecret: string;
  encryptionKey?: string;
}) {
  const existing = await getWebhookShop(input.shopDomain, input.encryptionKey);
  const issuedAt = existing?.streamTokenIssuedAt || new Date().toISOString();
  const streamToken = existing?.streamToken || randomBytes(32).toString("base64url");
  const shop: ResolvedWebhookShop = {
    storeId: input.storeId,
    shopDomain: input.shopDomain,
    clientSecret: input.clientSecret,
    streamToken,
    streamTokenVersion: existing?.streamTokenVersion || 1,
    streamTokenIssuedAt: issuedAt,
    streamTokenRotatedAt: existing?.streamTokenRotatedAt || null,
  };
  if (input.encryptionKey) {
    const stored: StoredWebhookShop = {
      storeId: shop.storeId,
      shopDomain: shop.shopDomain,
      encryptedClientSecret: encryptValue(shop.clientSecret, input.encryptionKey),
      encryptedStreamToken: encryptValue(shop.streamToken, input.encryptionKey),
      streamTokenVersion: shop.streamTokenVersion,
      streamTokenIssuedAt: shop.streamTokenIssuedAt,
      streamTokenRotatedAt: shop.streamTokenRotatedAt,
      updatedAt: new Date().toISOString(),
    };
    await webhookStorage().setItem(shopKey(shop.shopDomain), stored);
  }
  memoryShops.set(input.shopDomain, shop);

  return shop;
}

export async function getWebhookShop(shopDomain: string, encryptionKey?: string) {
  const memoryShop = memoryShops.get(shopDomain);
  if (memoryShop) return memoryShop;
  if (!encryptionKey) return null;

  const stored = await webhookStorage().getItem<StoredWebhookShop>(shopKey(shopDomain));
  if (!stored) return null;

  try {
    const shop: ResolvedWebhookShop = {
      storeId: stored.storeId,
      shopDomain: stored.shopDomain,
      clientSecret: decryptValue(stored.encryptedClientSecret, encryptionKey),
      streamToken: decryptValue(stored.encryptedStreamToken, encryptionKey),
      streamTokenVersion: stored.streamTokenVersion || 1,
      streamTokenIssuedAt: stored.streamTokenIssuedAt || stored.updatedAt,
      streamTokenRotatedAt: stored.streamTokenRotatedAt || null,
    };
    memoryShops.set(shopDomain, shop);
    return shop;
  } catch {
    return null;
  }
}

export async function rotateWebhookStreamToken(input: {
  shopDomain: string;
  encryptionKey?: string;
}) {
  const existing = await getWebhookShop(input.shopDomain, input.encryptionKey);
  if (!existing) return null;

  const rotatedAt = new Date().toISOString();
  const rotated: ResolvedWebhookShop = {
    ...existing,
    streamToken: randomBytes(32).toString("base64url"),
    streamTokenVersion: existing.streamTokenVersion + 1,
    streamTokenIssuedAt: rotatedAt,
    streamTokenRotatedAt: rotatedAt,
  };
  if (input.encryptionKey) {
    await webhookStorage().setItem(shopKey(rotated.shopDomain), {
      storeId: rotated.storeId,
      shopDomain: rotated.shopDomain,
      encryptedClientSecret: encryptValue(rotated.clientSecret, input.encryptionKey),
      encryptedStreamToken: encryptValue(rotated.streamToken, input.encryptionKey),
      streamTokenVersion: rotated.streamTokenVersion,
      streamTokenIssuedAt: rotated.streamTokenIssuedAt,
      streamTokenRotatedAt: rotated.streamTokenRotatedAt,
      updatedAt: rotatedAt,
    } satisfies StoredWebhookShop);
  }
  memoryShops.set(rotated.shopDomain, rotated);
  revokeWebhookSubscribers(rotated.shopDomain);
  return rotated;
}

export async function removeWebhookShop(shopDomain: string) {
  const storage = webhookStorage();
  const prefixes = [notificationPrefix(shopDomain), deliveryPrefix(shopDomain)];
  const keys = (
    await Promise.all(prefixes.map((prefix) => storage.getKeys(prefix)))
  ).flat();
  await storage.removeItem(shopKey(shopDomain));
  memoryShops.delete(shopDomain);
  await Promise.allSettled([
    storage.removeItem(legacyNotificationsKey(shopDomain)),
    storage.removeItem(deliveryHealthKey(shopDomain)),
    ...keys.map((key) => storage.removeItem(key)),
  ]);
  for (const key of localDeliveryOwners.keys()) {
    if (key.startsWith(`${shopDomain}:`)) localDeliveryOwners.delete(key);
  }
  revokeWebhookSubscribers(shopDomain);
}

export async function inspectWebhookEncryption(encryptionKey?: string) {
  const storage = webhookStorage();
  const keys = await storage.getKeys("shops:");
  if (!encryptionKey) {
    return {
      encryptedShopCount: keys.length,
      unreadableEncryptedShopCount: keys.length,
    };
  }

  let unreadableEncryptedShopCount = 0;
  for (const key of keys) {
    const stored = await storage.getItem<StoredWebhookShop>(key);
    if (!stored) continue;
    try {
      decryptValue(stored.encryptedClientSecret, encryptionKey);
      decryptValue(stored.encryptedStreamToken, encryptionKey);
    } catch {
      unreadableEncryptedShopCount += 1;
    }
  }

  return {
    encryptedShopCount: keys.length,
    unreadableEncryptedShopCount,
  };
}

export function matchesWebhookStreamToken(expected: string, supplied: string) {
  const expectedHash = createHash("sha256").update(expected).digest();
  const suppliedHash = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(expectedHash, suppliedHash);
}

export const matchesWebhookClientSecret = matchesWebhookStreamToken;

export async function claimWebhookDelivery(
  shopDomain: string,
  webhookId: string,
  now = new Date(),
): Promise<WebhookDeliveryClaimResult> {
  const runtimeKey = `${shopDomain}:${webhookId}`;
  if (localDeliveryOwners.has(runtimeKey)) return "busy";

  const storage = webhookStorage();
  const key = deliveryKey(shopDomain, webhookId);
  const existing = await storage.getItem<StoredDeliveryClaim>(key);
  if (existing?.status === "complete") return "duplicate";
  if (
    existing?.status === "processing" &&
    Date.parse(existing.expiresAt || "") > now.getTime()
  ) {
    return "busy";
  }

  const owner = randomUUID();
  const claim: StoredDeliveryClaim = {
    status: "processing",
    owner,
    claimedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + DELIVERY_CLAIM_TTL_MS).toISOString(),
    completedAt: null,
  };
  const redisResult = await claimRedisWebhookDelivery({
    key,
    claim,
    nowMs: now.getTime(),
    ttlMs: DELIVERY_CLAIM_TTL_MS,
  });
  if (redisResult) {
    if (redisResult === "claimed") localDeliveryOwners.set(runtimeKey, owner);
    return redisResult;
  }

  await storage.setItem(key, claim);

  // Confirm ownership after the write. This is portable across Nitro storage
  // drivers and narrows the race window when several instances share storage.
  const confirmed = await storage.getItem<StoredDeliveryClaim>(key);
  if (confirmed?.owner !== owner || confirmed.status !== "processing") return "busy";

  localDeliveryOwners.set(runtimeKey, owner);
  return "claimed";
}

export async function completeWebhookDelivery(
  shopDomain: string,
  webhookId: string,
  now = new Date(),
) {
  const runtimeKey = `${shopDomain}:${webhookId}`;
  const owner = localDeliveryOwners.get(runtimeKey);
  if (!owner) return;

  const storage = webhookStorage();
  const key = deliveryKey(shopDomain, webhookId);
  const completedAt = now.toISOString();
  const redisResult = await completeRedisWebhookDelivery({
    key,
    owner,
    completedAt,
  });
  if (redisResult !== null) {
    localDeliveryOwners.delete(runtimeKey);
    if (redisResult) await pruneDeliveryRecords(shopDomain);
    return;
  }

  const existing = await storage.getItem<StoredDeliveryClaim>(key);
  if (existing?.status === "processing" && existing.owner !== owner) {
    localDeliveryOwners.delete(runtimeKey);
    return;
  }
  await storage.setItem(key, {
    status: "complete",
    owner,
    claimedAt: existing?.claimedAt || completedAt,
    expiresAt: null,
    completedAt,
  } satisfies StoredDeliveryClaim);
  localDeliveryOwners.delete(runtimeKey);
  await pruneDeliveryRecords(shopDomain);
}

export async function releaseWebhookDelivery(shopDomain: string, webhookId: string) {
  const runtimeKey = `${shopDomain}:${webhookId}`;
  const owner = localDeliveryOwners.get(runtimeKey);
  localDeliveryOwners.delete(runtimeKey);
  if (!owner) return;

  const storage = webhookStorage();
  const key = deliveryKey(shopDomain, webhookId);
  const redisResult = await releaseRedisWebhookDelivery({ key, owner });
  if (redisResult !== null) return;

  const stored = await storage.getItem<StoredDeliveryClaim>(key);
  if (stored?.status === "processing" && stored.owner === owner) {
    await storage.removeItem(key);
  }
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
  const storage = webhookStorage();
  await storage.setItem(
    notificationKey(notification.shopDomain, notification.id),
    notification,
  );
  await pruneNotifications(notification.shopDomain);
}

export async function getWebhookNotifications(shopDomains: Iterable<string>) {
  const lists = await Promise.all(
    [...shopDomains].map((shopDomain) => getShopNotifications(shopDomain)),
  );
  const unique = new Map<string, WebhookNotification>();
  for (const notification of lists.flat()) unique.set(notification.id, notification);

  return [...unique.values()].sort(
    (left, right) => Date.parse(left.receivedAt) - Date.parse(right.receivedAt),
  );
}

export async function recordWebhookDeliveryHealth(input: {
  shopDomain: string;
  webhookId: string;
  topic: ShopifyWebhookTopic;
  status: WebhookDeliveryStatus;
  error?: string | null;
  now?: Date;
}) {
  const storage = webhookStorage();
  const previous = await getWebhookDeliveryHealth(input.shopDomain);
  const attemptedAt = (input.now || new Date()).toISOString();
  const health: WebhookDeliveryHealth = {
    status: input.status,
    attemptedAt,
    lastSucceededAt:
      input.status === "succeeded" ? attemptedAt : previous?.lastSucceededAt || null,
    lastFailedAt:
      input.status === "failed" ? attemptedAt : previous?.lastFailedAt || null,
    webhookId: input.webhookId,
    topic: input.topic,
    error: input.status === "failed" ? sanitizeHealthError(input.error) : null,
  };
  await storage.setItem(deliveryHealthKey(input.shopDomain), health);
  return health;
}

export function getWebhookDeliveryHealth(shopDomain: string) {
  return webhookStorage().getItem<WebhookDeliveryHealth>(deliveryHealthKey(shopDomain));
}

export function subscribeToWebhookNotifications(input: LiveSubscriber) {
  const id = randomUUID();
  subscribers.set(id, input);
  return () => subscribers.delete(id);
}

export function publishWebhookNotification(notification: WebhookNotification) {
  const pending: Promise<void>[] = [];
  for (const subscriber of subscribers.values()) {
    if (!subscriber.shopDomains.has(notification.shopDomain)) continue;
    pending.push(
      Promise.resolve(subscriber.publish(notification)).catch(() => undefined),
    );
  }
  return Promise.all(pending).then(() => undefined);
}

function revokeWebhookSubscribers(shopDomain: string) {
  for (const subscriber of subscribers.values()) {
    if (!subscriber.shopDomains.has(shopDomain)) continue;
    void Promise.resolve(subscriber.revoke?.(shopDomain)).catch(() => undefined);
  }
}

async function getShopNotifications(shopDomain: string) {
  const storage = webhookStorage();
  const keys = await storage.getKeys(notificationPrefix(shopDomain));
  const storedItems = keys.length
    ? await storage.getItems<WebhookNotification>(keys)
    : [];
  const legacy =
    (await storage.getItem<WebhookNotification[]>(
      legacyNotificationsKey(shopDomain),
    )) || [];
  return [
    ...legacy.filter(isWebhookNotification),
    ...storedItems.map(({ value }) => value).filter(isWebhookNotification),
  ];
}

async function pruneNotifications(shopDomain: string) {
  const storage = webhookStorage();
  const keys = await storage.getKeys(notificationPrefix(shopDomain));
  if (keys.length <= MAX_NOTIFICATIONS_PER_SHOP) return;

  const items = await storage.getItems<WebhookNotification>(keys);
  const staleKeys = items
    .filter(({ value }) => isWebhookNotification(value))
    .sort(
      (left, right) =>
        Date.parse(right.value.receivedAt) - Date.parse(left.value.receivedAt),
    )
    .slice(MAX_NOTIFICATIONS_PER_SHOP)
    .map(({ key }) => key);
  await Promise.all(staleKeys.map((key) => storage.removeItem(key)));
}

async function pruneDeliveryRecords(shopDomain: string) {
  const storage = webhookStorage();
  const keys = await storage.getKeys(deliveryPrefix(shopDomain));
  if (keys.length <= MAX_DELIVERY_RECORDS_PER_SHOP) return;

  const records = await storage.getItems<StoredDeliveryClaim>(keys);
  const staleKeys = records
    .filter(({ value }) => value?.status === "complete")
    .sort(
      (left, right) =>
        Date.parse(right.value.completedAt || "") -
        Date.parse(left.value.completedAt || ""),
    )
    .slice(MAX_DELIVERY_RECORDS_PER_SHOP)
    .map(({ key }) => key);
  await Promise.all(staleKeys.map((key) => storage.removeItem(key)));
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

function webhookStorage() {
  return useStorage("webhooks");
}

function isWebhookNotification(value: unknown): value is WebhookNotification {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof (value as WebhookNotification).id === "string" &&
    typeof (value as WebhookNotification).receivedAt === "string",
  );
}

function sanitizeHealthError(value: unknown) {
  const normalized = String(value || "Webhook processing failed.")
    .replace(/[\r\n\t]+/g, " ")
    .trim();
  return normalized.slice(0, 300) || "Webhook processing failed.";
}

function safeKeyPart(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function shopKey(shopDomain: string) {
  return `shops:${shopDomain}`;
}

function deliveryPrefix(shopDomain: string) {
  return `delivery-records:${shopDomain}:`;
}

function deliveryKey(shopDomain: string, webhookId: string) {
  return `${deliveryPrefix(shopDomain)}${safeKeyPart(webhookId)}`;
}

function notificationPrefix(shopDomain: string) {
  return `notification-items:${shopDomain}:`;
}

function notificationKey(shopDomain: string, notificationId: string) {
  return `${notificationPrefix(shopDomain)}${safeKeyPart(notificationId)}`;
}

function legacyNotificationsKey(shopDomain: string) {
  return `notifications:${shopDomain}`;
}

function deliveryHealthKey(shopDomain: string) {
  return `delivery-health:${shopDomain}`;
}
