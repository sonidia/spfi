import { describe, expect, it } from "vitest";
import healthHandler from "~~/server/api/health.get";
import {
  inspectProxyInput,
  maskProxyUrl,
  normalizeProxyUrl,
  resolveStoreAdminDomain,
} from "~~/server/utils/callShopifyApi";
import {
  buildBalanceTransactionSearchQuery,
  mapBalanceTransaction,
} from "~~/server/utils/shopify-payments-graphql";

describe("callShopifyApi helpers", () => {
  it("normalizes and masks proxy credentials without changing routing data", () => {
    expect(normalizeProxyUrl("8.8.8.8:1080:user:p@ss")).toBe(
      "socks5h://user:p%40ss@8.8.8.8:1080",
    );
    expect(maskProxyUrl("socks5h://user:p%40ss@8.8.8.8:1080")).toBe(
      "socks5h://****:****@8.8.8.8:1080",
    );
    expect(inspectProxyInput("8.8.8.8:1080:user:p@ss")).toMatchObject({
      segmentCount: 4,
      usernameLength: 4,
      passwordLength: 4,
    });
    expect(resolveStoreAdminDomain("custom.example", "shop-a.myshopify.com")).toBe(
      "shop-a.myshopify.com",
    );
  });
});

describe("Shopify Payments GraphQL mapping", () => {
  it("keeps 64-bit IDs lossless in filters and mapped transactions", () => {
    const hugeId = "18446744073709551615";
    expect(
      buildBalanceTransactionSearchQuery({
        since_id: hugeId,
        last_id: "18446744073709551616",
      }),
    ).toBe(`id:>${hugeId} id:<18446744073709551616`);

    const mapped = mapBalanceTransaction({
      id: `gid://shopify/ShopifyPaymentsBalanceTransaction/${hugeId}`,
      type: "CHARGE",
      test: false,
      associatedPayout: { id: null, status: null },
      amount: { amount: "10.00", currencyCode: "USD" },
      fee: { amount: "1.00", currencyCode: "USD" },
      net: { amount: "9.00", currencyCode: "USD" },
      sourceId: hugeId,
      sourceType: "charge",
      sourceOrderTransactionId: "18446744073709551614",
      associatedOrder: {
        id: "gid://shopify/Order/18446744073709551613",
        name: "#1001",
      },
      adjustmentsOrders: [],
      adjustmentReason: null,
      transactionDate: "2026-08-10T00:00:00Z",
    });

    expect(mapped.id).toBe(hugeId);
    expect(mapped.source_id).toBe(hugeId);
    expect(mapped.source_order_id).toBe("18446744073709551613");
    expect(mapped.source_order_transaction_id).toBe("18446744073709551614");
  });
});

describe("API routes", () => {
  it("returns the health response envelope", async () => {
    expect(await healthHandler({} as never)).toEqual({ ok: true });
  });
});
