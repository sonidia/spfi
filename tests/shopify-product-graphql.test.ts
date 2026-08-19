import assert from "node:assert/strict";
import test from "node:test";
import { buildPublicationMutation } from "../server/utils/shopify-product-publication-input.ts";
import {
  buildProductOptionsCreateMutation,
  buildProductOptionUpdateMutation,
} from "../server/utils/shopify-product-option-input.ts";
import { isOnlineStorePublication } from "../server/utils/shopify-publication.ts";
import { toBulkVariantInput } from "../server/utils/shopify-product-variant-input.ts";

test("bulk publication uses one aliased GraphQL mutation without losing 64-bit IDs", () => {
  const mutation = buildPublicationMutation(
    ["9007199254740993", 42],
    "gid://shopify/Publication/7",
    true,
  );

  assert.doesNotMatch(mutation.query, /productUpdate|status: ACTIVE/);
  assert.match(mutation.query, /publication1: publishablePublish/);
  assert.deepEqual(mutation.variables, {
    product0: "gid://shopify/Product/9007199254740993",
    product1: "gid://shopify/Product/42",
    publicationInput: [{ publicationId: "gid://shopify/Publication/7" }],
  });
});

test("bulk publication can target multiple selected sales channels", () => {
  const mutation = buildPublicationMutation(
    ["42"],
    ["gid://shopify/Publication/7", "gid://shopify/Publication/8"],
    false,
  );

  assert.doesNotMatch(mutation.query, /productUpdate/);
  assert.match(mutation.query, /publishableUnpublish/);
  assert.deepEqual(mutation.variables.publicationInput, [
    { publicationId: "gid://shopify/Publication/7" },
    { publicationId: "gid://shopify/Publication/8" },
  ]);
});

test("online store publication detection uses the stable channel handle", () => {
  assert.equal(
    isOnlineStorePublication({
      channels: { nodes: [{ handle: "online_store" }] },
    }),
    true,
  );
  assert.equal(
    isOnlineStorePublication({
      channels: { nodes: [{ handle: "point_of_sale" }] },
    }),
    false,
  );
});

test("product option updates use targeted aliased mutations", () => {
  const mutation = buildProductOptionUpdateMutation("9007199254740993", [
    {
      option: { id: "101", name: "Color", position: 1 },
      optionValuesToAdd: [{ name: "Green" }],
    },
    {
      option: { id: "102", name: "Size", position: 2 },
      optionValuesToUpdate: [{ id: "202", name: "Medium" }],
    },
  ]);

  assert.match(mutation.query, /option0: productOptionUpdate/);
  assert.match(mutation.query, /option1: productOptionUpdate/);
  assert.equal(mutation.variables.productId, "gid://shopify/Product/9007199254740993");
  assert.equal(mutation.variables.variantStrategy, "LEAVE_AS_IS");
  assert.deepEqual(mutation.variables.option0ValuesToAdd, [{ name: "Green" }]);
  assert.deepEqual(mutation.variables.option1ValuesToUpdate, [
    { id: "gid://shopify/ProductOptionValue/202", name: "Medium" },
  ]);
});

test("product option creation forwards values and linked metafields", () => {
  const mutation = buildProductOptionsCreateMutation(
    "42",
    [
      {
        name: "Color",
        position: 2,
        values: [{ name: "Blue" }],
        linkedMetafield: { namespace: "shopify", key: "color-pattern" },
      },
    ],
    "CREATE",
  );

  assert.match(mutation.query, /productOptionsCreate/);
  assert.deepEqual(mutation.variables, {
    productId: "gid://shopify/Product/42",
    options: [
      {
        name: "Color",
        position: 2,
        values: [{ name: "Blue" }],
        linkedMetafield: { namespace: "shopify", key: "color-pattern" },
      },
    ],
    variantStrategy: "CREATE",
  });
});

test("bulk variant inputs map REST fields to the new GraphQL product model", () => {
  assert.deepEqual(
    toBulkVariantInput(
      {
        id: "9007199254740993",
        option1: "Black",
        option2: "M",
        price: "19.99",
        compare_at_price: null,
        sku: "SHIRT-BLK-M",
        requires_shipping: true,
        inventory_management: "shopify",
        inventory_policy: "continue",
        taxable: true,
      },
      ["Color", "Size"],
      true,
    ),
    {
      id: "gid://shopify/ProductVariant/9007199254740993",
      price: "19.99",
      compareAtPrice: null,
      inventoryPolicy: "CONTINUE",
      taxable: true,
      inventoryItem: {
        sku: "SHIRT-BLK-M",
        requiresShipping: true,
        tracked: true,
      },
      optionValues: [
        { optionName: "Color", name: "Black" },
        { optionName: "Size", name: "M" },
      ],
    },
  );
});
