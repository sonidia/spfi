import { mount } from "@vue/test-utils";
import { defineComponent, nextTick, ref } from "vue";
import { afterEach, describe, expect, it } from "vitest";
import { useFocusTrap } from "~/composables/useFocusTrap";

const FocusTrapHarness = defineComponent({
  setup() {
    const panel = ref<HTMLElement | null>(null);
    const escaped = ref(false);
    const { handleKeydown } = useFocusTrap(panel, {
      onEscape: () => {
        escaped.value = true;
      },
    });
    return { escaped, handleKeydown, panel };
  },
  template: `
    <section ref="panel" tabindex="-1" @keydown="handleKeydown">
      <button id="first">First</button>
      <button id="last">Last</button>
    </section>
  `,
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("useFocusTrap", () => {
  it("focuses the dialog, wraps Tab navigation, and handles Escape", async () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const wrapper = mount(FocusTrapHarness, { attachTo: document.body });
    await nextTick();

    const first = wrapper.get<HTMLButtonElement>("#first").element;
    const last = wrapper.get<HTMLButtonElement>("#last").element;
    expect(document.activeElement).toBe(first);

    last.focus();
    await wrapper.get("section").trigger("keydown", { key: "Tab" });
    expect(document.activeElement).toBe(first);

    first.focus();
    await wrapper.get("section").trigger("keydown", { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);

    await wrapper.get("section").trigger("keydown", { key: "Escape" });
    expect(wrapper.vm.escaped).toBe(true);

    wrapper.unmount();
    expect(document.activeElement).toBe(opener);
  });
});
