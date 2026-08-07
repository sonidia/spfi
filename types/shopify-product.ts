import type {
  ShopifyProduct,
  ShopifyProductImage,
  ShopifyVariant,
} from "./shopify";

export interface ShopifyProductUpdateInput {
  title?: string;
  body_html?: string;
  vendor?: string;
  product_type?: string;
  tags?: string;
  status?: "active" | "archived" | "draft";
  published?: boolean;
  handle?: string;
  template_suffix?: string | null;
  published_scope?: "global" | "web";
}

export interface ShopifyVariantInput {
  id?: number;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  price?: string;
  compare_at_price?: string | null;
  sku?: string | null;
  barcode?: string | null;
  position?: number;
  image_id?: number | null;
  taxable?: boolean;
  requires_shipping?: boolean;
  weight?: number;
  weight_unit?: string;
  inventory_management?: "shopify" | null;
  inventory_policy?: "continue" | "deny";
  fulfillment_service?: string;
  metafields?: Array<Record<string, unknown>>;
}

export interface ShopifyProductImageInput {
  id?: number;
  src?: string;
  attachment?: string;
  filename?: string;
  alt?: string | null;
  position?: number;
  variant_ids?: number[];
  metafields?: Array<Record<string, unknown>>;
}

export interface ProductCountQuery {
  collection_id?: string | number;
  created_at_max?: string;
  created_at_min?: string;
  product_type?: string;
  published_at_max?: string;
  published_at_min?: string;
  published_status?: "any" | "published" | "unpublished";
  updated_at_max?: string;
  updated_at_min?: string;
  vendor?: string;
}

export interface ProductCountResponse {
  count: number;
}

export interface ProductVariantsResponse {
  variants?: ShopifyVariant[];
  variant?: ShopifyVariant;
}

export interface ProductImagesResponse {
  images?: ShopifyProductImage[];
  image?: ShopifyProductImage;
}

export interface ProductResponse {
  product?: ShopifyProduct;
}
