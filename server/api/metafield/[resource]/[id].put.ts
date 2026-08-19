import { defineEventHandler, readBody } from "h3";
import {
  callShopifyApi,
  createApiErrorFromMessage,
} from "~~/server/utils/callShopifyApi";
import { isShopifyNumericId } from "~~/server/utils/shopify-id";
import {
  buildMetafieldPath,
  resolveMetafieldResource,
} from "~~/server/utils/shopify-metafields";
import { serializeShopifyMetafieldValue } from "~~/server/utils/shopify-metafield-input";
import type { MetafieldsResponse } from "~~/types/shopify";
import type { ShopifyMetafieldValueInput } from "~~/types/shopify-product";

interface MetafieldUpdateBody {
  storeId?: string;
  token?: string;
  metafield?: {
    id?: string | number;
    value?: ShopifyMetafieldValueInput;
    type?: string;
  };
}

export default defineEventHandler(async (event) => {
  const resource = resolveMetafieldResource(event.context.params?.resource);
  const ownerId = String(event.context.params?.id || "").trim();
  const body = (await readBody<MetafieldUpdateBody>(event)) || {};
  const storeId = String(body.storeId || "").trim();
  const token = String(body.token || "").trim();
  const metafieldId = String(body.metafield?.id || "").trim();
  const rawValue = body.metafield?.value;
  const type = String(body.metafield?.type || "").trim();

  if (!resource) {
    throw createApiErrorFromMessage(
      "Resource must be product, order, or customer.",
      400,
    );
  }

  if (
    !isShopifyNumericId(ownerId) ||
    !isShopifyNumericId(metafieldId) ||
    !storeId ||
    !token
  ) {
    throw createApiErrorFromMessage(
      "Numeric Resource and Metafield IDs, Store ID and Access Token are required.",
      400,
    );
  }

  if (rawValue === undefined) {
    throw createApiErrorFromMessage("Metafield value is required.", 400);
  }
  const value = serializeShopifyMetafieldValue(rawValue);
  const metafield = {
    id: metafieldId,
    value,
    ...(type ? { type } : {}),
  };

  return callShopifyApi<MetafieldsResponse, { metafield: typeof metafield }>({
    event,
    storeId,
    token,
    path: buildMetafieldPath(resource, ownerId, metafieldId),
    method: "PUT",
    body: { metafield },
    missingProxyMessage: "Missing sock proxy for this store.",
  });
});
