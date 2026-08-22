import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCommerceOpsStore } from "~/stores/commerceOps";

describe("commerce operations fulfillment store", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("keeps cursor pages and the active status filter in the per-store state", async () => {
    const request = vi
      .fn()
      .mockImplementation((url: string, options: { body: any }) => {
        if (url !== "/api/commerce-ops/fulfillment-orders") {
          return Promise.resolve({
            items: [],
            pageInfo: { endCursor: null, hasNextPage: false },
          });
        }
        if (options.body.after === "next-page") {
          return Promise.resolve({
            items: [{ id: "gid://shopify/FulfillmentOrder/2", orderName: "#2" }],
            pageInfo: { endCursor: null, hasNextPage: false },
          });
        }
        return Promise.resolve({
          items: [{ id: "gid://shopify/FulfillmentOrder/1", orderName: "#1" }],
          pageInfo: { endCursor: "next-page", hasNextPage: true },
        });
      });
    vi.stubGlobal("$fetch", request);
    const store = useCommerceOpsStore();

    await store.loadAll("shop-a", "token");
    await store.loadMoreFulfillmentOrders("shop-a", "token");

    expect(store.fulfillmentOrders.map((item) => item.id)).toEqual([
      "gid://shopify/FulfillmentOrder/1",
      "gid://shopify/FulfillmentOrder/2",
    ]);
    expect(store.fulfillmentPageInfo.hasNextPage).toBe(false);
    expect(
      request.mock.calls.filter(
        ([url]) => url === "/api/commerce-ops/fulfillment-orders",
      ),
    ).toHaveLength(2);

    expect(store.hydrate("shop-b")).toBe(false);
    expect(store.fulfillmentOrders).toEqual([]);
    expect(store.hydrate("shop-a")).toBe(true);
    expect(store.fulfillmentOrders).toHaveLength(2);
  });
});
