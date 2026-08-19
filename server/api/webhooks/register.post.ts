import { useRuntimeConfig } from "#imports";
import { defineEventHandler, readBody } from "h3";
import { createApiErrorFromMessage } from "~~/server/utils/callShopifyApi";
import { resolveStoreAdminDomain } from "~~/server/utils/callShopifyApi";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";
import {
  inspectWebhookCallbackConfiguration,
  synchronizeShopifyWebhookSubscriptions,
} from "~~/server/utils/shopify-webhook-subscriptions";
import { upsertWebhookShop } from "~~/server/utils/webhook-registry";
import { normalizeShopifyShopDomain } from "~~/server/utils/webhook-verification";
import type { WebhookRegistrationResponse } from "~~/types/webhook";

interface RegisterWebhookBody {
  storeId?: string;
  token?: string;
  clientSecret?: string;
}

export default defineEventHandler(
  async (event): Promise<WebhookRegistrationResponse> => {
    const body = (await readBody<RegisterWebhookBody>(event)) || {};
    const { storeId, token } = requireShopifyCredentials(body);
    const clientSecret = String(body.clientSecret || "").trim();
    if (!clientSecret || clientSecret.length > 512) {
      throw createApiErrorFromMessage(
        "A valid Shopify client secret is required.",
        400,
      );
    }

    const config = useRuntimeConfig(event);
    const shopDomain = normalizeShopifyShopDomain(resolveStoreAdminDomain(storeId));
    if (!shopDomain) {
      throw createApiErrorFromMessage("A valid Shopify store ID is required.", 400);
    }

    const callbackInspection = inspectWebhookCallbackConfiguration(
      event,
      config.webhookPublicUrl,
    );
    const callbackUrl = callbackInspection.configuration?.callbackUrl || null;
    if (!callbackUrl) {
      throw createApiErrorFromMessage(
        callbackInspection.error || "Webhook callback URL is invalid.",
        503,
      );
    }

    const result = await synchronizeShopifyWebhookSubscriptions({
      event,
      storeId,
      token,
      callbackUrl,
    });
    if (result.error) {
      throw createApiErrorFromMessage(result.error, 502);
    }
    // Persist credentials only after Shopify has authenticated the access token
    // and accepted at least one managed subscription.
    const shop = await upsertWebhookShop({
      storeId,
      shopDomain,
      clientSecret,
      encryptionKey: String(config.webhookEncryptionKey || "").trim() || undefined,
    });

    return {
      storeId,
      shopDomain,
      streamToken: shop.streamToken,
      webhookUrl: callbackUrl,
      registeredTopics: result.registeredTopics,
      warnings: result.warnings,
      synchronizationError: null,
      streamTokenVersion: shop.streamTokenVersion,
      streamTokenIssuedAt: shop.streamTokenIssuedAt,
      streamTokenRotatedAt: shop.streamTokenRotatedAt,
    };
  },
);
