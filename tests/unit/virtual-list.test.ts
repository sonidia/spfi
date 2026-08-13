import { defineComponent, nextTick, ref } from "vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { useVirtualList } from "~/composables/useVirtualList";

describe("useVirtualList", () => {
  it("keeps the visible item anchored across append and refresh updates", async () => {
    const items = ref(createItems(20));
    let virtualList: ReturnType<typeof useVirtualList<{ id: number }>>;
    const wrapper = mount(
      defineComponent({
        setup() {
          virtualList = useVirtualList(items, {
            itemHeight: 20,
            defaultViewportHeight: 100,
            getItemKey: (item) => item.id,
          });
          return virtualList;
        },
        template: '<div ref="container" />',
      }),
    );
    await nextTick();

    const container = wrapper.element as HTMLElement;
    container.scrollTop = 205;
    virtualList!.updateViewport();

    items.value = [...items.value, ...createItems(5, 20)];
    await nextTick();
    expect(container.scrollTop).toBe(205);

    items.value = items.value.map((item) => ({ ...item }));
    await nextTick();
    expect(container.scrollTop).toBe(205);

    items.value = createItems(5, 100);
    await nextTick();
    expect(container.scrollTop).toBe(0);

    wrapper.unmount();
  });
});

function createItems(count: number, start = 0) {
  return Array.from({ length: count }, (_, offset) => ({ id: start + offset }));
}
