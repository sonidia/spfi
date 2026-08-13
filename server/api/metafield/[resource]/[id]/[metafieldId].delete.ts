import { defineEventHandler, readBody } from "h3";
import {
  callShopifyApi,
  createApiErrorFromMessage,
} from "~~/server/utils/callShopifyApi";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";
import { isShopifyNumericId } from "~~/server/utils/shopify-id";
import {
  buildMetafieldPath,
  resolveMetafieldResource,
} from "~~/server/utils/shopify-metafields";

interface MetafieldDeleteBody {
  storeId?: string;
  token?: string;
}

export default defineEventHandler(async (event) => {
  const resource = resolveMetafieldResource(event.context.params?.resource);
  const ownerId = String(event.context.params?.id || "").trim();
  const metafieldId = String(event.context.params?.metafieldId || "").trim();
  const body = (await readBody<MetafieldDeleteBody>(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);

  if (!resource || !isShopifyNumericId(ownerId) || !isShopifyNumericId(metafieldId)) {
    throw createApiErrorFromMessage(
      "Resource, numeric owner ID, and numeric metafield ID are required.",
      400,
    );
  }

  return callShopifyApi<Record<string, never>>({
    event,
    storeId,
    token,
    method: "DELETE",
    path: buildMetafieldPath(resource, ownerId, metafieldId),
    missingProxyMessage: "Missing sock proxy for this store.",
  });
});
