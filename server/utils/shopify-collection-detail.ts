import type { H3Event } from "h3";
import { callShopifyGraphql } from "./callShopifyGraphql.ts";
import { createApiErrorFromMessage } from "./callShopifyApi.ts";
import type {
  CollectionConditionView,
  CollectionConditionsSourceView,
  CollectionCursorPageInfo,
  CollectionManagementContext,
  CollectionMetafieldView,
  CollectionProductSelection,
  CollectionProductSummary,
  CollectionSourceView,
  ShopifyCollectionDetail,
  ShopifyCollectionImage,
} from "~~/types/shopify-collection";

interface RawPageInfo {
  endCursor: string | null;
  startCursor: string | null;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface RawProductNode {
  id: string;
  legacyResourceId: string;
  title: string;
  featuredMedia: {
    id: string;
    image: ShopifyCollectionImage | null;
  } | null;
}

interface RawInclusionSelection {
  product: RawProductNode;
  variantIds: string[] | null;
}

interface RawExclusionSelection {
  product: RawProductNode;
}

interface RawSelectionConnection<TSelection> {
  nodes: TSelection[];
  pageInfo: RawPageInfo;
}

interface RawConditionsSource {
  __typename: "CollectionConditionsSource";
  id: string;
  title: string;
  description: string | null;
  app: { id: string; title: string } | null;
  targetType: "PRODUCTS" | "VARIANTS";
  shareable: boolean;
  inclusion: {
    matchType: "ALL" | "ANY" | null;
    conditions: Array<Record<string, unknown> & { __typename: string; id: string }>;
    selections: RawSelectionConnection<RawInclusionSelection>;
  };
  exclusion: {
    matchType: "ALL" | "ANY" | null;
    conditions: Array<Record<string, unknown> & { __typename: string; id: string }>;
    selections: RawSelectionConnection<RawExclusionSelection>;
  } | null;
}

interface RawSubCollectionsSource {
  __typename: "CollectionSubCollectionsSource";
  id: string;
  title: string;
  description: string | null;
  app: { id: string; title: string } | null;
  collections: Array<{ id: string; legacyResourceId: string; title: string }>;
}

interface RawUnknownSource {
  __typename: string;
  id: string;
  title: string;
  description: string | null;
  app: { id: string; title: string } | null;
}

type RawSource = RawConditionsSource | RawSubCollectionsSource | RawUnknownSource;

interface RawCollectionDetail {
  id: string;
  legacyResourceId: string;
  title: string;
  handle: string;
  descriptionHtml: string;
  updatedAt: string;
  sortOrder: ShopifyCollectionDetail["sortOrder"];
  templateSuffix: string | null;
  image: ShopifyCollectionImage | null;
  seo: { title: string | null; description: string | null };
  productsCount: ShopifyCollectionDetail["productsCount"];
  sources: RawSource[];
  products: { nodes: RawProductNode[]; pageInfo: RawPageInfo };
  metafields: { nodes: CollectionMetafieldView[]; pageInfo: RawPageInfo };
}

interface RawCollectionPublication {
  publication: { id: string; name: string };
  isPublished: boolean;
  publishDate: string | null;
}

interface CollectionPublicationsData {
  collection: {
    resourcePublications: {
      nodes: RawCollectionPublication[];
      pageInfo: { hasNextPage: boolean };
    };
  } | null;
}

interface CollectionPublicationState {
  publications: RawCollectionPublication[];
  warnings: string[];
}

interface CollectionDetailData {
  collection: RawCollectionDetail | null;
}

export const COLLECTION_DETAIL_QUERY = `
  query CollectionDetail($id: ID!, $productsFirst: Int!) {
    collection(id: $id) {
      id
      legacyResourceId
      title
      handle
      descriptionHtml
      updatedAt
      sortOrder
      templateSuffix
      image { id url altText width height }
      seo { title description }
      productsCount { count precision }
      metafields(first: 50) {
        nodes { id namespace key type value compareDigest }
        pageInfo { endCursor startCursor hasNextPage hasPreviousPage }
      }
      sources {
        __typename
        id
        title
        description
        app { id title }
        ... on CollectionConditionsSource {
          targetType
          shareable
          inclusion {
            matchType
            conditions {
              __typename
              id
              ... on CollectionSourceInclusionConditionProductTag {
                tagRelation: relation
                tagValues: values
                tagMatchType: matchType
              }
              ... on CollectionSourceInclusionConditionProductTitle {
                titleRelation: relation
                titleValues: values
                titleMatchType: matchType
              }
              ... on CollectionSourceInclusionConditionProductType {
                typeRelation: relation
                typeValues: values
                typeMatchType: matchType
              }
              ... on CollectionSourceInclusionConditionProductVendor {
                vendorRelation: relation
                vendorValues: values
                vendorMatchType: matchType
              }
              ... on CollectionSourceInclusionConditionProductStatus {
                statusRelation: relation
                statusValues: values
                statusMatchType: matchType
              }
              ... on CollectionSourceInclusionConditionVariantTitle {
                variantTitleRelation: relation
                variantTitleValues: values
                variantTitleMatchType: matchType
              }
              ... on CollectionSourceInclusionConditionUnknown {
                unknownRelation: relation
                unknownValues: values
                unknownMatchType: matchType
              }
            }
            selections(first: 50) {
              nodes {
                product { ...CollectionProduct }
                variantIds
              }
              pageInfo { endCursor startCursor hasNextPage hasPreviousPage }
            }
          }
          exclusion {
            matchType
            conditions { __typename id }
            selections(first: 50) {
              nodes {
                product { ...CollectionProduct }
              }
              pageInfo { endCursor startCursor hasNextPage hasPreviousPage }
            }
          }
        }
        ... on CollectionSubCollectionsSource {
          collections { id legacyResourceId title }
        }
      }
      products(first: $productsFirst) {
        nodes { ...CollectionProduct }
        pageInfo { endCursor startCursor hasNextPage hasPreviousPage }
      }
    }
  }

  fragment CollectionProduct on Product {
    id
    legacyResourceId
    title
    featuredMedia {
      ... on MediaImage {
        id
        image { id url altText width height }
      }
    }
  }
`;

export async function getShopifyCollectionDetail(options: {
  event: H3Event;
  storeId: string;
  token: string;
  id: string;
}): Promise<ShopifyCollectionDetail> {
  const variables = { id: options.id, productsFirst: 50 };
  const data = await callShopifyGraphql<CollectionDetailData, typeof variables>({
    event: options.event,
    storeId: options.storeId,
    token: options.token,
    operationName: "CollectionDetail",
    query: COLLECTION_DETAIL_QUERY,
    variables,
  });
  if (!data.collection) {
    throw createApiErrorFromMessage("Collection was not found.", 404);
  }
  const publicationState = await getCollectionPublicationState(options);
  return mapCollectionDetail(
    data.collection,
    publicationState.publications,
    publicationState.warnings,
  );
}

async function getCollectionPublicationState(options: {
  event: H3Event;
  storeId: string;
  token: string;
  id: string;
}): Promise<CollectionPublicationState> {
  const variables = { id: options.id };
  try {
    const data = await callShopifyGraphql<CollectionPublicationsData, typeof variables>(
      {
        event: options.event,
        storeId: options.storeId,
        token: options.token,
        operationName: "CollectionPublications",
        query: `
        query CollectionPublications($id: ID!) {
          collection(id: $id) {
            resourcePublications(first: 250, onlyPublished: false) {
              nodes {
                publication { id name }
                isPublished
                publishDate
              }
              pageInfo { hasNextPage }
            }
          }
        }
      `,
        variables,
      },
    );
    if (!data.collection) return { publications: [], warnings: [] };
    return {
      publications: data.collection.resourcePublications.nodes,
      warnings: data.collection.resourcePublications.pageInfo.hasNextPage
        ? ["publications_truncated"]
        : [],
    };
  } catch {
    return { publications: [], warnings: ["publications_unavailable"] };
  }
}

export async function getShopifyCollectionContext(options: {
  event: H3Event;
  storeId: string;
  token: string;
}): Promise<CollectionManagementContext> {
  const [publishing, localization] = await Promise.all([
    getCollectionPublishingContext(options),
    getCollectionLocalizationContext(options),
  ]);
  return {
    publications: publishing.publications,
    locales: localization.locales,
    warnings: [...publishing.warnings, ...localization.warnings],
  };
}

async function getCollectionPublishingContext(options: {
  event: H3Event;
  storeId: string;
  token: string;
}): Promise<Pick<CollectionManagementContext, "publications" | "warnings">> {
  try {
    const data = await callShopifyGraphql<{
      publications: {
        nodes: Array<{
          id: string;
          name: string;
          catalog: { title: string } | null;
        }>;
        pageInfo: { hasNextPage: boolean };
      };
    }>({
      ...options,
      operationName: "CollectionPublishingContext",
      query: `
        query CollectionPublishingContext {
          publications(first: 250) {
            nodes { id name catalog { title } }
            pageInfo { hasNextPage }
          }
        }
      `,
    });
    return {
      publications: data.publications.nodes.map((publication) => ({
        id: publication.id,
        name: publication.name,
        catalogTitle: publication.catalog?.title || null,
      })),
      warnings: data.publications.pageInfo.hasNextPage
        ? ["publications_truncated"]
        : [],
    };
  } catch {
    return { publications: [], warnings: ["publications_unavailable"] };
  }
}

async function getCollectionLocalizationContext(options: {
  event: H3Event;
  storeId: string;
  token: string;
}): Promise<Pick<CollectionManagementContext, "locales" | "warnings">> {
  try {
    const data = await callShopifyGraphql<{
      shopLocales: CollectionManagementContext["locales"];
    }>({
      ...options,
      operationName: "CollectionLocalizationContext",
      query: `
        query CollectionLocalizationContext {
          shopLocales { locale name primary published }
        }
      `,
    });
    return { locales: data.shopLocales, warnings: [] };
  } catch {
    return { locales: [], warnings: ["locales_unavailable"] };
  }
}

export function mapCollectionDetail(
  node: RawCollectionDetail,
  publications: RawCollectionPublication[] = [],
  warnings: string[] = [],
): ShopifyCollectionDetail {
  const sourcesHaveMoreSelections = node.sources.some((source) => {
    if (source.__typename !== "CollectionConditionsSource") return false;
    const conditionsSource = source as RawConditionsSource;
    return (
      conditionsSource.inclusion.selections.pageInfo.hasNextPage ||
      Boolean(conditionsSource.exclusion?.selections.pageInfo.hasNextPage)
    );
  });
  return {
    id: node.id,
    legacyResourceId: String(node.legacyResourceId),
    title: node.title,
    handle: node.handle,
    descriptionHtml: node.descriptionHtml,
    updatedAt: node.updatedAt,
    sortOrder: node.sortOrder,
    templateSuffix: node.templateSuffix,
    image: node.image,
    seo: node.seo,
    productsCount: node.productsCount,
    sources: node.sources.map(mapCollectionSource),
    products: node.products.nodes.map(mapProduct),
    productsPageInfo: mapPageInfo(node.products.pageInfo),
    metafields: node.metafields.nodes,
    metafieldsPageInfo: mapPageInfo(node.metafields.pageInfo),
    publications: publications.map((resourcePublication) => ({
      id: resourcePublication.publication.id,
      name: resourcePublication.publication.name,
      isPublished: resourcePublication.isPublished,
      publishDate: isEpochDate(resourcePublication.publishDate)
        ? null
        : resourcePublication.publishDate,
    })),
    warnings: [
      ...warnings,
      ...(node.metafields.pageInfo.hasNextPage ? ["metafields_truncated"] : []),
      ...(node.products.pageInfo.hasNextPage ? ["products_truncated"] : []),
      ...(sourcesHaveMoreSelections ? ["selections_truncated"] : []),
    ],
  };
}

function mapCollectionSource(source: RawSource): CollectionSourceView {
  const base = {
    id: source.id,
    typename: source.__typename,
    title: source.title,
    description: source.description,
    app: source.app,
  };
  if (source.__typename === "CollectionConditionsSource") {
    const conditionsSource = source as RawConditionsSource;
    return {
      ...base,
      type: "conditions",
      targetType: conditionsSource.targetType,
      shareable: conditionsSource.shareable,
      readOnly:
        conditionsSource.shareable || conditionsSource.targetType !== "PRODUCTS",
      inclusion: mapInclusionRules(conditionsSource.inclusion),
      exclusion: conditionsSource.exclusion
        ? mapExclusionRules(conditionsSource.exclusion)
        : null,
    } satisfies CollectionConditionsSourceView;
  }
  if (source.__typename === "CollectionSubCollectionsSource") {
    const subCollectionsSource = source as RawSubCollectionsSource;
    return {
      ...base,
      type: "subCollections",
      readOnly: true,
      collections: subCollectionsSource.collections.map((collection) => ({
        ...collection,
        legacyResourceId: String(collection.legacyResourceId),
      })),
    };
  }
  return { ...base, type: "unknown", readOnly: true };
}

function mapInclusionRules(sourceRules: RawConditionsSource["inclusion"]) {
  return {
    matchType: sourceRules.matchType,
    conditions: sourceRules.conditions.map(mapCondition),
    selections: sourceRules.selections.nodes.map(mapSelection),
    selectionsPageInfo: mapPageInfo(sourceRules.selections.pageInfo),
  };
}

function mapExclusionRules(sourceRules: NonNullable<RawConditionsSource["exclusion"]>) {
  return {
    matchType: sourceRules.matchType,
    conditions: sourceRules.conditions.map(mapCondition),
    selections: sourceRules.selections.nodes.map(mapExclusionSelection),
    selectionsPageInfo: mapPageInfo(sourceRules.selections.pageInfo),
  };
}

function mapCondition(
  condition: Record<string, unknown> & { __typename: string; id: string },
): CollectionConditionView {
  const relation = firstScalar(condition, [
    "tagRelation",
    "titleRelation",
    "typeRelation",
    "vendorRelation",
    "statusRelation",
    "variantTitleRelation",
    "unknownRelation",
  ]);
  const matchType = firstScalar(condition, [
    "tagMatchType",
    "titleMatchType",
    "typeMatchType",
    "vendorMatchType",
    "statusMatchType",
    "variantTitleMatchType",
    "unknownMatchType",
  ]);
  const values = firstArray(condition, [
    "tagValues",
    "titleValues",
    "typeValues",
    "vendorValues",
    "statusValues",
    "variantTitleValues",
    "unknownValues",
  ]);
  return {
    id: condition.id,
    typename: condition.__typename,
    relation,
    matchType: matchType === "ALL" || matchType === "ANY" ? matchType : null,
    values,
    readOnly: true,
  };
}

function mapSelection(selection: RawInclusionSelection): CollectionProductSelection {
  return {
    product: mapProduct(selection.product),
    variantIds: selection.variantIds,
  };
}

function mapExclusionSelection(
  selection: RawExclusionSelection,
): CollectionProductSelection {
  return {
    product: mapProduct(selection.product),
    variantIds: null,
  };
}

function mapProduct(product: RawProductNode): CollectionProductSummary {
  return {
    id: product.id,
    legacyResourceId: String(product.legacyResourceId),
    title: product.title,
    image: product.featuredMedia?.image
      ? { ...product.featuredMedia.image, id: product.featuredMedia.id }
      : null,
  };
}

function mapPageInfo(pageInfo: RawPageInfo): CollectionCursorPageInfo {
  return {
    nextCursor: pageInfo.hasNextPage ? pageInfo.endCursor : null,
    previousCursor: pageInfo.hasPreviousPage ? pageInfo.startCursor : null,
    hasNextPage: pageInfo.hasNextPage,
    hasPreviousPage: pageInfo.hasPreviousPage,
  };
}

function firstScalar(input: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (typeof input[key] === "string") return input[key] as string;
  }
  return null;
}

function firstArray(input: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (Array.isArray(input[key])) return (input[key] as unknown[]).map(String);
  }
  return [];
}

function isEpochDate(value: string | null) {
  if (!value) return false;
  return Date.parse(value) <= Date.parse("1971-01-01T00:00:00Z");
}
