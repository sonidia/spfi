<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, useId, watch } from "vue";

interface BasePopoverProps {
  align?: "left" | "right" | "top" | "bottom";
  position?: "top" | "bottom" | "left" | "right";
  role?: "menu" | "dialog";
}

const props = withDefaults(defineProps<BasePopoverProps>(), {
  align: "right",
  position: "bottom",
  role: "menu",
});

const GAP = 8;
const VIEWPORT_MARGIN = 8;

const isOpen = ref(false);
const id = useId();
const triggerId = `popover-trigger-${id}`;
const contentId = `popover-content-${id}`;
const popoverRef = ref<HTMLElement | null>(null);
const triggerRef = ref<HTMLElement | null>(null);
const contentRef = ref<HTMLElement | null>(null);
const pendingFocus = ref<"first" | "last" | null>(null);
const actualPosition = ref<BasePopoverProps["position"]>(props.position);
const popoverRect = ref({ top: 0, left: 0, minWidth: 180 });
const transformOrigin = ref("top right");

const popoverStyle = computed<Record<string, string>>(() => ({
  top: `${popoverRect.value.top}px`,
  left: `${popoverRect.value.left}px`,
  minWidth: `${popoverRect.value.minWidth}px`,
  "--popover-transform-origin": transformOrigin.value,
}));

const triggerElement = computed(
  () => triggerRef.value?.firstElementChild as HTMLElement | null,
);

const triggerProps = computed(() => ({
  id: triggerId,
  "aria-controls": contentId,
  "aria-expanded": isOpen.value,
  "aria-haspopup": props.role,
  "data-popover-trigger": "",
  onClick: toggle,
  onKeydown: handleTriggerKeydown,
}));

function toggle(event?: Event) {
  event?.stopPropagation();
  isOpen.value = !isOpen.value;
}

function close(restoreFocus = false) {
  isOpen.value = false;
  if (restoreFocus) {
    nextTick(() => triggerElement.value?.focus());
  }
}

function getFocusableItems() {
  if (!contentRef.value) return [];
  return Array.from(
    contentRef.value.querySelectorAll<HTMLElement>(
      [
        '[role="menuitem"]:not([aria-disabled="true"])',
        "a[href]",
        "button:not([disabled])",
        "input:not([disabled])",
        "select:not([disabled])",
        "textarea:not([disabled])",
        '[tabindex]:not([tabindex="-1"])',
      ].join(","),
    ),
  ).filter((element) => !element.hasAttribute("hidden"));
}

function focusItem(position: "first" | "last") {
  const items = getFocusableItems();
  const item = position === "first" ? items[0] : items.at(-1);
  (item || contentRef.value)?.focus();
}

function handleTriggerKeydown(event: KeyboardEvent) {
  if (event.key === "Escape" && isOpen.value) {
    event.preventDefault();
    close(true);
    return;
  }

  if (["ArrowDown", "ArrowUp"].includes(event.key)) {
    event.preventDefault();
    pendingFocus.value = event.key === "ArrowDown" ? "first" : "last";
    if (!isOpen.value) isOpen.value = true;
    else nextTick(() => focusItem(pendingFocus.value || "first"));
    return;
  }

  if (["Enter", " "].includes(event.key) && !isOpen.value) {
    pendingFocus.value = "first";
  }
}

function handleContentKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    close(true);
    return;
  }

  const items = getFocusableItems();
  if (!items.length) return;

  const currentIndex = items.indexOf(document.activeElement as HTMLElement);
  let nextIndex: number | null = null;

  if (["ArrowDown", "ArrowRight"].includes(event.key)) {
    nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
  } else if (["ArrowUp", "ArrowLeft"].includes(event.key)) {
    nextIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
  } else if (event.key === "Home") {
    nextIndex = 0;
  } else if (event.key === "End") {
    nextIndex = items.length - 1;
  }

  if (nextIndex !== null) {
    event.preventDefault();
    items[nextIndex]?.focus();
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function resolvePosition(
  preferred: NonNullable<BasePopoverProps["position"]>,
  trigger: DOMRect,
  menuWidth: number,
  menuHeight: number,
) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  if (
    preferred === "bottom" &&
    trigger.bottom + GAP + menuHeight > viewportHeight - VIEWPORT_MARGIN &&
    trigger.top - GAP - menuHeight >= VIEWPORT_MARGIN
  ) {
    return "top";
  }

  if (
    preferred === "top" &&
    trigger.top - GAP - menuHeight < VIEWPORT_MARGIN &&
    trigger.bottom + GAP + menuHeight <= viewportHeight - VIEWPORT_MARGIN
  ) {
    return "bottom";
  }

  if (
    preferred === "right" &&
    trigger.right + GAP + menuWidth > viewportWidth - VIEWPORT_MARGIN &&
    trigger.left - GAP - menuWidth >= VIEWPORT_MARGIN
  ) {
    return "left";
  }

  if (
    preferred === "left" &&
    trigger.left - GAP - menuWidth < VIEWPORT_MARGIN &&
    trigger.right + GAP + menuWidth <= viewportWidth - VIEWPORT_MARGIN
  ) {
    return "right";
  }

  return preferred;
}

function resolveTransformOrigin(position: NonNullable<BasePopoverProps["position"]>) {
  if (position === "bottom" || position === "top") {
    const inlineOrigin =
      props.align === "left" ? "left" : props.align === "right" ? "right" : "center";
    return `${position === "bottom" ? "top" : "bottom"} ${inlineOrigin}`;
  }

  const blockOrigin =
    props.align === "top" ? "top" : props.align === "bottom" ? "bottom" : "center";
  return `${position === "right" ? "left" : "right"} ${blockOrigin}`;
}

function updatePosition() {
  const trigger = triggerRef.value;
  if (!trigger) return;

  const triggerBox = trigger.getBoundingClientRect();
  const menuWidth = Math.max(contentRef.value?.offsetWidth || 0, 180);
  const menuHeight = contentRef.value?.offsetHeight || 0;
  const position = resolvePosition(props.position, triggerBox, menuWidth, menuHeight);
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  let top = 0;
  let left = 0;

  if (position === "bottom" || position === "top") {
    top =
      position === "bottom"
        ? triggerBox.bottom + GAP
        : triggerBox.top - menuHeight - GAP;

    if (props.align === "left") {
      left = triggerBox.left;
    } else if (props.align === "right") {
      left = triggerBox.right - menuWidth;
    } else {
      left = triggerBox.left + (triggerBox.width - menuWidth) / 2;
    }
  } else {
    left =
      position === "right" ? triggerBox.right + GAP : triggerBox.left - menuWidth - GAP;

    if (props.align === "top") {
      top = triggerBox.top;
    } else if (props.align === "bottom") {
      top = triggerBox.bottom - menuHeight;
    } else {
      top = triggerBox.top + (triggerBox.height - menuHeight) / 2;
    }
  }

  actualPosition.value = position;
  transformOrigin.value = resolveTransformOrigin(position);
  popoverRect.value = {
    top: clamp(
      top,
      VIEWPORT_MARGIN,
      Math.max(VIEWPORT_MARGIN, viewportHeight - menuHeight - VIEWPORT_MARGIN),
    ),
    left: clamp(
      left,
      VIEWPORT_MARGIN,
      Math.max(VIEWPORT_MARGIN, viewportWidth - menuWidth - VIEWPORT_MARGIN),
    ),
    minWidth: Math.max(180, Math.round(triggerBox.width)),
  };
}

function addPositionListeners() {
  window.addEventListener("resize", updatePosition);
  window.addEventListener("scroll", updatePosition, true);
}

function removePositionListeners() {
  window.removeEventListener("resize", updatePosition);
  window.removeEventListener("scroll", updatePosition, true);
}

const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as Node;
  if (popoverRef.value?.contains(target) || contentRef.value?.contains(target)) {
    return;
  }
  close();
};

watch(isOpen, async (open) => {
  if (!open) {
    removePositionListeners();
    return;
  }

  await nextTick();
  updatePosition();
  addPositionListeners();
  if (pendingFocus.value) {
    focusItem(pendingFocus.value);
    pendingFocus.value = null;
  }
});

onMounted(() => {
  document.addEventListener("mousedown", handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener("mousedown", handleClickOutside);
  removePositionListeners();
});

defineExpose({ close, toggle });
</script>

<template>
  <div class="popover-container" ref="popoverRef">
    <div class="popover-trigger" ref="triggerRef">
      <slot name="trigger" :isOpen="isOpen" :triggerProps="triggerProps"></slot>
    </div>
    <Teleport to="body">
      <Transition name="popover">
        <div
          v-if="isOpen"
          ref="contentRef"
          class="popover-content"
          :id="contentId"
          :class="[`align-${align}`, `pos-${actualPosition}`]"
          :style="popoverStyle"
          :role="role"
          :aria-labelledby="triggerId"
          tabindex="-1"
          @keydown="handleContentKeydown"
        >
          <slot :close="close"></slot>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.popover-container {
  display: inline-block;
}

.popover-trigger {
  display: inline-flex;
  cursor: pointer;
}

.popover-content {
  position: fixed;
  z-index: 3000;
  background: var(--surface);
  border: 1px solid var(--border, #e5e5e5);
  border-radius: 8px;
  color: var(--text);
  box-shadow: var(--shadow-soft, 0 4px 12px rgba(0, 0, 0, 0.1));
  min-width: 180px;
  transform-origin: var(--popover-transform-origin, top right);
}

/* Transitions */
.popover-enter-active,
.popover-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.popover-enter-from,
.popover-leave-to {
  opacity: 0;
}

.pos-bottom.popover-enter-from,
.pos-bottom.popover-leave-to {
  transform: translateY(-4px) scale(0.98);
}

.pos-top.popover-enter-from,
.pos-top.popover-leave-to {
  transform: translateY(4px) scale(0.98);
}

.pos-left.popover-enter-from,
.pos-left.popover-leave-to {
  transform: translateX(4px) scale(0.98);
}

.pos-right.popover-enter-from,
.pos-right.popover-leave-to {
  transform: translateX(-4px) scale(0.98);
}
</style>
