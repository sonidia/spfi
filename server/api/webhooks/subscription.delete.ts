import { defineEventHandler, readBody } from "h3";
import { createApiErrorFromMessage } from "~~/server/utils/callShopifyApi";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";
import { deleteShopifyWebhookSubscription } from "~~/server/utils/shopify-webhook-subscriptions";

interface DeleteWebhookBody {
  storeId?: string;
  token?: string;
  subscriptionId?: string;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<DeleteWebhookBody>(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);
  const subscriptionId = String(body.subscriptionId || "").trim();
  if (!/^gid:\/\/shopify\/WebhookSubscription\/\d+$/.test(subscriptionId)) {
    throw createApiErrorFromMessage(
      "A valid Shopify webhook subscription ID is required.",
      400,
    );
  }

  return deleteShopifyWebhookSubscription({
    event,
    storeId,
    token,
    subscriptionId,
  });
});
