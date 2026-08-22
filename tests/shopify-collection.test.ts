import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildCollectionSearchQuery,
  resolveCollectionSort,
} from "../server/utils/shopify-collection-query.ts";
import {
  buildCollectionSelectionUpdateInput,
  requireJobGid,
  toCollectionCreateInput,
  validateCollectionCreateDto,
  validateCollectionDuplicateDto,
  validateCollectionMetafieldIdentifiers,
  validateCollectionMetafieldInputs,
  validateCollectionSelectionDelta,
} from "../server/utils/shopify-collection-validation.ts";

test("collection reads use the 2026-07 sources model without legacy collection type", () => {
  const COLLECTIONS_PAGE_QUERY = readFileSync(
    new URL("../server/utils/shopify-collection-list.ts", import.meta.url),
    "utf8",
  );
  const COLLECTION_DETAIL_QUERY = readFileSync(
    new URL("../server/utils/shopify-collection-detail.ts", import.meta.url),
    "utf8",
  );
  const COLLECTION_MANAGEMENT_MUTATIONS = readFileSync(
    new URL("../server/utils/shopify-collection-management.ts", import.meta.url),
    "utf8",
  );
  const COLLECTION_LOCALIZATION = readFileSync(
    new URL("../server/utils/shopify-collection-localization.ts", import.meta.url),
    "utf8",
  );
  assert.match(COLLECTIONS_PAGE_QUERY, /sources\s*\{/);
  assert.match(COLLECTIONS_PAGE_QUERY, /__typename/);
  assert.match(COLLECTION_DETAIL_QUERY, /CollectionConditionsSource/);
  assert.match(COLLECTION_DETAIL_QUERY, /CollectionSubCollectionsSource/);
  assert.match(COLLECTION_DETAIL_QUERY, /CollectionSourceInclusionConditionUnknown/);
  const detailOperation = COLLECTION_DETAIL_QUERY.match(
    /export const COLLECTION_DETAIL_QUERY = `([\s\S]*?)`;/,
  )?.[1];
  assert.ok(detailOperation, "collection detail operation must be exported");
  assert.match(
    detailOperation,
    /inclusion\s*\{[\s\S]*?selections\(first:\s*50\)[\s\S]*?variantIds/,
  );
  const exclusionSelections = detailOperation.match(
    /exclusion\s*\{[\s\S]*?selections\(first:\s*50\)\s*\{\s*nodes\s*\{([\s\S]*?)\}\s*pageInfo/,
  )?.[1];
  assert.ok(exclusionSelections, "exclusion selections must be queried");
  assert.doesNotMatch(exclusionSelections, /variantIds/);
  assert.match(
    COLLECTION_DETAIL_QUERY,
    /resourcePublications\(first:\s*250,\s*onlyPublished:\s*false\)/,
  );
  assert.doesNotMatch(COLLECTIONS_PAGE_QUERY, /ruleSet|collection_type/);
  assert.doesNotMatch(COLLECTION_DETAIL_QUERY, /ruleSet|collectionAddProducts/);
  assert.match(COLLECTION_MANAGEMENT_MUTATIONS, /job\s*\{\s*id\s+done\s*\}/);
  assert.match(
    COLLECTION_MANAGEMENT_MUTATIONS,
    /collectionDuplicate\(input:\s*\$input\)/,
  );
  assert.match(COLLECTION_DETAIL_QUERY, /metafields\(first:\s*50\)/);
  assert.match(COLLECTION_DETAIL_QUERY, /compareDigest/);
  assert.match(
    COLLECTION_LOCALIZATION,
    /translatableContent\s*\{\s*key\s+value\s+digest/,
  );
  assert.match(COLLECTION_LOCALIZATION, /translationsRegister/);
  assert.match(COLLECTION_LOCALIZATION, /translationsRemove/);
});

test("collection metafields use bounded CAS inputs and typed identifiers", () => {
  assert.deepEqual(
    validateCollectionMetafieldInputs([
      {
        namespace: " custom ",
        key: "subtitle",
        type: "single_line_text_field",
        value: "Summer",
        compareDigest: null,
      },
    ]),
    [
      {
        namespace: "custom",
        key: "subtitle",
        type: "single_line_text_field",
        value: "Summer",
        compareDigest: null,
      },
    ],
  );
  assert.deepEqual(
    validateCollectionMetafieldIdentifiers([{ namespace: "custom", key: "subtitle" }]),
    [{ namespace: "custom", key: "subtitle" }],
  );
  assert.throws(
    () =>
      validateCollectionMetafieldInputs([
        { namespace: "x", key: "a", type: "string", value: "bad" },
      ]),
    /namespace/,
  );
});

test("collection duplication validates title and publication behavior", () => {
  assert.deepEqual(
    validateCollectionDuplicateDto({
      newTitle: " Summer copy ",
      copyPublications: false,
    }),
    { newTitle: "Summer copy", copyPublications: false },
  );
  assert.deepEqual(validateCollectionDuplicateDto({ newTitle: "Copy" }), {
    newTitle: "Copy",
    copyPublications: true,
  });
  assert.throws(
    () =>
      validateCollectionDuplicateDto({
        newTitle: "Copy",
        copyPublications: "yes",
      }),
    /copyPublications/,
  );
});

test("collection update jobs use typed IDs", () => {
  assert.equal(
    requireJobGid("gid://shopify/Job/dc9b2604-c73b-45c6-8942-e235bac987e8"),
    "gid://shopify/Job/dc9b2604-c73b-45c6-8942-e235bac987e8",
  );
  assert.throws(() => requireJobGid("gid://shopify/Collection/1"), /Shopify Job ID/);
});

test("manual collection creation maps IDs into a product-targeted source", () => {
  const dto = validateCollectionCreateDto({
    title: " Summer edit ",
    handle: "",
    sourceTitle: "Featured products",
    productIds: ["42", "gid://shopify/Product/9007199254740993", "42"],
    publicationIds: ["7"],
    sortOrder: "MOST_RELEVANT",
  });
  const input = toCollectionCreateInput(dto);

  assert.deepEqual(input, {
    title: "Summer edit",
    sortOrder: "MOST_RELEVANT",
    sources: [
      {
        source: {
          title: "Featured products",
          targetType: "PRODUCTS",
          inclusion: {
            selections: [
              { productId: "gid://shopify/Product/42" },
              { productId: "gid://shopify/Product/9007199254740993" },
            ],
          },
        },
      },
    ],
  });
  assert.deepEqual(dto.publicationIds, ["gid://shopify/Publication/7"]);
});

test("selection updates are source-aware deltas and reject incompatible GIDs", () => {
  const delta = validateCollectionSelectionDelta({
    sourceId: "gid://shopify/CollectionConditionsSource/5",
    productIdsToAdd: ["1", "2"],
    productIdsToRemove: ["2", "3"],
  });
  assert.deepEqual(
    buildCollectionSelectionUpdateInput("gid://shopify/Collection/9", delta),
    {
      id: "gid://shopify/Collection/9",
      sourcesToUpdate: [
        {
          condition: {
            id: "gid://shopify/CollectionConditionsSource/5",
            inclusion: {
              selectionsToAdd: [{ productId: "gid://shopify/Product/1" }],
              selectionsToRemove: [
                { productId: "gid://shopify/Product/2" },
                { productId: "gid://shopify/Product/3" },
              ],
            },
          },
        },
      ],
    },
  );
  assert.throws(
    () =>
      validateCollectionSelectionDelta({
        sourceId: "gid://shopify/CollectionSubCollectionsSource/5",
        productIdsToAdd: ["1"],
      }),
    /CollectionConditionsSource/,
  );
  assert.throws(
    () =>
      validateCollectionCreateDto({
        title: "Invalid",
        productIds: ["gid://shopify/ProductVariant/1"],
      }),
    /Product ID/,
  );
});

test("collection filters are allowlisted and relevance needs a search term", () => {
  const query = buildCollectionSearchQuery({
    search: 'Summer "drop"',
    productId: "gid://shopify/Product/42",
    publishedStatus: "published",
    updatedAtMin: "2026-08-01",
  });
  assert.match(query, /title:"Summer \\"drop\\"\*"/);
  assert.match(query, /product_id:42/);
  assert.match(query, /published_status:"published"/);
  assert.doesNotMatch(query, /collection_type/);
  assert.deepEqual(resolveCollectionSort({ sortKey: "RELEVANCE" }), {
    sortKey: "UPDATED_AT",
    reverse: true,
  });
  assert.deepEqual(
    resolveCollectionSort({ search: "summer", sortKey: "RELEVANCE", reverse: false }),
    { sortKey: "RELEVANCE", reverse: false },
  );
});
