export function buildShopifyGid(resource: string, id: string | number) {
  const value = String(id || "").trim();
  if (value.startsWith("gid://shopify/")) return value;
  return `gid://shopify/${resource}/${value}`;
}
