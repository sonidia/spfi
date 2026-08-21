import type { H3Event } from "h3";
import { assertNoGraphqlUserErrors, callShopifyGraphql } from "./callShopifyGraphql";
import { buildShopifyGid } from "./shopify-gid";
import type { ShopifyNumericId } from "~~/types/shopify";
import type {
  BulkProductActionResult,
  ProductAdvancedDetails,
  ProductCollectionOption,
  ProductDuplicateResult,
  ProductManagementContext,
  ProductMediaContentType,
  ProductMediaResponse,
  ProductMediaSummary,
} from "~~/types/shopify-product";
import { isOnlineStorePublication } from "./shopify-publication";

interface ProductRequestContext {
  event: H3Event;
  storeId: string;
  token: string;
}

interface GraphqlUserError {
  field?: string[] | null;
  message: string;
}

const MAX_CONTEXT_ITEMS = 250;
const CONTEXT_PAGE_SIZE = 100;
const PRODUCT_ACTION_BATCH_SIZE = 50;
const PRODUCT_MEDIA_TYPES = new Set<ProductMediaContentType>([
  "EXTERNAL_VIDEO",
  "IMAGE",
  "MODEL_3D",
  "VIDEO",
]);

export async function fetchProductManagementContext(
  context: ProductRequestContext,
): Promise<ProductManagementContext> {
  const [collections, publications] = await Promise.allSettled([
    fetchProductCollections(context),
    fetchProductPublications(context),
  ]);
  const warnings: string[] = [];
  if (collections.status === "rejected") warnings.push("collections_unavailable");
  if (publications.status === "rejected") warnings.push("publications_unavailable");
  const collectionResult =
    collections.status === "fulfilled"
      ? collections.value
      : { items: [], truncated: false };
  const publicationResult =
    publications.status === "fulfilled"
      ? publications.value
      : { items: [], truncated: false };
  if (collectionResult.truncated) warnings.push("collections_truncated");
  if (publicationResult.truncated) warnings.push("publications_truncated");
  return {
    collections: collectionResult.items,
    collectionsTruncated: collectionResult.truncated,
    publications: publicationResult.items,
    publicationsTruncated: publicationResult.truncated,
    warnings,
  };
}

async function fetchProductCollections(context: ProductRequestContext) {
  const items: ProductCollectionOption[] = [];
  let after: string | null = null;
  let hasNextPage: boolean;
  do {
    const data: {
      collections: {
        nodes: Array<{
          id: string;
          legacyResourceId: ShopifyNumericId;
          title: string;
          productsCount: { count: number };
        }>;
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    } = await callShopifyGraphql({
      ...context,
      operationName: "ProductManagementCollections",
      query: `#graphql
        query ProductManagementCollections($first: Int!, $after: String) {
          collections(first: $first, after: $after, sortKey: TITLE) {
            nodes { id legacyResourceId title productsCount { count } }
            pageInfo { hasNextPage endCursor }
          }
        }
      `,
      variables: {
        first: Math.min(CONTEXT_PAGE_SIZE, MAX_CONTEXT_ITEMS - items.length),
        after,
      },
    });
    items.push(
      ...data.collections.nodes.map((collection) => ({
        id: collection.id,
        legacyResourceId: collection.legacyResourceId,
        title: collection.title,
        productsCount: collection.productsCount.count,
      })),
    );
    hasNextPage = data.collections.pageInfo.hasNextPage;
    after = data.collections.pageInfo.endCursor;
  } while (hasNextPage && after && items.length < MAX_CONTEXT_ITEMS);
  return { items, truncated: hasNextPage };
}

async function fetchProductPublications(context: ProductRequestContext) {
  const items: ProductManagementContext["publications"] = [];
  let after: string | null = null;
  let hasNextPage: boolean;
  do {
    const data: {
      publications: {
        nodes: Array<{
          id: string;
          name: string;
          autoPublish: boolean;
          supportsFuturePublishing: boolean;
          catalog: { title: string } | null;
          channels: {
            nodes: Array<{ handle: string; name: string }>;
          } | null;
        }>;
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    } = await callShopifyGraphql({
      ...context,
      operationName: "ProductManagementPublications",
      query: `#graphql
        query ProductManagementPublications($first: Int!, $after: String) {
          publications(first: $first, after: $after) {
            nodes {
              id
              name
              autoPublish
              supportsFuturePublishing
              catalog { title }
              channels(first: 10) { nodes { handle name } }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
      `,
      variables: {
        first: Math.min(CONTEXT_PAGE_SIZE, MAX_CONTEXT_ITEMS - items.length),
        after,
      },
    });
    items.push(
      ...data.publications.nodes.map((publication) => {
        const channelName = publication.channels?.nodes[0]?.name;
        return {
          id: publication.id,
          name:
            channelName ||
            publication.name ||
            publication.catalog?.title ||
            publication.id,
          catalogTitle: publication.catalog?.title || null,
          autoPublish: publication.autoPublish,
          supportsFuturePublishing: publication.supportsFuturePublishing,
          onlineStore: isOnlineStorePublication(publication),
        };
      }),
    );
    hasNextPage = data.publications.pageInfo.hasNextPage;
    after = data.publications.pageInfo.endCursor;
  } while (hasNextPage && after && items.length < MAX_CONTEXT_ITEMS);
  return { items, truncated: hasNextPage };
}

export async function fetchProductAdvancedDetails(
  context: ProductRequestContext,
  productId: ShopifyNumericId,
): Promise<ProductAdvancedDetails> {
  const id = buildShopifyGid("Product", productId);
  const data = await callShopifyGraphql<{
    product: {
      id: string;
      category: { id: string; name: string; fullName: string } | null;
      seo: { title: string | null; description: string | null };
      isGiftCard: boolean;
      requiresSellingPlan: boolean;
      collections: {
        nodes: Array<{
          id: string;
          legacyResourceId: ShopifyNumericId;
          title: string;
          productsCount: { count: number };
        }>;
        pageInfo: { hasNextPage: boolean };
      };
      sellingPlanGroups: {
        nodes: Array<{ id: string; name: string; merchantCode: string }>;
        pageInfo: { hasNextPage: boolean };
      };
    } | null;
  }>({
    ...context,
    operationName: "ProductAdvancedDetails",
    query: `#graphql
      query ProductAdvancedDetails($id: ID!) {
        product(id: $id) {
          id
          category { id name fullName }
          seo { title description }
          isGiftCard
          requiresSellingPlan
          collections(first: 250, sortKey: TITLE) {
            nodes { id legacyResourceId title productsCount { count } }
            pageInfo { hasNextPage }
          }
          sellingPlanGroups(first: 50) {
            nodes { id name merchantCode }
            pageInfo { hasNextPage }
          }
        }
      }
    `,
    variables: { id },
  });
  if (!data.product) throw notFound("Product not found.");
  return {
    id: data.product.id,
    category: data.product.category,
    seo: data.product.seo,
    isGiftCard: data.product.isGiftCard,
    requiresSellingPlan: data.product.requiresSellingPlan,
    collections: data.product.collections.nodes.map((collection) => ({
      id: collection.id,
      legacyResourceId: collection.legacyResourceId,
      title: collection.title,
      productsCount: collection.productsCount.count,
    })),
    collectionsTruncated: data.product.collections.pageInfo.hasNextPage,
    sellingPlanGroups: data.product.sellingPlanGroups.nodes,
    sellingPlanGroupsTruncated: data.product.sellingPlanGroups.pageInfo.hasNextPage,
  };
}

export async function updateProductAdvancedDetails(
  context: ProductRequestContext,
  productId: ShopifyNumericId,
  rawInput: unknown,
) {
  const source = asRecord(rawInput, "Advanced product input");
  const input: Record<string, unknown> = {
    id: buildShopifyGid("Product", productId),
  };
  if (source.title !== undefined) {
    const title = String(source.title || "").trim();
    if (!title || title.length > 255) throw badRequest("Product title is invalid.");
    input.title = title;
  }
  if (source.descriptionHtml !== undefined) {
    input.descriptionHtml = String(source.descriptionHtml || "");
  }
  if (source.vendor !== undefined) input.vendor = String(source.vendor || "").trim();
  if (source.productType !== undefined) {
    input.productType = String(source.productType || "").trim();
  }
  if (source.tags !== undefined) {
    input.tags = Array.isArray(source.tags)
      ? source.tags.map((tag: unknown) => String(tag).trim()).filter(Boolean)
      : String(source.tags || "")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean);
  }
  if (source.status !== undefined) {
    const status = String(source.status).toUpperCase();
    if (!new Set(["ACTIVE", "ARCHIVED", "DRAFT", "UNLISTED"]).has(status)) {
      throw badRequest("Invalid product status.");
    }
    input.status = status;
  }
  if (source.handle !== undefined) {
    const handle = String(source.handle || "").trim();
    if (handle && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(handle)) {
      throw badRequest("Product handle is invalid.");
    }
    input.handle = handle;
    input.redirectNewHandle = true;
  }
  if (Object.prototype.hasOwnProperty.call(source, "templateSuffix")) {
    input.templateSuffix = source.templateSuffix
      ? String(source.templateSuffix).trim()
      : null;
  }
  if (Object.prototype.hasOwnProperty.call(source, "categoryId")) {
    const categoryId = source.categoryId;
    if (categoryId === null || categoryId === "") input.category = null;
    else input.category = requireGid(categoryId, "TaxonomyCategory", "Category ID");
  }
  if (source.seo !== undefined) {
    const seo = asRecord(source.seo, "SEO input");
    const title = String(seo.title ?? "").trim();
    const description = String(seo.description ?? "").trim();
    if (title.length > 255 || description.length > 320) {
      throw badRequest("SEO title or description is too long.");
    }
    input.seo = { title, description };
  }
  if (source.requiresSellingPlan !== undefined) {
    if (typeof source.requiresSellingPlan !== "boolean") {
      throw badRequest("requiresSellingPlan must be a boolean.");
    }
    input.requiresSellingPlan = source.requiresSellingPlan;
  }
  for (const field of ["collectionsToJoin", "collectionsToLeave"] as const) {
    if (source[field] === undefined) continue;
    if (!Array.isArray(source[field]) || source[field].length > 250) {
      throw badRequest(`${field} must contain no more than 250 collection IDs.`);
    }
    input[field] = Array.from(
      new Set(
        source[field].map((value) => requireGid(value, "Collection", "Collection ID")),
      ),
    );
  }
  if (Object.keys(input).length === 1) throw badRequest("No advanced changes found.");
  const data = await callShopifyGraphql<{
    productUpdate: { product: { id: string } | null; userErrors: GraphqlUserError[] };
  }>({
    ...context,
    operationName: "UpdateProductAdvancedDetails",
    retryTransport: false,
    query: `#graphql
      mutation UpdateProductAdvancedDetails($product: ProductUpdateInput!) {
        productUpdate(product: $product) {
          product { id }
          userErrors { field message }
        }
      }
    `,
    variables: { product: input },
  });
  assertNoGraphqlUserErrors(
    data.productUpdate.userErrors,
    "Failed to update advanced product fields.",
  );
  if (!data.productUpdate.product) throw badGateway("Missing updated product.");
  return fetchProductAdvancedDetails(context, productId);
}

export async function listProductMedia(
  context: ProductRequestContext,
  productId: ShopifyNumericId,
): Promise<ProductMediaResponse> {
  const id = buildShopifyGid("Product", productId);
  const items: ProductMediaSummary[] = [];
  let after: string | null = null;
  let hasNextPage: boolean;
  do {
    const data: {
      product: {
        media: {
          nodes: RawProductMedia[];
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
        };
      } | null;
    } = await callShopifyGraphql({
      ...context,
      operationName: "ProductMediaPage",
      query: `#graphql
        query ProductMediaPage($id: ID!, $first: Int!, $after: String) {
          product(id: $id) {
            media(first: $first, after: $after) {
              nodes {
                id alt mediaContentType status
                preview { status image { url } }
                ... on ExternalVideo { embedUrl originUrl host }
                ... on Video { sources { url mimeType } }
                ... on Model3d { sources { url mimeType } }
                ... on MediaImage { image { url } }
              }
              pageInfo { hasNextPage endCursor }
            }
          }
        }
      `,
      variables: {
        id,
        first: Math.min(50, MAX_CONTEXT_ITEMS - items.length),
        after,
      },
    });
    if (!data.product) throw notFound("Product not found.");
    items.push(...data.product.media.nodes.map(normalizeProductMedia));
    hasNextPage = data.product.media.pageInfo.hasNextPage;
    after = data.product.media.pageInfo.endCursor;
  } while (hasNextPage && after && items.length < MAX_CONTEXT_ITEMS);
  return { items, truncated: hasNextPage };
}

export async function createProductMedia(
  context: ProductRequestContext,
  productId: ShopifyNumericId,
  rawInput: unknown,
) {
  const source = asRecord(rawInput, "Product media input");
  const type = String(source.type || "").toUpperCase() as ProductMediaContentType;
  if (!PRODUCT_MEDIA_TYPES.has(type)) throw badRequest("Invalid product media type.");
  const originalSource = String(source.originalSource || "").trim();
  if (!/^https:\/\//i.test(originalSource)) {
    throw badRequest("Product media must use an HTTPS source URL.");
  }
  const alt = String(source.alt || "").trim();
  if (alt.length > 512) throw badRequest("Media alt text is too long.");
  const id = buildShopifyGid("Product", productId);
  const data = await callShopifyGraphql<{
    productUpdate: { product: { id: string } | null; userErrors: GraphqlUserError[] };
  }>({
    ...context,
    operationName: "AddProductMedia",
    retryTransport: false,
    query: `#graphql
      mutation AddProductMedia(
        $product: ProductUpdateInput!
        $media: [CreateMediaInput!]
      ) {
        productUpdate(product: $product, media: $media) {
          product { id }
          userErrors { field message }
        }
      }
    `,
    variables: {
      product: { id },
      media: [{ originalSource, mediaContentType: type, ...(alt ? { alt } : {}) }],
    },
  });
  assertNoGraphqlUserErrors(data.productUpdate.userErrors, "Failed to add media.");
  if (!data.productUpdate.product) throw badGateway("Missing updated product.");
  return { success: true };
}

export async function runBulkProductAction(
  context: ProductRequestContext,
  productIds: ShopifyNumericId[],
  action: "ARCHIVE" | "DELETE",
): Promise<BulkProductActionResult> {
  const failedIds: ShopifyNumericId[] = [];
  for (
    let offset = 0;
    offset < productIds.length;
    offset += PRODUCT_ACTION_BATCH_SIZE
  ) {
    const batch = productIds.slice(offset, offset + PRODUCT_ACTION_BATCH_SIZE);
    const definitions = batch.map((_, index) => `$product${index}: ID!`);
    const fields = batch.map((_, index) =>
      action === "DELETE"
        ? `action${index}: productDelete(input: { id: $product${index} }) { deletedProductId userErrors { field message } }`
        : `action${index}: productChangeStatus(productId: $product${index}, status: ARCHIVED) { product { id status } userErrors { field message } }`,
    );
    const data = await callShopifyGraphql<
      Record<
        string,
        {
          deletedProductId?: string | null;
          product?: { id: string; status: string } | null;
          userErrors: GraphqlUserError[];
        }
      >
    >({
      ...context,
      operationName: action === "DELETE" ? "BulkDeleteProducts" : "BulkArchiveProducts",
      retryTransport: false,
      query: `#graphql
        mutation ${action === "DELETE" ? "BulkDeleteProducts" : "BulkArchiveProducts"}(${definitions.join(", ")}) {
          ${fields.join("\n")}
        }
      `,
      variables: Object.fromEntries(
        batch.map((productId, index) => [
          `product${index}`,
          buildShopifyGid("Product", productId),
        ]),
      ),
    });
    batch.forEach((productId, index) => {
      const result = data[`action${index}`];
      if (
        !result ||
        result.userErrors.length ||
        (action === "DELETE" && !result.deletedProductId) ||
        (action === "ARCHIVE" && result.product?.status !== "ARCHIVED")
      ) {
        failedIds.push(productId);
      }
    });
  }
  return {
    total: productIds.length,
    succeeded: productIds.length - failedIds.length,
    failedIds,
  };
}

export async function duplicateProduct(
  context: ProductRequestContext,
  productId: ShopifyNumericId,
  rawInput: unknown,
): Promise<ProductDuplicateResult> {
  const source = asRecord(rawInput, "Product duplicate input");
  const newTitle = String(source.newTitle || "").trim();
  if (!newTitle || newTitle.length > 255) {
    throw badRequest("A new product title is required.");
  }
  const newStatus = String(source.newStatus || "DRAFT").toUpperCase();
  if (!new Set(["ACTIVE", "ARCHIVED", "DRAFT", "UNLISTED"]).has(newStatus)) {
    throw badRequest("Invalid duplicate product status.");
  }
  const data = await callShopifyGraphql<{
    productDuplicate: {
      newProduct: { legacyResourceId: ShopifyNumericId; title: string } | null;
      productDuplicateOperation: { id: string; status: string } | null;
      userErrors: GraphqlUserError[];
    };
  }>({
    ...context,
    operationName: "DuplicateProduct",
    retryTransport: false,
    query: `#graphql
      mutation DuplicateProduct(
        $productId: ID!
        $newTitle: String!
        $newStatus: ProductStatus
      ) {
        productDuplicate(
          productId: $productId
          newTitle: $newTitle
          newStatus: $newStatus
          includeImages: true
          includeTranslations: true
          synchronous: false
        ) {
          newProduct { legacyResourceId title }
          productDuplicateOperation { id status }
          userErrors { field message }
        }
      }
    `,
    variables: {
      productId: buildShopifyGid("Product", productId),
      newTitle,
      newStatus,
    },
  });
  assertNoGraphqlUserErrors(
    data.productDuplicate.userErrors,
    "Failed to duplicate the product.",
  );
  return {
    queued: Boolean(data.productDuplicate.productDuplicateOperation),
    operationId: data.productDuplicate.productDuplicateOperation?.id || null,
    product: data.productDuplicate.newProduct
      ? {
          id: data.productDuplicate.newProduct.legacyResourceId,
          title: data.productDuplicate.newProduct.title,
        }
      : null,
  };
}

function normalizeProductMedia(media: RawProductMedia): ProductMediaSummary {
  const source = media.sources?.[0]?.url || media.image?.url || null;
  return {
    id: media.id,
    alt: media.alt,
    type: media.mediaContentType,
    status: media.status,
    previewUrl: media.preview?.image?.url || media.image?.url || null,
    originalUrl: media.originUrl || media.embedUrl || source,
    host: media.host || null,
  };
}

function requireGid(value: unknown, resource: string, label: string) {
  const id = String(value || "").trim();
  if (!id.startsWith(`gid://shopify/${resource}/`) || id.includes("?")) {
    throw badRequest(`${label} is invalid.`);
  }
  return id;
}

function asRecord(value: unknown, label: string): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw badRequest(`${label} is required.`);
  }
  return value as Record<string, any>;
}

function badRequest(message: string) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

function notFound(message: string) {
  return Object.assign(new Error(message), { statusCode: 404 });
}

function badGateway(message: string) {
  return Object.assign(new Error(message), { statusCode: 502 });
}

interface RawProductMedia {
  id: string;
  alt: string | null;
  mediaContentType: ProductMediaContentType;
  status: string;
  preview: { status: string; image: { url: string } | null } | null;
  embedUrl?: string | null;
  originUrl?: string | null;
  host?: string | null;
  sources?: Array<{ url: string; mimeType: string }>;
  image?: { url: string } | null;
}
