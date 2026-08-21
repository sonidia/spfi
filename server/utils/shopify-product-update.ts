import type { ShopifyProductUpdateInput } from "~~/types/shopify-product";

const PRODUCT_UPDATE_FIELDS = [
  "title",
  "body_html",
  "vendor",
  "product_type",
  "tags",
  "status",
  "published_at",
  "handle",
  "template_suffix",
  "published_scope",
  "options",
  "variants",
  "images",
] as const satisfies readonly (keyof ShopifyProductUpdateInput)[];

type LegacyProductUpdateInput = ShopifyProductUpdateInput & {
  published?: unknown;
};

export function normalizeShopifyProductUpdate(
  input: ShopifyProductUpdateInput | Record<string, unknown>,
  publishedAt: () => string = () => new Date().toISOString(),
): ShopifyProductUpdateInput {
  const source = input as LegacyProductUpdateInput;
  const update: ShopifyProductUpdateInput = {};

  for (const field of PRODUCT_UPDATE_FIELDS) {
    const value = source[field];
    if (value !== undefined) {
      Object.assign(update, { [field]: value });
    }
  }

  // `published` is ignored by Shopify on REST product updates. Translate older
  // clients to the supported publication fields, but never forward it.
  if (update.published_at === undefined && typeof source.published === "boolean") {
    update.published_at = source.published ? publishedAt() : null;
    if (source.published && update.published_scope === undefined) {
      update.published_scope = "web";
    }
  }

  return update;
}
