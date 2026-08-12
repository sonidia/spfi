import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCredentialVaultStore } from "~/stores/credentialVault";
import { useDashboardStore } from "~/stores/dashboard";
import { useFormStore } from "~/stores/form";
import { useMarketStore } from "~/stores/market";
import { useOrderStore } from "~/stores/order";
import { useProductStore } from "~/stores/product";
import { KNOWN_STORES_STORAGE_KEY } from "~~/utils/known-stores";

afterEach(() => vi.unstubAllGlobals());

describe("credential vault store", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it("normalizes saved credentials and safely ignores corrupted JSON", async () => {
    const vault = useCredentialVaultStore();
    vault.initialize();
    await vault.saveStoreData("shop-a", {
      domain: " shop-a.myshopify.com ",
      accessToken: " token ",
      expiresTime: 9_007_199_254_740_991,
    });

    expect(vault.getStoreData("shop-a")).toMatchObject({
      domain: "shop-a.myshopify.com",
      accessToken: "token",
      expiresTime: 9_007_199_254_740_991,
    });
    expect(JSON.parse(localStorage.getItem("shop-a") || "{}")).toMatchObject({
      value: { domain: "shop-a.myshopify.com", accessToken: "token" },
    });

    localStorage.setItem("broken-shop", "{not-json");
    expect(vault.getStoreData("broken-shop")).toEqual({});
  });

  it("migrates tracking settings to FedEx and persists another carrier", async () => {
    localStorage.setItem(
      "spf_tracking_provider_settings",
      JSON.stringify({ apiKey: " legacy-key " }),
    );
    const vault = useCredentialVaultStore();
    vault.initialize();

    expect(vault.trackingSettings).toEqual({
      apiKey: "legacy-key",
      carrier: "fedex",
    });

    await vault.saveTrackingSettings({ apiKey: "key", carrier: "ups" });
    expect(vault.trackingSettings).toEqual({ apiKey: "key", carrier: "ups" });
  });
});

describe("order store", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("retains independent pagination and data per active store", () => {
    const store = useOrderStore();
    expect(store.hydrate("shop-a")).toBe(false);
    store.orders = [{ id: 1, name: "#1" }];
    store.orderCount = 1;
    store.setPageSize(50);
    store.setPage(3);

    expect(store.hydrate("shop-b")).toBe(false);
    expect(store.orders).toEqual([]);
    expect(store.currentPage).toBe(1);

    expect(store.hydrate("shop-a")).toBe(true);
    expect(store.orders).toEqual([{ id: 1, name: "#1" }]);
    expect(store.pageSize).toBe(50);
    expect(store.currentPage).toBe(3);
  });
});

describe("product store", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("bulk publishes exact product IDs and refreshes the list once", async () => {
    const request = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/product/all") {
        return Promise.resolve({ data: { products: [] } });
      }
      return Promise.resolve({});
    });
    vi.stubGlobal("$fetch", request);

    const store = useProductStore();
    const result = await store.setProductsPublished(
      "shop-a",
      "token",
      ["9007199254740993", 42, "9007199254740993"],
      true,
    );

    expect(result).toEqual({ total: 2, succeeded: 2, failedIds: [] });
    expect(request).toHaveBeenCalledTimes(3);
    expect(request.mock.calls[0]?.[0]).toBe("/api/product/9007199254740993");
    expect(request.mock.calls[1]?.[0]).toBe("/api/product/42");
    expect(request.mock.calls[2]?.[0]).toBe("/api/product/all");
  });
});

describe("market store", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("caches market lists per store and updates status only after Shopify succeeds", async () => {
    const request = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/market/status") {
        return Promise.resolve({
          id: "gid://shopify/Market/1",
          status: "DRAFT",
        });
      }
      return Promise.resolve({
        items: [
          {
            id: "gid://shopify/Market/1",
            handle: "us",
            name: "United States",
            status: "ACTIVE",
            type: "REGION",
            conditionTypes: ["REGION"],
            conditionApplicationLevel: "SPECIFIC",
            regions: [],
            regionsTruncated: false,
            currencySettings: null,
            priceInclusions: null,
            catalogCount: null,
            catalogs: [],
            catalogsTruncated: false,
            webPresences: [],
            webPresencesTruncated: false,
            shipping: { inherits: true, enabled: null, optionCount: null },
          },
        ],
        fetchedAt: "2026-08-12T00:00:00.000Z",
        truncated: false,
      });
    });
    vi.stubGlobal("$fetch", request);

    const store = useMarketStore();
    await expect(store.fetchAll("shop-a", "token")).resolves.toBe(true);
    await expect(store.fetchAll("shop-a", "token")).resolves.toBe(true);
    expect(request).toHaveBeenCalledTimes(1);

    await expect(
      store.setStatus("shop-a", "token", "gid://shopify/Market/1", "DRAFT"),
    ).resolves.toBe(true);
    expect(store.markets[0]?.status).toBe("DRAFT");

    expect(store.hydrate("shop-b")).toBe(false);
    expect(store.markets).toEqual([]);
    expect(store.hydrate("shop-a")).toBe(true);
    expect(store.markets[0]?.status).toBe("DRAFT");
  });
});

describe("dashboard store", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it("reuses a live all-store snapshot until an explicit refresh", async () => {
    localStorage.setItem(KNOWN_STORES_STORAGE_KEY, JSON.stringify(["shop-a"]));
    const form = useFormStore();
    const vault = useCredentialVaultStore();
    await vault.saveStoreData("shop-a", {
      domain: "shop-a.myshopify.com",
      accessToken: "token",
    });
    const request = vi.fn().mockResolvedValue({ storeId: "shop-a" });
    vi.stubGlobal("$fetch", request);

    const dashboard = useDashboardStore();
    await dashboard.load();
    await dashboard.load();

    expect(form.knownStores).toEqual(["shop-a"]);
    expect(request).toHaveBeenCalledTimes(1);
    expect(dashboard.hasLoaded).toBe(true);

    await dashboard.load(true);
    expect(request).toHaveBeenCalledTimes(2);
  });
});
