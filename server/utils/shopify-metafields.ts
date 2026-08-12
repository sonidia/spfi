export const METAFIELD_RESOURCES = {
  customer: "customers",
  customers: "customers",
  order: "orders",
  orders: "orders",
  product: "products",
  products: "products",
} as const;

export type MetafieldResource = keyof typeof METAFIELD_RESOURCES;

export function resolveMetafieldResource(resource?: string) {
  const normalized = String(resource || "")
    .trim()
    .toLowerCase() as MetafieldResource;

  return METAFIELD_RESOURCES[normalized] || null;
}

export function buildMetafieldPath(
  resourcePath: string,
  ownerId: string,
  metafieldId?: string,
) {
  const basePath = `/${resourcePath}/${ownerId}/metafields`;

  return metafieldId ? `${basePath}/${metafieldId}.json` : `${basePath}.json`;
}
