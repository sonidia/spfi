import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import ProductOperationsPanel from "~/components/product/ProductOperationsPanel.vue";
import type { ShopifyProduct } from "~~/types/shopify";

const mocks = vi.hoisted(() => ({
  updateVariantsBulk: vi.fn(),
  updateInventoryBulk: vi.fn(),
  load: vi.fn(),
  fetchLocations: vi.fn(),
  fetchProductInventory: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("~/composables/useProductOperations", () => ({
  useProductOperations: () => ({
    variants: ref([
      {
        id: "9007199254740993",
        product_id: 1,
        title: "Default Title",
        price: "19.00",
        compare_at_price: null,
        inventory_item_id: "42",
        inventory_management: "shopify",
      },
    ]),
    images: ref([]),
    metafields: ref([]),
    isLoading: ref(false),
    error: ref(""),
    load: mocks.load.mockResolvedValue(true),
    updateVariantsBulk: mocks.updateVariantsBulk.mockResolvedValue({ variants: [] }),
    updateInventoryBulk: mocks.updateInventoryBulk,
    moveInventoryReservations: vi.fn(),
    createVariantsBulk: vi.fn(),
    deleteVariantsBulk: vi.fn(),
    updateOptions: vi.fn(),
    createImage: vi.fn(),
    updateImage: vi.fn(),
    deleteImage: vi.fn(),
    createMetafield: vi.fn(),
    updateMetafield: vi.fn(),
    deleteMetafield: vi.fn(),
  }),
}));

vi.mock("~/composables/useLocations", () => ({
  useLocations: () => ({
    locations: ref([{ id: 10, name: "Main", active: true }]),
    inventoryLevels: ref([
      {
        inventory_item_id: 42,
        location_id: "10",
        available: 5,
        quantities: { available: 5, on_hand: 5, reserved: 0 },
      },
    ]),
    fetchLocations: mocks.fetchLocations.mockResolvedValue(undefined),
    fetchProductInventory: mocks.fetchProductInventory.mockResolvedValue(undefined),
  }),
}));

vi.mock("~/stores/toast", () => ({
  useToastStore: () => ({
    success: mocks.success,
    error: mocks.error,
    warning: vi.fn(),
  }),
}));

const product = {
  id: 1,
  title: "Test product",
  options: [{ id: 7, name: "Title", position: 1, values: ["Default Title"] }],
  variants: [],
} as unknown as ShopifyProduct;

function mountPanel() {
  vi.stubGlobal("useLocalization", () => ({
    t: (key: string) => key,
  }));
  vi.stubGlobal("useConfirmDialog", () => ({
    requestConfirmation: vi.fn().mockResolvedValue(true),
  }));

  return mount(ProductOperationsPanel, {
    props: { product },
    global: {
      stubs: {
        BaseButton: {
          props: ["disabled", "loading"],
          template:
            '<button type="button" :disabled="disabled || loading"><slot name="icon"/><slot/></button>',
        },
        BaseSelect: {
          props: ["disabled"],
          template: '<button type="button" :disabled="disabled"><slot/></button>',
        },
        InventoryItemEditor: true,
      },
    },
  });
}

describe("ProductOperationsPanel pricing", () => {
  it("saves an edited price without invoking inventory updates", async () => {
    const wrapper = mountPanel();
    await flushPromises();

    await wrapper.find(".variant-price-fields input").setValue("20.00");
    const savePrice = wrapper
      .findAll(".variant-price-fields button")
      .find((button) => button.text().includes("product.savePrice"));
    expect(savePrice).toBeDefined();
    expect(savePrice?.attributes("disabled")).toBeUndefined();

    await savePrice?.trigger("click");
    await flushPromises();

    expect(mocks.updateVariantsBulk).toHaveBeenCalledWith(
      1,
      [{ id: "9007199254740993", price: "20", compare_at_price: null }],
      ["Title"],
    );
    expect(mocks.updateInventoryBulk).not.toHaveBeenCalled();
  });

  it("matches inventory levels when REST IDs use different number representations", async () => {
    const wrapper = mountPanel();
    await flushPromises();

    const updateInventory = wrapper
      .findAll("button")
      .find((button) => button.text().includes("product.updateInventory"));
    expect(updateInventory).toBeDefined();
    expect(updateInventory?.attributes("disabled")).toBeUndefined();
    expect(wrapper.find(".inventory-warning").exists()).toBe(false);
  });
});
