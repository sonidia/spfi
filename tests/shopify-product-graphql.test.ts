import assert from "node:assert/strict";
import test from "node:test";
import { buildPublicationMutation } from "../server/utils/shopify-product-publication-input.ts";
import { buildProductOptionUpdateMutation } from "../server/utils/shopify-product-option-input.ts";
import { toBulkVariantInput } from "../server/utils/shopify-product-variant-input.ts";

test("bulk publication uses one aliased GraphQL mutation without losing 64-bit IDs", () => {
  const mutation = buildPublicationMutation(
    ["9007199254740993", 42],
    "gid://shopify/Publication/7",
    true,
  );

  assert.match(mutation.query, /activation0: productUpdate/);
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

test("product option updates use targeted aliased mutations", () => {
  const mutation = buildProductOptionUpdateMutation("9007199254740993", [
    { id: "101", name: "Color", position: 1, values: ["Black"] },
    { id: "102", name: "Size", position: 2, values: ["M"] },
  ]);

  assert.match(mutation.query, /option0: productOptionUpdate/);
  assert.match(mutation.query, /option1: productOptionUpdate/);
  assert.deepEqual(mutation.variables, {
    productId: "gid://shopify/Product/9007199254740993",
    option0: {
      id: "gid://shopify/ProductOption/101",
      name: "Color",
      position: 1,
    },
    option1: {
      id: "gid://shopify/ProductOption/102",
      name: "Size",
      position: 2,
    },
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
