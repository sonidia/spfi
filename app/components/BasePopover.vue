<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  align: {
    type: String,
    default: 'right', // 'left' or 'right'
  }
});

const isOpen = ref(false);
const popoverRef = ref<HTMLElement | null>(null);

const toggle = () => {
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
  document.addEventListener('mousedown', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside);
});

defineExpose({ close, toggle });
</script>

<template>
  <div class="popover-container" ref="popoverRef">
    <div class="popover-trigger" @click="toggle">
      <slot name="trigger" :isOpen="isOpen"></slot>
    </div>
    <Transition name="popover">
      <div v-if="isOpen" class="popover-content" :class="[`align-${align}`]">
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
  cursor: pointer;
}

.popover-content {
  position: absolute;
  top: calc(100% + 8px);
  z-index: 1000;
  background: white;
  border: 1px solid var(--border, #e5e5e5);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  min-width: 180px;
  overflow: hidden;
  transform-origin: top;
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
  transform: translateY(-4px) scale(0.98);
}
</style>
