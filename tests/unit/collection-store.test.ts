import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCollectionStore } from "~/stores/collection";

describe("collection store", () => {
  beforeEach(() => setActivePinia(createPinia()));
  afterEach(() => vi.useRealTimers());

  it("retains independent cursor pages and count precision per store", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        collections: [{ id: "gid://shopify/Collection/1", title: "First" }],
        count: { count: 10_000, precision: "AT_LEAST" },
        pageInfo: {
          nextCursor: "page-2",
          previousCursor: null,
          hasNextPage: true,
          hasPreviousPage: false,
        },
      })
      .mockResolvedValueOnce({
        collections: [{ id: "gid://shopify/Collection/2", title: "Second" }],
        count: { count: 10_000, precision: "AT_LEAST" },
        pageInfo: {
          nextCursor: null,
          previousCursor: "page-1",
          hasNextPage: false,
          hasPreviousPage: true,
        },
      });
    vi.stubGlobal("$fetch", request);

    const store = useCollectionStore();
    await store.fetchAll("shop-a", "token");
    await store.fetchNext("shop-a", "token");

    expect(store.collections.map((collection) => collection.id)).toEqual([
      "gid://shopify/Collection/1",
      "gid://shopify/Collection/2",
    ]);
    expect(store.count).toEqual({ count: 10_000, precision: "AT_LEAST" });
    expect(store.loadedPageCount).toBe(2);
    expect(store.hydrate("shop-b")).toBe(false);
    expect(store.collections).toEqual([]);
    expect(store.hydrate("shop-a")).toBe(true);
    expect(store.loadedPageCount).toBe(2);
  });

  it("sends source-aware selection deltas and refreshes the list", async () => {
    const detail = {
      id: "gid://shopify/Collection/1",
      legacyResourceId: "1",
      title: "Collection",
      sources: [],
    };
    const request = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/selections")) return Promise.resolve({ collection: detail });
      if (url === "/api/collection/page") {
        return Promise.resolve({
          collections: [],
          count: { count: 0, precision: "EXACT" },
          pageInfo: {
            nextCursor: null,
            previousCursor: null,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        });
      }
      return Promise.resolve({});
    });
    vi.stubGlobal("$fetch", request);

    const store = useCollectionStore();
    await store.updateSelections("shop-a", "token", "1", {
      sourceId: "gid://shopify/CollectionConditionsSource/5",
      productIdsToAdd: ["gid://shopify/Product/7"],
      productIdsToRemove: [],
    });

    expect(request.mock.calls[0]?.[0]).toBe("/api/collection/1/selections");
    expect(request.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      body: {
        delta: {
          sourceId: "gid://shopify/CollectionConditionsSource/5",
          productIdsToAdd: ["gid://shopify/Product/7"],
        },
      },
    });
    expect(request.mock.calls[1]?.[0]).toBe("/api/collection/page");
  });

  it("polls asynchronous collection updates before refreshing detail", async () => {
    vi.useFakeTimers();
    const collectionId = "gid://shopify/Collection/1";
    const jobId = "gid://shopify/Job/job-1";
    const detail = {
      id: collectionId,
      legacyResourceId: "1",
      title: "Before processing",
      sources: [],
    };
    const request = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/selections")) {
        return Promise.resolve({
          collection: detail,
          job: { id: jobId, done: false },
        });
      }
      if (url === "/api/collection/job") {
        return Promise.resolve({ id: jobId, done: true });
      }
      if (url === "/api/collection/1") {
        return Promise.resolve({ ...detail, title: "After processing" });
      }
      if (url === "/api/collection/page") {
        return Promise.resolve({
          collections: [],
          count: { count: 0, precision: "EXACT" },
          pageInfo: {
            nextCursor: null,
            previousCursor: null,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        });
      }
      return Promise.resolve({});
    });
    vi.stubGlobal("$fetch", request);

    const store = useCollectionStore();
    await store.updateSelections("shop-a", "token", collectionId, {
      sourceId: "gid://shopify/CollectionConditionsSource/5",
      productIdsToAdd: ["gid://shopify/Product/7"],
    });

    expect(store.activeJobs).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1_000);

    expect(request).toHaveBeenCalledWith("/api/collection/job", {
      method: "POST",
      body: { storeId: "shop-a", token: "token", jobId },
    });
    expect(store.activeJobs).toHaveLength(0);
    expect(store.jobs[jobId]?.status).toBe("completed");
    expect(store.details[collectionId]?.title).toBe("After processing");
  });
});
