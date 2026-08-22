import { createError } from "h3";
import type {
  CollectionCreateDto,
  CollectionDuplicateDto,
  CollectionMetafieldIdentifier,
  CollectionMetafieldInput,
  CollectionMetadataInput,
  CollectionProductSortOrder,
  CollectionSelectionDelta,
  CollectionUpdateDto,
} from "~~/types/shopify-collection";

const SHOPIFY_GID_PATTERN = /^gid:\/\/shopify\/([A-Za-z][A-Za-z0-9]*)\/([^/]+)$/;
const COLLECTION_SORT_ORDERS = new Set<CollectionProductSortOrder>([
  "ALPHA_ASC",
  "ALPHA_DESC",
  "BEST_SELLING",
  "CREATED",
  "CREATED_DESC",
  "MANUAL",
  "MOST_RELEVANT",
  "PRICE_ASC",
  "PRICE_DESC",
]);
const MAX_GRAPHQL_ARRAY_SIZE = 250;
const MAX_METAFIELDS_SET = 25;
const MAX_TEXT_SIZE = 1_000_000;

export function requireCollectionGid(value: unknown) {
  return requireShopifyGid(value, "Collection");
}

export function requireCollectionSourceGid(value: unknown) {
  const normalized = String(value || "").trim();
  const match = normalized.match(SHOPIFY_GID_PATTERN);
  if (!match || !isCollectionSourceResource(match[1] || "")) {
    throw createApiErrorFromMessage(
      "A CollectionConditionsSource or CollectionSubCollectionsSource GID is required.",
      400,
    );
  }
  return normalized;
}

export function requireJobGid(value: unknown) {
  return requireShopifyGid(value, "Job");
}

export function requireProductGids(values: unknown, fieldName = "productIds") {
  return requireShopifyGids(values, "Product", fieldName);
}

export function requirePublicationGids(values: unknown, fieldName = "publicationIds") {
  return requireShopifyGids(values, "Publication", fieldName);
}

export function validateCollectionCreateDto(value: unknown): CollectionCreateDto {
  const input = requireRecord(value, "Collection");
  const title = requireText(input.title, "Collection title", 255);
  const metadata = normalizeCollectionMetadata(input, true);
  const productIds = requireProductGids(input.productIds || [], "productIds");
  const publicationIds = requirePublicationGids(
    input.publicationIds || [],
    "publicationIds",
  );

  return {
    ...metadata,
    title,
    sourceTitle:
      optionalText(input.sourceTitle, "Source title", 255) || `${title} products`,
    productIds,
    publicationIds,
  };
}

export function validateCollectionUpdateDto(value: unknown): CollectionUpdateDto {
  const input = requireRecord(value, "Collection update");
  const metadata = normalizeCollectionMetadata(input, false);
  const updatedAt = optionalText(input.updatedAt, "updatedAt", 64);

  if (!Object.keys(metadata).length) {
    throw createApiErrorFromMessage(
      "At least one supported collection field is required.",
      400,
    );
  }
  return { ...metadata, ...(updatedAt ? { updatedAt } : {}) };
}

export function validateCollectionDuplicateDto(value: unknown): CollectionDuplicateDto {
  const input = requireRecord(value, "Collection duplicate");
  if (
    Object.hasOwn(input, "copyPublications") &&
    typeof input.copyPublications !== "boolean"
  ) {
    throw createApiErrorFromMessage("copyPublications must be a boolean.", 400);
  }
  return {
    newTitle: requireText(input.newTitle, "Duplicate collection title", 255),
    copyPublications:
      typeof input.copyPublications === "boolean" ? input.copyPublications : true,
  };
}

export function validateCollectionSelectionDelta(
  value: unknown,
): CollectionSelectionDelta {
  const input = requireRecord(value, "Collection selection delta");
  const sourceId = requireCollectionSourceGid(input.sourceId);
  if (!sourceId.includes("/CollectionConditionsSource/")) {
    throw createApiErrorFromMessage(
      "Manual selections can only be changed on a CollectionConditionsSource.",
      400,
    );
  }
  const productIdsToAdd = requireProductGids(
    input.productIdsToAdd || [],
    "productIdsToAdd",
  );
  const productIdsToRemove = requireProductGids(
    input.productIdsToRemove || [],
    "productIdsToRemove",
  );
  const removals = new Set(productIdsToRemove);
  const additions = productIdsToAdd.filter((id) => !removals.has(id));

  if (!additions.length && !productIdsToRemove.length) {
    throw createApiErrorFromMessage("A non-empty selection delta is required.", 400);
  }
  return { sourceId, productIdsToAdd: additions, productIdsToRemove };
}

export function validateCollectionMetafieldInputs(
  value: unknown,
): CollectionMetafieldInput[] {
  if (!Array.isArray(value) || !value.length || value.length > MAX_METAFIELDS_SET) {
    throw createApiErrorFromMessage(
      `Provide between 1 and ${MAX_METAFIELDS_SET} metafields.`,
      400,
    );
  }
  const seen = new Set<string>();
  return value.map((entry, index) => {
    const input = requireRecord(entry, `Metafield ${index + 1}`);
    const namespace = validateMetafieldPart(input.namespace, "namespace", 3, 255);
    const key = validateMetafieldPart(input.key, "key", 2, 64);
    const identity = `${namespace}\u0000${key}`;
    if (seen.has(identity)) {
      throw createApiErrorFromMessage(`Duplicate metafield ${namespace}.${key}.`, 400);
    }
    seen.add(identity);
    const compareDigest = Object.hasOwn(input, "compareDigest")
      ? input.compareDigest === null
        ? null
        : requireText(input.compareDigest, "Metafield compare digest", 255)
      : undefined;
    const metafieldValue = String(input.value ?? "");
    if (metafieldValue.length > MAX_TEXT_SIZE) {
      throw createApiErrorFromMessage("Metafield value is too long.", 400);
    }
    return {
      namespace,
      key,
      type: requireText(input.type, "Metafield type", 255),
      value: metafieldValue,
      ...(compareDigest !== undefined ? { compareDigest } : {}),
    };
  });
}

export function validateCollectionMetafieldIdentifiers(
  value: unknown,
): CollectionMetafieldIdentifier[] {
  if (!Array.isArray(value) || !value.length || value.length > MAX_GRAPHQL_ARRAY_SIZE) {
    throw createApiErrorFromMessage(
      `Provide between 1 and ${MAX_GRAPHQL_ARRAY_SIZE} metafield identifiers.`,
      400,
    );
  }
  const seen = new Set<string>();
  return value.map((entry, index) => {
    const input = requireRecord(entry, `Metafield identifier ${index + 1}`);
    const namespace = validateMetafieldPart(input.namespace, "namespace", 3, 255);
    const key = validateMetafieldPart(input.key, "key", 2, 64);
    const identity = `${namespace}\u0000${key}`;
    if (seen.has(identity)) {
      throw createApiErrorFromMessage(`Duplicate metafield ${namespace}.${key}.`, 400);
    }
    seen.add(identity);
    return { namespace, key };
  });
}

export function toCollectionCreateInput(input: CollectionCreateDto) {
  const metadata = toCollectionMetadataInput(input);
  delete metadata.redirectNewHandle;
  if (!metadata.handle) delete metadata.handle;
  return {
    ...metadata,
    title: input.title,
    sources: [
      {
        source: {
          title: input.sourceTitle || `${input.title} products`,
          targetType: "PRODUCTS" as const,
          inclusion: {
            selections: (input.productIds || []).map((productId) => ({ productId })),
          },
        },
      },
    ],
  };
}

export function toCollectionUpdateInput(id: string, input: CollectionUpdateDto) {
  return { id, ...toCollectionMetadataInput(input) };
}

export function buildCollectionSelectionUpdateInput(
  collectionId: string,
  delta: CollectionSelectionDelta,
) {
  const inclusion = {
    ...(delta.productIdsToAdd?.length
      ? {
          selectionsToAdd: delta.productIdsToAdd.map((productId) => ({
            productId,
          })),
        }
      : {}),
    ...(delta.productIdsToRemove?.length
      ? {
          selectionsToRemove: delta.productIdsToRemove.map((productId) => ({
            productId,
          })),
        }
      : {}),
  };
  return {
    id: collectionId,
    sourcesToUpdate: [{ condition: { id: delta.sourceId, inclusion } }],
  };
}

function normalizeCollectionMetadata(
  input: Record<string, unknown>,
  creating: boolean,
): CollectionMetadataInput {
  const output: CollectionMetadataInput = {};
  if (!creating && Object.hasOwn(input, "title")) {
    output.title = requireText(input.title, "Collection title", 255);
  }
  copyOptionalText(input, output, "descriptionHtml", "Description", MAX_TEXT_SIZE);
  copyOptionalText(input, output, "handle", "Handle", 255);
  copyOptionalNullableText(input, output, "templateSuffix", "Template suffix", 255);

  if (Object.hasOwn(input, "sortOrder")) {
    const sortOrder = String(
      input.sortOrder || "",
    ).trim() as CollectionProductSortOrder;
    if (!COLLECTION_SORT_ORDERS.has(sortOrder)) {
      throw createApiErrorFromMessage("Unsupported collection sort order.", 400);
    }
    output.sortOrder = sortOrder;
  }
  if (Object.hasOwn(input, "redirectNewHandle")) {
    if (typeof input.redirectNewHandle !== "boolean") {
      throw createApiErrorFromMessage("redirectNewHandle must be a boolean.", 400);
    }
    output.redirectNewHandle = input.redirectNewHandle;
  }
  if (Object.hasOwn(input, "seo")) output.seo = normalizeSeo(input.seo);
  if (Object.hasOwn(input, "image")) output.image = normalizeImage(input.image);
  return output;
}

function toCollectionMetadataInput(input: CollectionMetadataInput) {
  return Object.fromEntries(
    Object.entries(input).filter(
      ([key, value]) =>
        !["productIds", "publicationIds", "sourceTitle", "updatedAt"].includes(key) &&
        value !== undefined,
    ),
  );
}

function normalizeSeo(value: unknown) {
  const input = requireRecord(value, "SEO");
  return {
    ...(Object.hasOwn(input, "title")
      ? { title: optionalText(input.title, "SEO title", 255) }
      : {}),
    ...(Object.hasOwn(input, "description")
      ? {
          description: optionalText(input.description, "SEO description", 500),
        }
      : {}),
  };
}

function normalizeImage(value: unknown) {
  if (value === null) return null;
  const input = requireRecord(value, "Image");
  const src = optionalText(input.src, "Image URL", 2048);
  const altText = optionalText(input.altText, "Image alt text", 512);
  if (src && !isAllowedImageSource(src)) {
    throw createApiErrorFromMessage(
      "Collection image must use an HTTPS or Shopify staged-upload URL.",
      400,
    );
  }
  if (!src && !altText) {
    throw createApiErrorFromMessage("Collection image is empty.", 400);
  }
  return { ...(src ? { src } : {}), ...(altText ? { altText } : {}) };
}

function requireShopifyGids(values: unknown, resource: string, fieldName: string) {
  if (!Array.isArray(values)) {
    throw createApiErrorFromMessage(`${fieldName} must be an array.`, 400);
  }
  if (values.length > MAX_GRAPHQL_ARRAY_SIZE) {
    throw createApiErrorFromMessage(
      `${fieldName} cannot contain more than ${MAX_GRAPHQL_ARRAY_SIZE} items.`,
      400,
    );
  }
  return [...new Set(values.map((value) => requireShopifyGid(value, resource)))];
}

function requireShopifyGid(value: unknown, resource: string) {
  const normalized = String(value || "").trim();
  if (/^\d+$/.test(normalized)) return `gid://shopify/${resource}/${normalized}`;
  const match = normalized.match(SHOPIFY_GID_PATTERN);
  if (!match || match[1] !== resource || !match[2]) {
    throw createApiErrorFromMessage(`A Shopify ${resource} ID is required.`, 400);
  }
  return normalized;
}

function requireRecord(value: unknown, name: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw createApiErrorFromMessage(`${name} payload is required.`, 400);
  }
  return value as Record<string, unknown>;
}

function requireText(value: unknown, name: string, maxLength: number) {
  const normalized = String(value || "").trim();
  if (!normalized) throw createApiErrorFromMessage(`${name} is required.`, 400);
  if (normalized.length > maxLength) {
    throw createApiErrorFromMessage(`${name} is too long.`, 400);
  }
  return normalized;
}

function optionalText(value: unknown, name: string, maxLength: number) {
  const normalized = String(value ?? "").trim();
  if (normalized.length > maxLength) {
    throw createApiErrorFromMessage(`${name} is too long.`, 400);
  }
  return normalized;
}

function copyOptionalText(
  input: Record<string, unknown>,
  output: CollectionMetadataInput,
  key: "descriptionHtml" | "handle",
  name: string,
  maxLength: number,
) {
  if (Object.hasOwn(input, key))
    output[key] = optionalText(input[key], name, maxLength);
}

function copyOptionalNullableText(
  input: Record<string, unknown>,
  output: CollectionMetadataInput,
  key: "templateSuffix",
  name: string,
  maxLength: number,
) {
  if (!Object.hasOwn(input, key)) return;
  output[key] = input[key] === null ? null : optionalText(input[key], name, maxLength);
}

function isAllowedImageSource(value: string) {
  if (/^https:\/\//i.test(value)) return true;
  return /^(tmp|staged-uploads)\//i.test(value);
}

function validateMetafieldPart(
  value: unknown,
  name: string,
  minLength: number,
  maxLength: number,
) {
  const normalized = String(value || "").trim();
  if (
    normalized.length < minLength ||
    normalized.length > maxLength ||
    !/^[A-Za-z0-9_-]+$/.test(normalized)
  ) {
    throw createApiErrorFromMessage(
      `Metafield ${name} must be ${minLength}-${maxLength} letters, numbers, underscores, or hyphens.`,
      400,
    );
  }
  return normalized;
}

function isCollectionSourceResource(value: string) {
  return (
    value === "CollectionConditionsSource" || value === "CollectionSubCollectionsSource"
  );
}

function createApiErrorFromMessage(message: string, statusCode: number) {
  return createError({ statusCode, statusMessage: message, message });
}
