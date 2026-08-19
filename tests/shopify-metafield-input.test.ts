import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeShopifyMetafieldInput,
  serializeShopifyMetafieldValue,
} from "../server/utils/shopify-metafield-input.ts";

test("metafield values preserve scalar and JSON semantics in REST strings", () => {
  assert.equal(serializeShopifyMetafieldValue(0), "0");
  assert.equal(serializeShopifyMetafieldValue(false), "false");
  assert.equal(serializeShopifyMetafieldValue(null), "null");
  assert.equal(serializeShopifyMetafieldValue(["a", 0, false]), '["a",0,false]');
  assert.equal(serializeShopifyMetafieldValue({ enabled: false }), '{"enabled":false}');
});

test("metafield normalization distinguishes a missing value from an empty value", () => {
  assert.equal(
    normalizeShopifyMetafieldInput({
      namespace: "custom",
      key: "missing",
      value: undefined as never,
      type: "single_line_text_field",
    }),
    null,
  );
  assert.deepEqual(
    normalizeShopifyMetafieldInput({
      namespace: " custom ",
      key: " enabled ",
      value: false,
      type: " boolean ",
    }),
    {
      namespace: "custom",
      key: "enabled",
      value: "false",
      type: "boolean",
    },
  );
});
