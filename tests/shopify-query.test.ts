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
  buildOrderListParams,
  buildOrderFulfillmentListParams,
  buildOrderRefundListParams,
} from "../server/utils/shopify-order-query.ts";
import {
  buildProductListParams,
  buildProductSearchQuery,
  normalizeProductPageSize,
  resolveProductSort,
} from "../server/utils/shopify-product-query.ts";
import {
  buildShopifyCursorPageParams,
  getShopifyPageInfo,
} from "../server/utils/shopify-pagination.ts";

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

test("order list cursor requests discard incompatible filters", () => {
  assert.deepEqual(
    buildOrderListParams({
      page_info: "opaque-cursor==",
      limit: 20,
      status: "open",
      since_id: "10",
      fields: "id,name",
    }),
    { page_info: "opaque-cursor==", limit: 20, fields: "id,name" },
  );
});

test("product list queries clamp pages and never resend cursor-incompatible filters", () => {
  assert.deepEqual(
    buildProductListParams({
      limit: 999,
      title: "Snowboard",
      status: "active",
      vendor: "Burton",
    }),
    { limit: 100, title: "Snowboard", status: "active", vendor: "Burton" },
  );
  assert.deepEqual(
    buildProductListParams({
      page_info: "opaque==",
      limit: 20,
      fields: "id,title",
      vendor: "must-not-be-resent",
    }),
    { page_info: "opaque==", limit: 20, fields: "id,title" },
  );
  assert.equal(normalizeProductPageSize(0), 1);
});

test("product GraphQL counts use escaped search terms for all visible filters", () => {
  assert.equal(
    buildProductSearchQuery({
      title: 'A "quoted" product',
      status: "draft",
      product_type: "Board",
      vendor: "Acme",
      published_status: "unpublished",
      created_at_min: "2026-01-01",
    }),
    'product_type:"Board" AND published_status:"unpublished" AND status:"draft" AND title:"A \\"quoted\\" product" AND vendor:"Acme" AND created_at:>="2026-01-01"',
  );
});

test("product GraphQL filters include collections and full date ranges", () => {
  assert.equal(
    buildProductSearchQuery({
      collection_id: "9007199254740993",
      created_at_max: "2026-08-13T23:59:59.999Z",
      updated_at_min: "2026-08-01T00:00:00.000Z",
      published_at_max: "2026-08-12T23:59:59.999Z",
    }),
    'collection_id:"9007199254740993" AND created_at:<="2026-08-13T23:59:59.999Z" AND published_at:<="2026-08-12T23:59:59.999Z" AND updated_at:>="2026-08-01T00:00:00.000Z"',
  );
});

test("product sorting only accepts Shopify ProductSortKeys", () => {
  assert.deepEqual(resolveProductSort({ sort_key: "TITLE", reverse: false }), {
    sortKey: "TITLE",
    reverse: false,
  });
  assert.deepEqual(resolveProductSort({ sort_key: "PRICE" as never }), {
    sortKey: "UPDATED_AT",
    reverse: true,
  });
});

test("Shopify Link headers expose opaque next and previous cursors", () => {
  const pageInfo = getShopifyPageInfo({
    link: [
      '<https://shop.myshopify.com/admin/api/2026-07/orders.json?page_info=next%3D%3D&limit=20>; rel="next"',
      '<https://shop.myshopify.com/admin/api/2026-07/orders.json?page_info=previous%3D%3D&limit=20>; rel="previous"',
    ].join(", "),
  });

  assert.deepEqual(pageInfo, {
    nextCursor: "next==",
    previousCursor: "previous==",
    hasNextPage: true,
    hasPreviousPage: true,
  });
});

test("invalid Shopify pagination links use the standard error envelope", () => {
  assert.throws(
    () =>
      getShopifyPageInfo({
        link: '<not-a-valid-url>; rel="next"',
      }),
    (error: unknown) => {
      const apiError = error as {
        statusCode?: number;
        data?: { success?: boolean; error?: { message?: string } };
      };
      assert.equal(apiError.statusCode, 502);
      assert.equal(apiError.data?.success, false);
      assert.match(apiError.data?.error?.message || "", /pagination/i);
      return true;
    },
  );
});

test("cursor pagination relies on page_info to preserve the original filters", () => {
  assert.deepEqual(
    buildShopifyCursorPageParams(
      {
        page_info: "stale-cursor",
        limit: 10,
        fields: "id,name,line_items",
        status: "any",
        created_at_min: "2026-08-01",
      },
      "opaque-cursor==",
    ),
    {
      page_info: "opaque-cursor==",
      limit: 250,
      fields: "id,name,line_items",
    },
  );
});

test("inventory item IDs are normalized, deduplicated and chunked by 50", () => {
  const ids = normalizeInventoryItemIds([
    "1,2,2,invalid",
    ...Array.from({ length: 73 }, (_, index) => String(index + 3)),
  ]);
  const chunks = chunkInventoryItemIds(ids);

  assert.equal(ids.length, 75);
  assert.deepEqual(
    chunks.map((chunk) => chunk.length),
    [50, 25],
  );
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(normalizeLocationLimit("999"), 250);
  assert.equal(normalizeLocationLimit("0"), 1);
});
