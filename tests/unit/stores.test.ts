import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import { useCredentialVaultStore } from "~/stores/credentialVault";
import { useOrderStore } from "~/stores/order";

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
