<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";

interface BasePopoverProps {
  align?: "left" | "right";
  position?: "top" | "bottom";
}

withDefaults(defineProps<BasePopoverProps>(), {
  align: "right",
  position: "bottom",
});

const isOpen = ref(false);
const popoverRef = ref<HTMLElement | null>(null);

const toggle = (event?: Event) => {
  event?.stopPropagation();
  isOpen.value = !isOpen.value;
};

const close = () => {
  isOpen.value = false;
};

const handleClickOutside = (event: MouseEvent) => {
  if (popoverRef.value && !popoverRef.value.contains(event.target as Node)) {
    close();
  }
};

onMounted(() => {
  document.addEventListener("mousedown", handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener("mousedown", handleClickOutside);
});

defineExpose({ close, toggle });
</script>

<template>
  <div class="popover-container" ref="popoverRef">
    <div class="popover-trigger" @click="toggle">
      <slot name="trigger" :isOpen="isOpen"></slot>
    </div>
    <Transition name="popover">
      <div
        v-if="isOpen"
        class="popover-content"
        :class="[`align-${align}`, `pos-${position}`]"
      >
        <slot :close="close"></slot>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.popover-container {
  position: relative;
  display: inline-block;
}

.popover-trigger {
  display: inline-flex;
  cursor: pointer;
}

.popover-content {
  position: absolute;
  z-index: 1000;
  background: var(--surface);
  border: 1px solid var(--border, #e5e5e5);
  border-radius: 8px;
  color: var(--text);
  box-shadow: var(--shadow-soft, 0 4px 12px rgba(0, 0, 0, 0.1));
  min-width: 180px;
  transform-origin: top;
}

.pos-bottom {
  top: calc(100% + 8px);
  transform-origin: top;
}

.pos-top {
  bottom: calc(100% + 8px);
  transform-origin: bottom;
}

.align-right {
  right: 0;
}

.align-left {
  left: 0;
}

/* Transitions */
.popover-enter-active,
.popover-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
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
</style>
