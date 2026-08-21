import assert from "node:assert/strict";
import test from "node:test";
import { prepareShopifyMetafieldsSetInputs } from "../server/utils/shopify-metafields-set-input.ts";

test("product metafields are mapped to explicit GraphQL owner inputs", () => {
  assert.deepEqual(
    prepareShopifyMetafieldsSetInputs("Product", "9007199254740993", [
      {
        namespace: "custom",
        key: "settings",
        value: { enabled: false, threshold: 0 },
        type: "json",
      },
    ]),
    [
      {
        ownerId: "gid://shopify/Product/9007199254740993",
        namespace: "custom",
        key: "settings",
        type: "json",
        value: '{"enabled":false,"threshold":0}',
      },
    ],
  );
});
