import { useRuntimeConfig } from "#imports";
import { defineEventHandler } from "h3";
import { inspectWebhookCallbackConfiguration } from "~~/server/utils/shopify-webhook-subscriptions";
import { inspectWebhookEncryption } from "~~/server/utils/webhook-registry";
import type { WebhookConfigurationResponse } from "~~/types/webhook";

export default defineEventHandler(
  async (event): Promise<WebhookConfigurationResponse> => {
    const config = useRuntimeConfig(event);
    const encryptionKey = String(config.webhookEncryptionKey || "").trim();
    const encryption = await inspectWebhookEncryption(encryptionKey || undefined);

    const inspection = inspectWebhookCallbackConfiguration(
      event,
      config.webhookPublicUrl,
    );
    const callback = inspection.configuration;
    if (callback) {
      return {
        webhookUrl: callback.callbackUrl,
        publicUrlConfigured: callback.publicUrlConfigured,
        usesRequestOrigin: callback.usesRequestOrigin,
        explicitPublicUrlRecommended: callback.explicitPublicUrlRecommended,
        encryptionKeyConfigured: Boolean(encryptionKey),
        ...encryption,
        sharedStorageConfigured: Boolean(
          String(process.env.NITRO_WEBHOOK_REDIS_URL || "").trim(),
        ),
        error: null,
      };
    }

    return {
      webhookUrl: null,
      publicUrlConfigured: Boolean(String(config.webhookPublicUrl || "").trim()),
      usesRequestOrigin: false,
      explicitPublicUrlRecommended: true,
      encryptionKeyConfigured: Boolean(encryptionKey),
      ...encryption,
      sharedStorageConfigured: Boolean(
        String(process.env.NITRO_WEBHOOK_REDIS_URL || "").trim(),
      ),
      error: inspection.error || "Webhook configuration is invalid.",
    };
  },
);
