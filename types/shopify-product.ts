import type {
  ShopifyNumericId,
  ShopifyProduct,
  ShopifyProductImage,
  ShopifyProductOption,
  ShopifyVariant,
} from "./shopify";

export interface ShopifyMetafieldInput {
  id?: ShopifyNumericId;
  namespace: string;
  key: string;
  value: string;
  type: string;
  description?: string | null;
}

export interface ShopifyProductUpdateInput {
  title?: string;
  body_html?: string;
  vendor?: string;
  product_type?: string;
  tags?: string;
  status?: "active" | "archived" | "draft";
  published_at?: string | null;
  handle?: string;
  template_suffix?: string | null;
  published_scope?: "global" | "web";
  options?: ShopifyProductOption[];
  variants?: ShopifyVariantInput[];
  images?: ShopifyProductImageInput[];
  metafields?: ShopifyMetafieldInput[];
}

export interface ShopifyVariantInput {
  id?: ShopifyNumericId;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  price?: string;
  compare_at_price?: string | null;
  sku?: string | null;
  barcode?: string | null;
  position?: number;
  image_id?: ShopifyNumericId | null;
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
  id?: ShopifyNumericId;
  src?: string;
  attachment?: string;
  filename?: string;
  alt?: string | null;
  position?: number;
  variant_ids?: ShopifyNumericId[];
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

export interface ProductListQuery extends ProductCountQuery {
  fields?: string;
  handle?: string;
  ids?: string;
  limit?: number;
  page_info?: string;
  presentment_currencies?: string;
  since_id?: string | number;
  status?: "active" | "archived" | "draft";
  title?: string;
  sort_key?: ProductSortKey;
  reverse?: boolean;
}

export type ProductSortKey =
  | "CREATED_AT"
  | "ID"
  | "INVENTORY_TOTAL"
  | "PRODUCT_TYPE"
  | "PUBLISHED_AT"
  | "TITLE"
  | "UPDATED_AT"
  | "VENDOR";

export interface ProductCollectionOption {
  id: string;
  legacyResourceId: ShopifyNumericId;
  title: string;
  productsCount: number;
}

export interface ProductPublicationOption {
  id: string;
  name: string;
  catalogTitle: string | null;
  autoPublish: boolean;
  supportsFuturePublishing: boolean;
  onlineStore: boolean;
}

export interface ProductManagementContext {
  collections: ProductCollectionOption[];
  collectionsTruncated: boolean;
  publications: ProductPublicationOption[];
  publicationsTruncated: boolean;
  warnings: string[];
}

export interface ProductAdvancedDetails {
  id: string;
  category: { id: string; name: string; fullName: string } | null;
  seo: { title: string | null; description: string | null };
  isGiftCard: boolean;
  requiresSellingPlan: boolean;
  collections: ProductCollectionOption[];
  collectionsTruncated: boolean;
  sellingPlanGroups: Array<{ id: string; name: string; merchantCode: string }>;
  sellingPlanGroupsTruncated: boolean;
}

export type ProductMediaContentType = "EXTERNAL_VIDEO" | "IMAGE" | "MODEL_3D" | "VIDEO";

export interface ProductMediaSummary {
  id: string;
  alt: string | null;
  type: ProductMediaContentType;
  status: string;
  previewUrl: string | null;
  originalUrl: string | null;
  host: string | null;
}

export interface ProductMediaResponse {
  items: ProductMediaSummary[];
  truncated: boolean;
}

export interface BulkProductActionResult {
  total: number;
  succeeded: number;
  failedIds: ShopifyNumericId[];
}

export interface ProductDuplicateResult {
  queued: boolean;
  operationId: string | null;
  product: { id: ShopifyNumericId; title: string } | null;
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

export interface ProductPageResponse {
  products: ShopifyProduct[];
  count: number;
  pageInfo: {
    nextCursor: string | null;
    previousCursor: string | null;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface ProductVariantBulkResult {
  variants?: ShopifyVariant[];
  deletedIds?: ShopifyNumericId[];
}

export interface ProductOptionsUpdateResult {
  options: ShopifyProductOption[];
}
