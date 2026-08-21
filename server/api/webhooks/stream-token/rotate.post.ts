import { useRuntimeConfig } from "#imports";
import { defineEventHandler, readBody } from "h3";
import {
  createApiErrorFromMessage,
  resolveStoreAdminDomain,
} from "~~/server/utils/callShopifyApi";
import { callShopifyGraphql } from "~~/server/utils/callShopifyGraphql";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";
import {
  getWebhookShop,
  matchesWebhookClientSecret,
  rotateWebhookStreamToken,
} from "~~/server/utils/webhook-registry";
import { normalizeShopifyShopDomain } from "~~/server/utils/webhook-verification";
import type { WebhookStreamTokenRotationResponse } from "~~/types/webhook";

interface RotateStreamTokenBody {
  storeId?: string;
  token?: string;
  clientSecret?: string;
}

export default defineEventHandler(
  async (event): Promise<WebhookStreamTokenRotationResponse> => {
    const body = (await readBody<RotateStreamTokenBody>(event)) || {};
    const { storeId, token } = requireShopifyCredentials(body);
    const clientSecret = String(body.clientSecret || "").trim();
    if (!clientSecret || clientSecret.length > 512) {
      throw createApiErrorFromMessage(
        "A valid Shopify client secret is required.",
        400,
      );
    }

    const shopDomain = normalizeShopifyShopDomain(resolveStoreAdminDomain(storeId));
    if (!shopDomain) {
      throw createApiErrorFromMessage("A valid Shopify store ID is required.", 400);
    }
    const encryptionKey =
      String(useRuntimeConfig(event).webhookEncryptionKey || "").trim() || undefined;
    const registeredShop = await getWebhookShop(shopDomain, encryptionKey);
    if (
      !registeredShop ||
      registeredShop.storeId !== storeId ||
      !matchesWebhookClientSecret(registeredShop.clientSecret, clientSecret)
    ) {
      throw createApiErrorFromMessage(
        "Webhook registration credentials do not match this store.",
        403,
      );
    }

    await callShopifyGraphql<{ shop: { id: string } }>({
      event,
      storeId,
      token,
      operationName: "VerifyWebhookStreamTokenRotation",
      query: `#graphql
        query VerifyWebhookStreamTokenRotation {
          shop { id }
        }
      `,
    });
    const rotated = await rotateWebhookStreamToken({ shopDomain, encryptionKey });
    if (!rotated) {
      throw createApiErrorFromMessage(
        "Register this store before rotating its stream token.",
        409,
      );
    }

    return {
      storeId,
      shopDomain,
      streamToken: rotated.streamToken,
      streamTokenVersion: rotated.streamTokenVersion,
      streamTokenIssuedAt: rotated.streamTokenIssuedAt,
      streamTokenRotatedAt: rotated.streamTokenRotatedAt || rotated.streamTokenIssuedAt,
    };
  },
);
