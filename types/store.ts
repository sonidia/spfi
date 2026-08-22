export type StoreTab =
  | "transactions"
  | "payouts"
  | "disputes"
  | "orders"
  | "products"
  | "collections"
  | "customers"
  | "markets"
  | "operations"
  | "profile";

export const DEFAULT_STORE_TAB: StoreTab = "transactions";

export const STORE_TABS: readonly StoreTab[] = [
  "transactions",
  "payouts",
  "disputes",
  "orders",
  "products",
  "collections",
  "customers",
  "markets",
  "operations",
  "profile",
];

export function isStoreTab(value: unknown): value is StoreTab {
  return typeof value === "string" && STORE_TABS.includes(value as StoreTab);
}

export function resolveStoreTab(
  value: unknown,
  legacyCatalogResource?: unknown,
): StoreTab {
  const candidate = Array.isArray(value) ? value[0] : value;
  const legacyResource = Array.isArray(legacyCatalogResource)
    ? legacyCatalogResource[0]
    : legacyCatalogResource;
  if (candidate === "products" && legacyResource === "collections") {
    return "collections";
  }
  return isStoreTab(candidate) ? candidate : DEFAULT_STORE_TAB;
}
