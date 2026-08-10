import assert from "node:assert/strict";
import test from "node:test";
import type { StoreDashboardSnapshot } from "../types/dashboard.ts";
import {
  aggregateDashboardSnapshots,
  filterDashboardAggregateCurrency,
} from "../utils/dashboard-aggregate.ts";

test("all-store aggregation sums matching currencies without mixing them", () => {
  const result = aggregateDashboardSnapshots([
    snapshot("alpha", "THB", 1200),
    snapshot("beta", "USD", 45),
    snapshot("gamma", "THB", 300),
  ]);

  assert.deepEqual(result.revenue.month, [
    { currency: "THB", amount: 1500 },
    { currency: "USD", amount: 45 },
  ]);
  assert.equal(result.revenue.orderCountMonth, 3);
  assert.equal(result.customerCount, 30);
  assert.equal(result.pendingFulfillmentCount, 6);
  assert.equal(result.topProducts[0]?.storeId, "alpha");
  assert.deepEqual(result.payments.balance, [
    { currency: "THB", amount: 100 },
    { currency: "USD", amount: 50 },
  ]);
});

test("currency filtering keeps operational totals while narrowing every money series", () => {
  const aggregate = aggregateDashboardSnapshots([
    snapshot("alpha", "THB", 1200),
    snapshot("beta", "USD", 45),
  ]);
  const result = filterDashboardAggregateCurrency(aggregate, "USD");

  assert.deepEqual(result.revenue.month, [{ currency: "USD", amount: 45 }]);
  assert.deepEqual(result.revenue.daily[0]?.values, [{ currency: "USD", amount: 45 }]);
  assert.deepEqual(result.topProducts[0]?.revenue, []);
  assert.deepEqual(result.topProducts[1]?.revenue, [{ currency: "USD", amount: 45 }]);
  assert.equal(result.customerCount, 20);
  assert.equal(result.pendingFulfillmentCount, 4);
});

function snapshot(
  storeId: string,
  currency: string,
  revenueAmount: number,
): StoreDashboardSnapshot {
  return {
    storeId,
    storeName: storeId,
    domain: `${storeId}.myshopify.com`,
    currency,
    owner: "Owner",
    email: `${storeId}@example.com`,
    plan: "Shopify",
    generatedAt: "2026-08-10T00:00:00.000Z",
    revenue: {
      today: [{ currency, amount: revenueAmount }],
      week: [{ currency, amount: revenueAmount }],
      month: [{ currency, amount: revenueAmount }],
      orderCountToday: 1,
      orderCountWeek: 1,
      orderCountMonth: 1,
      daily: [
        {
          date: "2026-08-10",
          orders: 1,
          values: [{ currency, amount: revenueAmount }],
        },
      ],
    },
    fulfillmentBreakdown: { fulfilled: 1, partial: 0, unfulfilled: 1 },
    pendingFulfillments: { count: 2, orders: [] },
    topProducts: [
      {
        key: "product",
        productId: "1",
        title: `${storeId} product`,
        units: revenueAmount,
        orders: 1,
        revenue: [{ currency, amount: revenueAmount }],
      },
    ],
    productCount: 5,
    customerCount: 10,
    payments: {
      available: true,
      balance: [{ currency, amount: 50 }],
      payouts: {
        count: 0,
        pendingCount: 0,
        paidCount: 0,
        failedCount: 0,
        total: [],
        pending: [],
      },
      transactions: {
        count: 0,
        gross: [],
        fees: [],
        net: [],
        recent: [],
      },
    },
    users: [],
    warnings: [],
  };
}
