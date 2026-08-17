export const SHOPIFY_WEBHOOK_TOPICS = [
  "ORDERS_CREATE",
  "ORDERS_UPDATED",
  "FULFILLMENTS_CREATE",
  "FULFILLMENTS_UPDATE",
  "REFUNDS_CREATE",
  "DISPUTES_CREATE",
  "DISPUTES_UPDATE",
  "PRODUCTS_CREATE",
  "PRODUCTS_UPDATE",
  "INVENTORY_LEVELS_UPDATE",
  "CUSTOMERS_CREATE",
] as const;

export type ShopifyWebhookTopic = (typeof SHOPIFY_WEBHOOK_TOPICS)[number];
export type WebhookNotificationKind =
  "order" | "fulfillment" | "refund" | "dispute" | "product" | "inventory" | "customer";

export type WebhookDeliveryStatus = "processing" | "succeeded" | "failed";

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
  webhookUrl: string | null;
  registeredTopics: ShopifyWebhookTopic[];
  warnings: string[];
  synchronizationError: string | null;
}

export interface ShopifyWebhookSubscription {
  id: string;
  topic: ShopifyWebhookTopic;
  uri: string;
  updatedAt: string;
  isCurrentCallback: boolean;
}

export interface WebhookDeliveryHealth {
  status: WebhookDeliveryStatus;
  attemptedAt: string;
  lastSucceededAt: string | null;
  lastFailedAt: string | null;
  webhookId: string;
  topic: ShopifyWebhookTopic;
  error: string | null;
}

export interface WebhookStoreStatusResponse {
  storeId: string;
  shopDomain: string;
  webhookUrl: string | null;
  subscriptions: ShopifyWebhookSubscription[];
  delivery: WebhookDeliveryHealth | null;
  error: string | null;
}

export interface WebhookConfigurationResponse {
  webhookUrl: string | null;
  publicUrlConfigured: boolean;
  usesRequestOrigin: boolean;
  explicitPublicUrlRecommended: boolean;
  encryptionKeyConfigured: boolean;
  encryptedShopCount: number;
  unreadableEncryptedShopCount: number;
  sharedStorageConfigured: boolean;
  error: string | null;
}
