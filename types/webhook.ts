export const SHOPIFY_WEBHOOK_TOPICS = [
  "ORDERS_CREATE",
  "ORDERS_UPDATED",
  "FULFILLMENTS_CREATE",
  "FULFILLMENTS_UPDATE",
] as const;

export type ShopifyWebhookTopic = (typeof SHOPIFY_WEBHOOK_TOPICS)[number];
export type WebhookNotificationKind = "order" | "fulfillment";

export interface WebhookNotification {
  id: string;
  webhookId: string;
  eventId: string | null;
  storeId: string;
  shopDomain: string;
  topic: ShopifyWebhookTopic;
  kind: WebhookNotificationKind;
  resourceId: string;
  orderId: string | null;
  orderName: string;
  status: string;
  occurredAt: string;
  receivedAt: string;
}

export interface ClientWebhookNotification extends WebhookNotification {
  read: boolean;
}

export interface WebhookStreamCredential {
  storeId: string;
  token: string;
}

export interface WebhookRegistrationResponse {
  storeId: string;
  shopDomain: string;
  streamToken: string;
  webhookUrl: string;
  registeredTopics: ShopifyWebhookTopic[];
  warnings: string[];
}
