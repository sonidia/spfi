<script setup lang="ts">
import type { ProxyMode } from "~~/types/store-status";

interface ProxyModeOption {
  value: ProxyMode;
  label: string;
}

const props = defineProps<{
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
      class="mode-option"
      :class="{ 'is-active': props.modelValue === option.value }"
    >
      <input
        class="mode-input"
        type="radio"
        name="status-proxy-mode"
        :value="option.value"
        :checked="props.modelValue === option.value"
        :aria-label="option.label"
        @change="selectMode(option.value)"
        @click="selectMode(option.value)"
      />
      <span class="mode-option-label">{{ option.label }}</span>
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

.mode-option {
  position: relative;
  min-height: 30px;
  border-radius: 6px;
  cursor: pointer;
  display: inline-flex;
}

.mode-input {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.mode-option-label {
  position: relative;
  min-height: 30px;
  border-radius: 6px;
  padding: 0 10px;
  background: transparent;
  color: var(--muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: inherit;
  font-size: 0.76rem;
  font-weight: 800;
  pointer-events: none;
}

.mode-option:hover .mode-option-label,
.mode-option:focus-within .mode-option-label {
  color: var(--green);
}

.mode-option.is-active .mode-option-label {
  background: var(--surface);
  color: var(--green);
  box-shadow: 0 1px 3px rgba(20, 34, 27, 0.12);
}

@media (max-width: 560px) {
  .mode-toggle {
    width: 100%;
  }

  .mode-option {
    flex: 1 1 100%;
    width: 100%;
  }

  .mode-option-label {
    width: 100%;
  }
}
</style>
