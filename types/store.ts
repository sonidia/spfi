export type StoreTab =
  | "transactions"
  | "payouts"
  | "disputes"
  | "orders"
  | "products"
  | "customers"
  | "profile";

export const STORE_TABS: readonly StoreTab[] = [
  "transactions",
  "payouts",
  "disputes",
  "orders",
  "products",
  "customers",
  "profile",
];

export function isStoreTab(value: unknown): value is StoreTab {
  return typeof value === "string" && STORE_TABS.includes(value as StoreTab);
}
