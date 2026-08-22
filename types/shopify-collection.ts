export type CollectionSortKey = "ID" | "RELEVANCE" | "TITLE" | "UPDATED_AT";

export type CollectionProductSortOrder =
  | "ALPHA_ASC"
  | "ALPHA_DESC"
  | "BEST_SELLING"
  | "CREATED"
  | "CREATED_DESC"
  | "MANUAL"
  | "MOST_RELEVANT"
  | "PRICE_ASC"
  | "PRICE_DESC";

export type CollectionCountPrecision = "AT_LEAST" | "EXACT";
export type CollectionSourceTargetType = "PRODUCTS" | "VARIANTS";
export type CollectionConditionMatchType = "ALL" | "ANY";

export interface CollectionListQuery {
  limit?: number;
  pageInfo?: string;
  search?: string;
  handle?: string;
  productId?: string;
  publishedStatus?: "published" | "unpublished";
  updatedAtMin?: string;
  updatedAtMax?: string;
  sortKey?: CollectionSortKey;
  reverse?: boolean;
}

export interface ShopifyCollectionImage {
  id: string | null;
  url: string;
  altText: string | null;
  width: number | null;
  height: number | null;
}

export interface ShopifyCollectionCount {
  count: number;
  precision: CollectionCountPrecision;
}

export interface CollectionSourceSummary {
  id: string;
  type: "conditions" | "subCollections" | "unknown";
  typename: string;
  title: string;
  targetType: CollectionSourceTargetType | null;
  shareable: boolean;
  collectionCount: number;
  readOnly: boolean;
}

export interface ShopifyCollectionSummary {
  id: string;
  legacyResourceId: string;
  title: string;
  handle: string;
  updatedAt: string;
  sortOrder: CollectionProductSortOrder;
  image: ShopifyCollectionImage | null;
  productsCount: ShopifyCollectionCount;
  sources: CollectionSourceSummary[];
}

export interface ShopifyCollectionPage {
  collections: ShopifyCollectionSummary[];
  count: ShopifyCollectionCount;
  pageInfo: {
    nextCursor: string | null;
    previousCursor: string | null;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface CollectionConditionView {
  id: string;
  typename: string;
  relation: string | null;
  matchType: CollectionConditionMatchType | null;
  values: string[];
  readOnly: boolean;
}

export interface CollectionProductSelection {
  product: CollectionProductSummary;
  variantIds: string[] | null;
}

export interface CollectionProductSummary {
  id: string;
  legacyResourceId: string;
  title: string;
  image: ShopifyCollectionImage | null;
}

export interface CollectionMetafieldView {
  id: string;
  namespace: string;
  key: string;
  type: string;
  value: string;
  compareDigest: string;
}

export interface CollectionMetafieldInput {
  namespace: string;
  key: string;
  type: string;
  value: string;
  compareDigest?: string | null;
}

export interface CollectionMetafieldIdentifier {
  namespace: string;
  key: string;
}

export interface CollectionCursorPageInfo {
  nextCursor: string | null;
  previousCursor: string | null;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface CollectionSourceBaseView {
  id: string;
  typename: string;
  title: string;
  description: string | null;
  app: { id: string; title: string } | null;
  readOnly: boolean;
}

export interface CollectionConditionsSourceView extends CollectionSourceBaseView {
  type: "conditions";
  targetType: CollectionSourceTargetType;
  shareable: boolean;
  inclusion: {
    matchType: CollectionConditionMatchType | null;
    conditions: CollectionConditionView[];
    selections: CollectionProductSelection[];
    selectionsPageInfo: CollectionCursorPageInfo;
  };
  exclusion: {
    matchType: CollectionConditionMatchType | null;
    conditions: CollectionConditionView[];
    selections: CollectionProductSelection[];
    selectionsPageInfo: CollectionCursorPageInfo;
  } | null;
}

export interface CollectionSubCollectionsSourceView extends CollectionSourceBaseView {
  type: "subCollections";
  collections: Array<{ id: string; legacyResourceId: string; title: string }>;
}

export interface CollectionUnknownSourceView extends CollectionSourceBaseView {
  type: "unknown";
}

export type CollectionSourceView =
  | CollectionConditionsSourceView
  | CollectionSubCollectionsSourceView
  | CollectionUnknownSourceView;

export interface ShopifyCollectionDetail extends Omit<
  ShopifyCollectionSummary,
  "sources"
> {
  descriptionHtml: string;
  templateSuffix: string | null;
  seo: { title: string | null; description: string | null };
  sources: CollectionSourceView[];
  products: CollectionProductSummary[];
  productsPageInfo: CollectionCursorPageInfo;
  metafields: CollectionMetafieldView[];
  metafieldsPageInfo: CollectionCursorPageInfo;
  publications: Array<{
    id: string;
    name: string;
    isPublished: boolean;
    publishDate: string | null;
  }>;
  warnings: string[];
}

export interface CollectionMetadataInput {
  title?: string;
  descriptionHtml?: string;
  handle?: string;
  image?: { src?: string; altText?: string } | null;
  seo?: { title?: string; description?: string };
  sortOrder?: CollectionProductSortOrder;
  templateSuffix?: string | null;
  redirectNewHandle?: boolean;
}

export interface CollectionCreateDto extends CollectionMetadataInput {
  title: string;
  sourceTitle?: string;
  productIds?: string[];
  publicationIds?: string[];
}

export interface CollectionUpdateDto extends CollectionMetadataInput {
  updatedAt?: string;
}

export interface CollectionDuplicateDto {
  newTitle: string;
  copyPublications: boolean;
}

export interface CollectionMutationResult {
  collection: ShopifyCollectionDetail | null;
  job?: CollectionJobReference | null;
  publishing?: {
    requested: number;
    succeeded: boolean;
    error: string | null;
  };
}

export interface CollectionJobReference {
  id: string;
  done: boolean;
}

export interface CollectionJobState extends CollectionJobReference {
  collectionId: string;
  action: "update" | "selections" | "duplicate";
  status: "queued" | "polling" | "completed" | "unknown";
  error: string | null;
}

export interface CollectionSelectionDelta {
  sourceId: string;
  productIdsToAdd?: string[];
  productIdsToRemove?: string[];
}

export interface CollectionPublicationInput {
  publicationIds: string[];
  publish: boolean;
}

export interface CollectionManagementContext {
  publications: Array<{
    id: string;
    name: string;
    catalogTitle: string | null;
  }>;
  locales: Array<{
    locale: string;
    name: string;
    primary: boolean;
    published: boolean;
  }>;
  warnings: string[];
}

export interface CollectionTranslationField {
  key: string;
  sourceValue: string | null;
  digest: string;
  value: string | null;
  outdated: boolean;
}

export interface CollectionTranslationResource {
  resourceId: string;
  locale: string;
  fields: CollectionTranslationField[];
}

export interface CollectionTranslationInput {
  key: string;
  digest: string;
  value: string;
}
