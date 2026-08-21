import {
  computed,
  onBeforeUnmount,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";

interface VirtualListOptions<T> {
  itemHeight: number;
  overscan?: number;
  defaultViewportHeight?: number;
  getItemKey?: (item: T) => string | number;
}

export function useVirtualList<T>(
  items: MaybeRefOrGetter<readonly T[]>,
  options: VirtualListOptions<T>,
) {
  const container = ref<HTMLElement | null>(null);
  const scrollTop = ref(0);
  const viewportHeight = ref(options.defaultViewportHeight || 600);
  const itemHeight = Math.max(1, options.itemHeight);
  const overscan = Math.max(0, options.overscan ?? 5);
  let resizeObserver: ResizeObserver | undefined;

  const startIndex = computed(() =>
    Math.max(0, Math.floor(scrollTop.value / itemHeight) - overscan),
  );
  const endIndex = computed(() =>
    Math.min(
      toValue(items).length,
      Math.ceil((scrollTop.value + viewportHeight.value) / itemHeight) + overscan,
    ),
  );
  const visibleItems = computed(() =>
    toValue(items)
      .slice(startIndex.value, endIndex.value)
      .map((item, offset) => ({ item, index: startIndex.value + offset })),
  );
  const paddingTop = computed(() => startIndex.value * itemHeight);
  const paddingBottom = computed(() =>
    Math.max(0, (toValue(items).length - endIndex.value) * itemHeight),
  );

  function updateViewport() {
    const element = container.value;
    if (!element) return;
    scrollTop.value = element.scrollTop;
    viewportHeight.value = element.clientHeight || viewportHeight.value;
  }

  watch(
    container,
    (element) => {
      resizeObserver?.disconnect();
      resizeObserver = undefined;
      updateViewport();
      if (typeof ResizeObserver === "undefined" || !element) return;
      resizeObserver = new ResizeObserver(updateViewport);
      resizeObserver.observe(element);
    },
    { flush: "post" },
  );

  watch(
    () => toValue(items),
    (nextItems, previousItems) => {
      const element = container.value;
      const previousScrollTop = element?.scrollTop ?? scrollTop.value;
      let nextScrollTop = 0;

      if (options.getItemKey && previousItems.length && nextItems.length) {
        const anchorIndex = Math.min(
          previousItems.length - 1,
          Math.max(0, Math.floor(previousScrollTop / itemHeight)),
        );
        const anchorKey = options.getItemKey(previousItems[anchorIndex] as T);
        const nextAnchorIndex = nextItems.findIndex(
          (item) => options.getItemKey?.(item as T) === anchorKey,
        );
        if (nextAnchorIndex >= 0) {
          nextScrollTop =
            nextAnchorIndex * itemHeight + (previousScrollTop % itemHeight);
        }
      }

      if (element) element.scrollTop = nextScrollTop;
      scrollTop.value = nextScrollTop;
      updateViewport();
    },
    { flush: "post" },
  );

  onBeforeUnmount(() => resizeObserver?.disconnect());

  return {
    container,
    paddingBottom,
    paddingTop,
    updateViewport,
    visibleItems,
  };
}
