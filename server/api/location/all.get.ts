import { defineEventHandler, getHeader, getQuery } from "h3";
import {
  callShopifyApi,
  createApiErrorFromMessage,
} from "~~/server/utils/callShopifyApi";
import {
  getFirstQueryValue,
  normalizeInventoryItemIds,
  normalizeLocationLimit,
} from "~~/server/utils/shopify-location-query";
import type {
  InventoryLevelsResponse,
  LocationsResponse,
} from "~~/types/shopify";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const storeId = getFirstQueryValue(query.storeId);
  const token =
    getFirstQueryValue(query.token) ||
    String(getHeader(event, "x-shopify-access-token") || "").trim();

  if (!storeId || !token) {
    throw createApiErrorFromMessage("Store ID and Access Token are required.", 400);
  }

  const limit = normalizeLocationLimit(query.limit);
  const inventoryItemIds = normalizeInventoryItemIds(
    query.inventory_item_ids || query.inventoryItemIds,
  );
  const locationsRequest = callShopifyApi<LocationsResponse>({
    event,
    storeId,
    token,
    path: "/locations.json",
    params: { limit },
  });

  if (inventoryItemIds.length === 0) {
    return locationsRequest;
  }

  const [locationsResponse, inventoryLevelsResponse] = await Promise.all([
    locationsRequest,
    callShopifyApi<InventoryLevelsResponse>({
      event,
      storeId,
      token,
      path: "/inventory_levels.json",
      params: {
        inventory_item_ids: inventoryItemIds.join(","),
        limit: 250,
      },
    }),
  ]);

  return {
    ...locationsResponse,
    inventory_levels: inventoryLevelsResponse.inventory_levels || [],
  };
});
