import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCustomerQueryParams,
  buildCustomerCountParams,
} from "../server/utils/shopify-customer-query.ts";
import {
  chunkInventoryItemIds,
  normalizeInventoryItemIds,
  normalizeLocationLimit,
} from "../server/utils/shopify-location-query.ts";
import {
  buildOrderFulfillmentListParams,
  buildOrderRefundListParams,
} from "../server/utils/shopify-order-query.ts";

test("customer queries whitelist parameters and clamp page size", () => {
  assert.deepEqual(
    buildCustomerQueryParams(
      {
        limit: 999,
        order: "updated_at desc",
        token: "must-not-leak",
        arbitrary: "ignored",
      },
      false,
    ),
    { limit: 250, order: "updated_at desc" },
  );
  assert.deepEqual(
    buildCustomerCountParams({
      created_at_min: "2026-01-01",
      token: "must-not-leak",
    }),
    { created_at_min: "2026-01-01" },
  );
});

test("order history query builders clamp limits and reject credentials", () => {
  assert.deepEqual(
    buildOrderRefundListParams({
      limit: 500,
      in_shop_currency: true,
      token: "must-not-leak",
    }),
    { limit: 250, in_shop_currency: true },
  );
  assert.deepEqual(
    buildOrderFulfillmentListParams({
      limit: -1,
      since_id: "10",
      storeId: "must-not-leak",
    }),
    { limit: 1, since_id: "10" },
  );
});

test("inventory item IDs are normalized, deduplicated and chunked by 50", () => {
  const ids = normalizeInventoryItemIds([
    "1,2,2,invalid",
    ...Array.from({ length: 73 }, (_, index) => String(index + 3)),
  ]);
  const chunks = chunkInventoryItemIds(ids);

  assert.equal(ids.length, 75);
  assert.deepEqual(chunks.map((chunk) => chunk.length), [50, 25]);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(normalizeLocationLimit("999"), 250);
  assert.equal(normalizeLocationLimit("0"), 1);
});
