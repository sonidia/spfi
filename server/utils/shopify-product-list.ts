import type { H3Event } from "h3";
import { callShopifyGraphql } from "./callShopifyGraphql";
import {
  buildProductSearchQuery,
  normalizeProductPageSize,
} from "./shopify-product-query";
import type {
  ShopifyNumericId,
  ShopifyProduct,
  ShopifyProductImage,
  ShopifyProductOption,
  ShopifyVariant,
} from "~~/types/shopify";
import type { ProductListQuery } from "~~/types/shopify-product";

interface ProductListNode {
  id: string;
  legacyResourceId: ShopifyNumericId;
  title: string;
  descriptionHtml: string;
  vendor: string;
  productType: string;
  tags: string[];
  status: "ACTIVE" | "ARCHIVED" | "DRAFT";
  handle: string;
  templateSuffix: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  totalInventory: number;
  variantsCount: { count: number } | null;
  priceRangeV2: {
    minVariantPrice: { amount: string; currencyCode: string };
    maxVariantPrice: { amount: string; currencyCode: string };
  };
  options: Array<{
    id: string;
    name: string;
    position: number;
    values: string[];
  }>;
  featuredMedia: {
    id: string;
    alt: string | null;
    image: {
      url: string;
      altText: string | null;
      width: number | null;
      height: number | null;
    } | null;
  } | null;
  variants: {
    nodes: Array<{
      id: string;
      legacyResourceId: ShopifyNumericId;
      title: string;
      price: string;
      compareAtPrice: string | null;
      sku: string | null;
      barcode: string | null;
      position: number;
      inventoryQuantity: number | null;
      inventoryPolicy: "CONTINUE" | "DENY";
      taxable: boolean;
      selectedOptions: Array<{ value: string }>;
      inventoryItem: {
        legacyResourceId: ShopifyNumericId;
        tracked: boolean;
        requiresShipping: boolean;
      };
    }>;
  };
}

interface ProductListData {
  products: {
    nodes: ProductListNode[];
    pageInfo: {
      endCursor: string | null;
      startCursor: string | null;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  };
  productsCount: { count: number };
}

export async function listShopifyProducts(options: {
  event: H3Event;
  storeId: string;
  token: string;
  query?: ProductListQuery;
}) {
  const first = normalizeProductPageSize(options.query?.limit);
  const after = String(options.query?.page_info || "").trim() || null;
  const searchQuery = buildProductSearchQuery(options.query);
  const variables = { first, after, query: searchQuery };
  const data = await callShopifyGraphql<ProductListData, typeof variables>({
    event: options.event,
    storeId: options.storeId,
    token: options.token,
    operationName: "ProductsPage",
    query: `
      query ProductsPage($first: Int!, $after: String, $query: String!) {
        products(
          first: $first
          after: $after
          query: $query
          sortKey: UPDATED_AT
          reverse: true
        ) {
          nodes {
            id
            legacyResourceId
            title
            descriptionHtml
            vendor
            productType
            tags
            status
            handle
            templateSuffix
            createdAt
            updatedAt
            publishedAt
            totalInventory
            variantsCount { count }
            priceRangeV2 {
              minVariantPrice { amount currencyCode }
              maxVariantPrice { amount currencyCode }
            }
            options { id name position values }
            featuredMedia {
              ... on MediaImage {
                id
                alt
                image { url altText width height }
              }
            }
            variants(first: 1) {
              nodes {
                id
                legacyResourceId
                title
                price
                compareAtPrice
                sku
                barcode
                position
                inventoryQuantity
                inventoryPolicy
                taxable
                selectedOptions { value }
                inventoryItem {
                  legacyResourceId
                  tracked
                  requiresShipping
                }
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
        productsCount(limit: null, query: $query) { count }
      }
    `,
    variables,
  });

  return {
    products: data.products.nodes.map(mapProduct),
    count: data.productsCount.count,
    pageInfo: {
      nextCursor: data.products.pageInfo.endCursor,
      previousCursor: data.products.pageInfo.startCursor,
      hasNextPage: data.products.pageInfo.hasNextPage,
      hasPreviousPage: data.products.pageInfo.hasPreviousPage,
    },
  };
}

function mapProduct(node: ProductListNode): ShopifyProduct {
  const image = mapImage(node.featuredMedia);
  return {
    id: node.legacyResourceId,
    admin_graphql_api_id: node.id,
    title: node.title,
    body_html: node.descriptionHtml,
    vendor: node.vendor,
    product_type: node.productType,
    tags: node.tags.join(", "),
    status: node.status.toLowerCase() as ShopifyProduct["status"],
    handle: node.handle,
    template_suffix: node.templateSuffix,
    created_at: node.createdAt,
    updated_at: node.updatedAt,
    published_at: node.publishedAt,
    total_inventory: node.totalInventory,
    variants_count: node.variantsCount?.count || 0,
    min_price: node.priceRangeV2.minVariantPrice.amount,
    max_price: node.priceRangeV2.maxVariantPrice.amount,
    price_currency: node.priceRangeV2.minVariantPrice.currencyCode,
    options: node.options.map(mapOption),
    variants: node.variants.nodes.map((variant) =>
      mapVariant(variant, node.legacyResourceId),
    ),
    image,
    images: image ? [image] : [],
  };
}

function mapOption(option: ProductListNode["options"][number]): ShopifyProductOption {
  return {
    id: legacyIdFromGid(option.id),
    name: option.name,
    position: option.position,
    values: option.values,
  };
}

function mapImage(media: ProductListNode["featuredMedia"]): ShopifyProductImage | null {
  if (!media?.image) return null;
  return {
    src: media.image.url,
    alt: media.alt || media.image.altText,
    width: media.image.width || undefined,
    height: media.image.height || undefined,
    admin_graphql_api_id: media.id,
  };
}

function mapVariant(
  variant: ProductListNode["variants"]["nodes"][number],
  productId: ShopifyNumericId,
): ShopifyVariant {
  return {
    id: variant.legacyResourceId,
    product_id: productId,
    admin_graphql_api_id: variant.id,
    title: variant.title,
    price: variant.price,
    compare_at_price: variant.compareAtPrice,
    sku: variant.sku,
    barcode: variant.barcode,
    position: variant.position,
    option1: variant.selectedOptions[0]?.value || null,
    option2: variant.selectedOptions[1]?.value || null,
    option3: variant.selectedOptions[2]?.value || null,
    inventory_quantity: variant.inventoryQuantity ?? undefined,
    inventory_policy: variant.inventoryPolicy.toLowerCase(),
    taxable: variant.taxable,
    inventory_item_id: variant.inventoryItem.legacyResourceId,
    inventory_management: variant.inventoryItem.tracked ? "shopify" : null,
    requires_shipping: variant.inventoryItem.requiresShipping,
  };
}

function legacyIdFromGid(gid: string) {
  return gid.slice(gid.lastIndexOf("/") + 1);
}
