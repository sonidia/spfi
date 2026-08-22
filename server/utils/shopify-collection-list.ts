import type { H3Event } from "h3";
import { callShopifyGraphql } from "./callShopifyGraphql.ts";
import {
  buildCollectionSearchQuery,
  normalizeCollectionPageSize,
  resolveCollectionSort,
} from "./shopify-collection-query.ts";
import type {
  CollectionListQuery,
  CollectionSourceSummary,
  ShopifyCollectionImage,
  ShopifyCollectionPage,
  ShopifyCollectionSummary,
} from "~~/types/shopify-collection";

interface CollectionListSourceNode {
  __typename: string;
  id: string;
  title: string;
  targetType?: "PRODUCTS" | "VARIANTS";
  shareable?: boolean;
  collections?: Array<{ id: string }>;
}

interface CollectionListNode {
  id: string;
  legacyResourceId: string;
  title: string;
  handle: string;
  updatedAt: string;
  sortOrder: ShopifyCollectionSummary["sortOrder"];
  image: ShopifyCollectionImage | null;
  productsCount: ShopifyCollectionSummary["productsCount"];
  sources: CollectionListSourceNode[];
}

interface CollectionListData {
  collections: {
    nodes: CollectionListNode[];
    pageInfo: {
      endCursor: string | null;
      startCursor: string | null;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  };
  collectionsCount: ShopifyCollectionPage["count"];
}

export const COLLECTIONS_PAGE_QUERY = `
  query CollectionsPage(
    $first: Int!
    $after: String
    $query: String!
    $sortKey: CollectionSortKeys!
    $reverse: Boolean!
  ) {
    collections(
      first: $first
      after: $after
      query: $query
      sortKey: $sortKey
      reverse: $reverse
    ) {
      nodes {
        id
        legacyResourceId
        title
        handle
        updatedAt
        sortOrder
        image { id url altText width height }
        productsCount { count precision }
        sources {
          __typename
          id
          title
          ... on CollectionConditionsSource {
            targetType
            shareable
          }
          ... on CollectionSubCollectionsSource {
            collections { id }
          }
        }
      }
      pageInfo {
        endCursor
        startCursor
        hasNextPage
        hasPreviousPage
      }
    }
    collectionsCount(query: $query) { count precision }
  }
`;

export async function listShopifyCollections(options: {
  event: H3Event;
  storeId: string;
  token: string;
  query?: CollectionListQuery;
}): Promise<ShopifyCollectionPage> {
  const first = normalizeCollectionPageSize(options.query?.limit);
  const after = String(options.query?.pageInfo || "").trim() || null;
  const query = buildCollectionSearchQuery(options.query);
  const sort = resolveCollectionSort(options.query);
  const variables = { first, after, query, ...sort };
  const data = await callShopifyGraphql<CollectionListData, typeof variables>({
    event: options.event,
    storeId: options.storeId,
    token: options.token,
    operationName: "CollectionsPage",
    query: COLLECTIONS_PAGE_QUERY,
    variables,
  });

  return {
    collections: data.collections.nodes.map(mapCollectionSummary),
    count: data.collectionsCount,
    pageInfo: {
      nextCursor: data.collections.pageInfo.hasNextPage
        ? data.collections.pageInfo.endCursor
        : null,
      previousCursor: data.collections.pageInfo.hasPreviousPage
        ? data.collections.pageInfo.startCursor
        : null,
      hasNextPage: data.collections.pageInfo.hasNextPage,
      hasPreviousPage: data.collections.pageInfo.hasPreviousPage,
    },
  };
}

export function mapCollectionSummary(
  node: CollectionListNode,
): ShopifyCollectionSummary {
  return {
    id: node.id,
    legacyResourceId: String(node.legacyResourceId),
    title: node.title,
    handle: node.handle,
    updatedAt: node.updatedAt,
    sortOrder: node.sortOrder,
    image: node.image,
    productsCount: node.productsCount,
    sources: node.sources.map(mapSourceSummary),
  };
}

function mapSourceSummary(source: CollectionListSourceNode): CollectionSourceSummary {
  if (source.__typename === "CollectionConditionsSource") {
    return {
      id: source.id,
      type: "conditions",
      typename: source.__typename,
      title: source.title,
      targetType: source.targetType || null,
      shareable: Boolean(source.shareable),
      collectionCount: 0,
      readOnly:
        Boolean(source.shareable) ||
        Boolean(source.targetType && source.targetType !== "PRODUCTS"),
    };
  }
  if (source.__typename === "CollectionSubCollectionsSource") {
    return {
      id: source.id,
      type: "subCollections",
      typename: source.__typename,
      title: source.title,
      targetType: null,
      shareable: false,
      collectionCount: source.collections?.length || 0,
      readOnly: true,
    };
  }
  return {
    id: source.id,
    type: "unknown",
    typename: source.__typename,
    title: source.title,
    targetType: null,
    shareable: false,
    collectionCount: 0,
    readOnly: true,
  };
}
