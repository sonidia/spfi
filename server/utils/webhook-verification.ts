import { createHmac, timingSafeEqual } from "node:crypto";
import type { WebhookNotification, ShopifyWebhookTopic } from "~~/types/webhook";

const HEADER_TOPIC_MAP: Record<string, ShopifyWebhookTopic> = {
  "orders/create": "ORDERS_CREATE",
  "orders/updated": "ORDERS_UPDATED",
  "fulfillments/create": "FULFILLMENTS_CREATE",
  "fulfillments/update": "FULFILLMENTS_UPDATE",
};

interface NotificationInput {
  webhookId: string;
  eventId?: string;
  storeId: string;
  shopDomain: string;
  topic: ShopifyWebhookTopic;
  triggeredAt?: string;
  payload: Record<string, unknown>;
  now?: Date;
}

export function verifyShopifyWebhookHmac(
  rawBody: Buffer,
  signature: string,
  clientSecret: string,
) {
  const supplied = decodeSignature(signature);
  if (!supplied) return false;

  const expected = createHmac("sha256", clientSecret).update(rawBody).digest();
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function resolveShopifyWebhookTopic(value: string) {
  return (
    HEADER_TOPIC_MAP[
      String(value || "")
        .trim()
        .toLowerCase()
    ] || null
  );
}

export function normalizeShopifyShopDomain(value: string) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(normalized) ? normalized : "";
}

export function buildWebhookNotification({
  webhookId,
  eventId,
  storeId,
  shopDomain,
  topic,
  triggeredAt,
  payload,
  now = new Date(),
}: NotificationInput): WebhookNotification {
  const isFulfillment = topic.startsWith("FULFILLMENTS_");
  const resourceId = readScalar(payload.id);
  const orderId = isFulfillment
    ? readScalar(payload.order_id) || null
    : resourceId || null;
  const orderName =
    readScalar(payload.name) ||
    (orderId ? `#${orderId}` : isFulfillment ? "Fulfillment" : "Order");
  const status = isFulfillment
    ? readScalar(payload.shipment_status) || readScalar(payload.status)
    : readScalar(payload.fulfillment_status) || readScalar(payload.financial_status);

  return {
    id: webhookId,
    webhookId,
    eventId: String(eventId || "").trim() || null,
    storeId,
    shopDomain,
    topic,
    kind: isFulfillment ? "fulfillment" : "order",
    resourceId: resourceId || orderId || webhookId,
    orderId,
    orderName,
    status: status || "updated",
    occurredAt:
      firstValidIsoDate(
        triggeredAt,
        readScalar(payload.updated_at),
        readScalar(payload.created_at),
      ) || now.toISOString(),
    receivedAt: now.toISOString(),
  };
}

function decodeSignature(value: string) {
  const normalized = String(value || "").trim();
  if (!/^[A-Za-z0-9+/]{43}=$/.test(normalized)) return null;

  const decoded = Buffer.from(normalized, "base64");
  return decoded.length === 32 ? decoded : null;
}

function readScalar(value: unknown) {
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }
  return "";
}

function firstValidIsoDate(...values: Array<string | undefined>) {
  for (const value of values) {
    if (!value) continue;
    const timestamp = Date.parse(value);
    if (Number.isFinite(timestamp)) return new Date(timestamp).toISOString();
  }
  return "";
}
