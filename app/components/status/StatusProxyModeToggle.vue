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
    <label
      v-for="option in options"
      :key="option.value"
      :class="{ 'is-active': modelValue === option.value }"
    >
      <input
        type="radio"
        name="proxy-mode"
        :value="option.value"
        :checked="modelValue === option.value"
        @change="selectMode(option.value)"
      />
      <span>{{ option.label }}</span>
    </label>
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

.mode-toggle label {
  position: relative;
  cursor: pointer;
}

.mode-toggle input {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
}

.mode-toggle span {
  display: inline-flex;
  min-height: 30px;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  padding: 0 10px;
  color: var(--muted);
  font-size: 0.76rem;
  font-weight: 800;
}

.mode-toggle label.is-active span {
  background: var(--surface);
  color: var(--green);
  box-shadow: 0 1px 3px rgba(20, 34, 27, 0.12);
}

@media (max-width: 560px) {
  .mode-toggle {
    width: 100%;
  }

  .mode-toggle label {
    flex: 1 1 100%;
  }

  .mode-toggle span {
    width: 100%;
  }
}
</style>
