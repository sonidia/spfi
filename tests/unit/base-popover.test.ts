import { mount } from "@vue/test-utils";
import { h, nextTick } from "vue";
import { afterEach, describe, expect, it } from "vitest";
import BasePopover from "~/components/BasePopover.vue";

describe("BasePopover", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("exposes menu semantics and supports keyboard focus navigation", async () => {
    const wrapper = mount(BasePopover, {
      attachTo: document.body,
      slots: {
        trigger: ({ triggerProps }: { triggerProps: Record<string, unknown> }) =>
          h("button", { ...triggerProps, type: "button" }, "Open menu"),
        default: () => [
          h("button", { type: "button", role: "menuitem" }, "First"),
          h("button", { type: "button", role: "menuitem" }, "Second"),
        ],
      },
    });

    const trigger = wrapper.get("button");
    expect(trigger.attributes("aria-expanded")).toBe("false");
    expect(trigger.attributes("aria-haspopup")).toBe("menu");

    trigger.element.focus();
    await trigger.trigger("keydown", { key: "ArrowDown" });
    await nextTick();

    const menu = document.querySelector<HTMLElement>('[role="menu"]');
    expect(menu).not.toBeNull();
    expect(trigger.attributes("aria-expanded")).toBe("true");
    expect(document.activeElement?.textContent).toBe("First");

    document.activeElement?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    await nextTick();
    expect(document.activeElement?.textContent).toBe("Second");

    document.activeElement?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await nextTick();
    expect(trigger.attributes("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger.element);

    wrapper.unmount();
  });
});
