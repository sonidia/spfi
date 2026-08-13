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
import type { MetafieldsResponse } from "~~/types/shopify";
import type { ShopifyMetafieldInput } from "~~/types/shopify-product";

interface MetafieldCreateBody {
  storeId?: string;
  token?: string;
  metafield?: ShopifyMetafieldInput;
}

export default defineEventHandler(async (event) => {
  const resource = resolveMetafieldResource(event.context.params?.resource);
  const ownerId = String(event.context.params?.id || "").trim();
  const body = (await readBody<MetafieldCreateBody>(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);
  const metafield = normalizeMetafield(body.metafield);

  if (!resource || !isShopifyNumericId(ownerId)) {
    throw createApiErrorFromMessage(
      "Resource must be product, order, or customer and the owner ID must be numeric.",
      400,
    );
  }
  if (!metafield) {
    throw createApiErrorFromMessage(
      "Metafield namespace, key, and type are required.",
      400,
    );
  }

  return callShopifyApi<MetafieldsResponse, { metafield: ShopifyMetafieldInput }>({
    event,
    storeId,
    token,
    method: "POST",
    path: buildMetafieldPath(resource, ownerId),
    body: { metafield },
    missingProxyMessage: "Missing sock proxy for this store.",
  });
});

function normalizeMetafield(input?: ShopifyMetafieldInput) {
  if (!input) return null;
  const metafield = {
    namespace: String(input.namespace || "").trim(),
    key: String(input.key || "").trim(),
    value: typeof input.value === "string" ? input.value : "",
    type: String(input.type || "").trim(),
    ...(typeof input.description === "string"
      ? { description: input.description.trim() || null }
      : {}),
  };
  return metafield.namespace && metafield.key && metafield.type ? metafield : null;
}
