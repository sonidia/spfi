import { mount } from "@vue/test-utils";
import { h, nextTick } from "vue";
import { describe, expect, it } from "vitest";
import BaseSelect from "~/components/BaseSelect.vue";

describe("BaseSelect", () => {
  it("renders a custom listbox and emits the selected value", async () => {
    const wrapper = mount(BaseSelect, {
      props: {
        ariaLabel: "Filter by store",
        modelValue: "all",
        options: [
          { label: "All stores", value: "all" },
          { label: "North store", value: "north" },
        ],
      },
      slots: {
        icon: () => h("span", { "data-test": "leading-icon" }, "S"),
      },
    });

    expect(wrapper.find("select").exists()).toBe(false);
    const trigger = wrapper.get('[role="combobox"]');
    expect(trigger.attributes("aria-label")).toBe("Filter by store");
    expect(wrapper.find('[data-test="leading-icon"]').exists()).toBe(true);

    await trigger.trigger("click");
    await nextTick();
    const options = wrapper.findAll('[role="option"]');
    expect(options).toHaveLength(2);
    await options[1]?.trigger("click");

    expect(wrapper.emitted("change")?.[0]).toEqual(["north"]);
    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual(["north"]);
  });
});
