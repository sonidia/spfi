import { useRuntimeConfig } from "#imports";
import { defineEventHandler, readBody } from "h3";
import {
  createApiErrorFromMessage,
  resolveStoreAdminDomain,
} from "~~/server/utils/callShopifyApi";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";
import {
  inspectWebhookCallbackConfiguration,
  inspectShopifyWebhookSubscriptions,
} from "~~/server/utils/shopify-webhook-subscriptions";
import { getWebhookDeliveryHealth } from "~~/server/utils/webhook-registry";
import { normalizeShopifyShopDomain } from "~~/server/utils/webhook-verification";
import type { WebhookStoreStatusResponse } from "~~/types/webhook";

interface WebhookStatusBody {
  storeId?: string;
  token?: string;
}

export default defineEventHandler(
  async (event): Promise<WebhookStoreStatusResponse> => {
    const body = (await readBody<WebhookStatusBody>(event)) || {};
    const { storeId, token } = requireShopifyCredentials(body);
    const shopDomain = normalizeShopifyShopDomain(resolveStoreAdminDomain(storeId));
    if (!shopDomain) {
      throw createApiErrorFromMessage("A valid Shopify store ID is required.", 400);
    }
    const callbackInspection = inspectWebhookCallbackConfiguration(
      event,
      useRuntimeConfig(event).webhookPublicUrl,
    );
    const webhookUrl = callbackInspection.configuration?.callbackUrl || null;
    if (!webhookUrl) {
      const delivery = await getWebhookDeliveryHealth(shopDomain);
      return {
        storeId,
        shopDomain,
        webhookUrl,
        subscriptions: [],
        delivery,
        error: callbackInspection.error || "Webhook callback URL is invalid.",
      };
    }

    const [inspection, delivery] = await Promise.all([
      inspectShopifyWebhookSubscriptions({
        event,
        storeId,
        token,
        callbackUrl: webhookUrl,
      }),
      getWebhookDeliveryHealth(shopDomain),
    ]);

    return {
      storeId,
      shopDomain,
      webhookUrl,
      subscriptions: inspection.subscriptions,
      delivery,
      error: inspection.error,
    };
  },
);
