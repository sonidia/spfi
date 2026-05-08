<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";

const props = defineProps({
  align: {
    type: String,
    default: "left", // 'left' or 'right'
  },
  position: {
    type: String,
    default: "bottom", // 'top' or 'bottom'
  },
});

const isOpen = ref(false);
const popoverRef = ref<HTMLElement | null>(null);

const toggle = (event: Event) => {
  event.stopPropagation();
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
  <div
    class="app-popover"
    ref="popoverRef"
    @mouseenter="toggle"
    @mouseleave="toggle"
  >
    <div class="popover-trigger">
      <slot name="trigger" :isOpen="isOpen"></slot>
    </div>
    <Transition name="popover-fade">
      <div
        v-if="isOpen"
        class="popover-panel"
        :class="[`align-${align}`, `pos-${position}`]"
      >
        <slot :close="close"></slot>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.app-popover {
  position: relative;
  display: inline-block;
}

.popover-trigger {
  display: inline-flex;
}

.popover-panel {
  position: absolute;
  z-index: 1000;
  background: white;
  border: 1px solid #e3e3e3;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  min-width: 220px;
  overflow: hidden;
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
.popover-fade-enter-active,
.popover-fade-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.1s ease;
}

.popover-fade-enter-from,
.popover-fade-leave-to {
  opacity: 0;
  transform: translateY(var(--tw-translate-y, 0));
}

.pos-bottom.popover-fade-enter-from,
.pos-bottom.popover-fade-leave-to {
  transform: translateY(-4px);
}

.pos-top.popover-fade-enter-from,
.pos-top.popover-fade-leave-to {
  transform: translateY(4px);
}
</style>
