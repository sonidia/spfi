<script setup lang="ts">
import type { ProxyMode } from "~~/types/store-status";

interface ProxyModeOption {
  value: ProxyMode;
  label: string;
}

defineProps<{
  modelValue: ProxyMode;
  options: ProxyModeOption[];
}>();

const emit = defineEmits<{
  "update:modelValue": [value: ProxyMode];
}>();

function selectMode(value: ProxyMode) {
  emit("update:modelValue", value);
}
</script>

<template>
  <div class="mode-toggle" role="radiogroup" aria-label="Proxy mode">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="modelValue === option.value"
      :class="{ 'is-active': modelValue === option.value }"
      @click="selectMode(option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.mode-toggle {
  display: inline-flex;
  flex-wrap: nowrap;
  gap: 4px;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 4px;
  background: var(--surface-soft);
}

.mode-toggle button {
  min-height: 30px;
  border: 0;
  border-radius: 6px;
  padding: 0 10px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: inherit;
  font-size: 0.76rem;
  font-weight: 800;
}

.mode-toggle button:hover,
.mode-toggle button:focus-visible {
  color: var(--green);
}

.mode-toggle button:focus-visible {
  outline: 2px solid rgba(31, 122, 77, 0.32);
  outline-offset: 2px;
}

.mode-toggle button.is-active {
  background: var(--surface);
  color: var(--green);
  box-shadow: 0 1px 3px rgba(20, 34, 27, 0.12);
}

@media (max-width: 560px) {
  .mode-toggle {
    width: 100%;
  }

  .mode-toggle button {
    flex: 1 1 100%;
    width: 100%;
  }
}
</style>
