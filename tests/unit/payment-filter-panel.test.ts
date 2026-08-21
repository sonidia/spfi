import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { describe, expect, it } from "vitest";
import PaymentFilterPanel from "~/components/payment/FilterPanel.vue";

describe("PaymentFilterPanel", () => {
  it("hides filter fields until the filter button is opened", async () => {
    const wrapper = mount(PaymentFilterPanel, {
      global: {
        plugins: [createPinia()],
      },
      props: {
        title: "Transaction filters",
        activeCount: 2,
      },
      slots: {
        default:
          '<label class="payment-filter-field"><span>Currency</span><input class="payment-filter-input" /></label>',
        actions: '<button type="submit">Apply filters</button>',
      },
    });

    expect(wrapper.get(".payment-filter-form").attributes("style")).toContain(
      "display: none",
    );
    expect(wrapper.get(".payment-filter-count").text()).toContain("2");

    await wrapper.get(".payment-filter-toggle").trigger("click");

    expect(wrapper.get(".payment-filter-form").attributes("style")).toBeUndefined();
    expect(wrapper.get(".payment-filter-fields").text()).toContain("Currency");

    await wrapper.get("form").trigger("submit");

    expect(wrapper.emitted("submit")).toHaveLength(1);
  });

  it("supports an external toggle without rendering a duplicate summary", async () => {
    const wrapper = mount(PaymentFilterPanel, {
      global: {
        plugins: [createPinia()],
      },
      props: {
        modelValue: false,
        hideSummary: true,
        panelId: "product-filter-panel",
      },
      slots: {
        default: '<input class="payment-filter-input" />',
      },
    });

    expect(wrapper.find(".payment-filter-summary").exists()).toBe(false);
    expect(wrapper.get(".payment-filter-panel").attributes("style")).toContain(
      "display: none",
    );

    await wrapper.setProps({ modelValue: true });

    expect(wrapper.get("form").attributes("id")).toBe("product-filter-panel");
    expect(wrapper.get(".payment-filter-panel").attributes("style")).toBeUndefined();
  });
});
