import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import ProductDetailModal from "~/components/product/ProductDetailModal.vue";
import type { ShopifyProduct } from "~~/types/shopify";

vi.mock("~/composables/useLocations", () => ({
  useLocations: () => ({
    locations: ref([]),
    inventoryLevels: ref([]),
    isLoadingLocations: ref(false),
    locationError: ref(""),
    fetchProductInventory: vi.fn().mockResolvedValue(undefined),
  }),
}));

describe("ProductDetailModal", () => {
  it("keeps product details read-only while rendering media in view mode", () => {
    vi.stubGlobal("useLocalization", () => ({
      t: (key: string) => key,
      locale: ref("en-US"),
    }));

    const wrapper = mount(ProductDetailModal, {
      props: {
        product: {
          id: 1,
          title: "Read-only product",
          status: "active",
          variants: [
            {
              id: 2,
              product_id: 1,
              title: "Default Title",
              price: "48.88",
            },
          ],
        } as ShopifyProduct,
      },
      global: {
        stubs: {
          IconsRefresh: true,
          ProductDescriptionPreview: true,
          ProductVariantMediaOverview: true,
          ProductMediaManager: {
            props: { readOnly: Boolean },
            template: '<div data-test="product-media" :data-readonly="readOnly" />',
          },
        },
      },
    });

    expect(wrapper.find("form, input, textarea, select").exists()).toBe(false);
    expect(
      wrapper.find('[data-test="product-media"]').attributes("data-readonly"),
    ).toBe("true");
    expect(wrapper.findComponent({ name: "ProductOperationsPanel" }).exists()).toBe(
      false,
    );
  });
});
