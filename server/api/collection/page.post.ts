import { defineEventHandler, readBody } from "h3";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";
import { listShopifyCollections } from "~~/server/utils/shopify-collection-list";
import type {
  CollectionListQuery,
  ShopifyCollectionPage,
} from "~~/types/shopify-collection";

interface CollectionPageBody {
  storeId?: string;
  token?: string;
  query?: CollectionListQuery;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<CollectionPageBody>(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);
  return (await listShopifyCollections({
    event,
    storeId,
    token,
    query: body.query || {},
  })) satisfies ShopifyCollectionPage;
});
