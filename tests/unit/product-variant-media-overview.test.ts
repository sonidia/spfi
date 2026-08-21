import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import ProductVariantMediaOverview from "~/components/product/ProductVariantMediaOverview.vue";
import type { ShopifyProduct } from "~~/types/shopify";

describe("ProductVariantMediaOverview", () => {
  it("shows the image assignment for the selected variant", async () => {
    vi.stubGlobal("useLocalization", () => ({
      t: (key: string, params?: { count?: number }) =>
        params?.count === undefined ? key : `${key}:${params.count}`,
    }));

    const wrapper = mount(ProductVariantMediaOverview, {
      props: {
        product: {
          id: 10,
          title: "T-shirt",
          status: "active",
          variants: [
            {
              id: 1,
              title: "Blue / Small",
              sku: "BLUE-S",
              price: "20.00",
              image_id: 101,
            },
            {
              id: 2,
              title: "Red / Small",
              sku: "RED-S",
              price: "21.00",
              image_id: null,
            },
          ],
          images: [
            {
              id: 101,
              src: "https://cdn.example/blue.jpg",
              alt: "Blue shirt",
              variant_ids: [1],
            },
          ],
        } as ShopifyProduct,
      },
    });

    expect(wrapper.get(".variant-media-focus figure img").attributes("src")).toBe(
      "https://cdn.example/blue.jpg",
    );
    expect(wrapper.get(".variant-media-focus figcaption a").attributes("href")).toBe(
      "https://cdn.example/blue.jpg",
    );
    expect(wrapper.get(".variant-media-focus figcaption a").attributes("target")).toBe(
      "_blank",
    );
    expect(wrapper.get(".product-image-map-grid article small").text()).toContain(
      "Blue / Small",
    );

    await wrapper.findAll(".variant-media-tab")[1]?.trigger("click");

    expect(wrapper.find(".variant-media-focus figure").exists()).toBe(false);
    expect(wrapper.get(".variant-media-empty").text()).toContain(
      "product.noAssignedImage",
    );
  });
});
