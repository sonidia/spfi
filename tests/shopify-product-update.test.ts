import assert from "node:assert/strict";
import test from "node:test";
import { normalizeShopifyProductUpdate } from "../server/utils/shopify-product-update.ts";

test("product updates keep supported REST fields and discard unknown fields", () => {
  const update = normalizeShopifyProductUpdate({
    title: "Updated title",
    status: "draft",
    published_at: null,
    unknown_field: "discard me",
  });

  assert.deepEqual(update, {
    title: "Updated title",
    status: "draft",
    published_at: null,
  });
});

test("legacy published=true maps to REST publication fields", () => {
  const update = normalizeShopifyProductUpdate(
    { published: true },
    () => "2026-08-08T00:00:00.000Z",
  );

  assert.deepEqual(update, {
    published_at: "2026-08-08T00:00:00.000Z",
    published_scope: "web",
  });
  assert.equal("published" in update, false);
});

test("legacy published=false maps to published_at=null", () => {
  const update = normalizeShopifyProductUpdate({ published: false });

  assert.deepEqual(update, { published_at: null });
  assert.equal("published" in update, false);
});

test("explicit published_at takes precedence over the legacy flag", () => {
  const update = normalizeShopifyProductUpdate({
    published: true,
    published_at: null,
  });

  assert.deepEqual(update, { published_at: null });
});
