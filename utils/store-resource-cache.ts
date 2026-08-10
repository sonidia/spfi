export type StoreDataResource =
  | "customers"
  | "disputes"
  | "locations"
  | "orders"
  | "payment"
  | "products"
  | "profile";

const resourceLoadedAt = new Map<string, number>();

export function getStoreResourceLoadedAt(
  storeId: string,
  resource: StoreDataResource,
) {
  return resourceLoadedAt.get(cacheKey(storeId, resource));
}

export function markStoreResourceLoaded(
  storeId: string,
  resource: StoreDataResource,
  loadedAt = Date.now(),
) {
  resourceLoadedAt.set(cacheKey(storeId, resource), loadedAt);
}

export function forgetStoreResource(
  storeId: string,
  resource: StoreDataResource,
) {
  resourceLoadedAt.delete(cacheKey(storeId, resource));
}

function cacheKey(storeId: string, resource: StoreDataResource) {
  return `${storeId}:${resource}`;
}
