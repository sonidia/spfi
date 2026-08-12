import { defineEventHandler, getQuery } from "h3";
import { callShopifyPaginatedApi } from "~~/server/utils/callShopifyPaginatedApi";
import { getShopifyQueryCredentials } from "~~/server/utils/shopify-admin-request";
import {
  chunkInventoryItemIds,
  normalizeInventoryItemIds,
  normalizeLocationLimit,
} from "~~/server/utils/shopify-location-query";
import type { InventoryLevelsResponse, LocationsResponse } from "~~/types/shopify";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const { storeId, token } = getShopifyQueryCredentials(event);

  const limit = normalizeLocationLimit(query.limit);
  const inventoryItemIds = normalizeInventoryItemIds(
    query.inventory_item_ids || query.inventoryItemIds,
  );
  const locationsRequest = callShopifyPaginatedApi<
    NonNullable<LocationsResponse["locations"]>[number]
  >({
    event,
    storeId,
    token,
    path: "/locations.json",
    resourceKey: "locations",
    params: { limit },
  });

  if (inventoryItemIds.length === 0) {
    return { locations: await locationsRequest };
  }

  const [locations, inventoryLevelPages] = await Promise.all([
    locationsRequest,
    Promise.all(
      chunkInventoryItemIds(inventoryItemIds).map((ids) =>
        callShopifyPaginatedApi<
          NonNullable<InventoryLevelsResponse["inventory_levels"]>[number]
        >({
          event,
          storeId,
          token,
          path: "/inventory_levels.json",
          resourceKey: "inventory_levels",
          params: { inventory_item_ids: ids.join(",") },
        }),
      ),
    ),
  ]);

  return {
    locations,
    inventory_levels: inventoryLevelPages.flat(),
  };
});
