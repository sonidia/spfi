<script setup lang="ts">
import { Check } from "@lucide/vue";

const props = withDefaults(
  defineProps<{
    modelValue?: boolean;
    label?: string;
    description?: string;
    disabled?: boolean;
  }>(),
  {
    modelValue: false,
    label: "",
    description: "",
    disabled: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  change: [value: boolean];
}>();

function toggle() {
  if (props.disabled) return;
  const nextValue = !props.modelValue;
  emit("update:modelValue", nextValue);
  emit("change", nextValue);
}
</script>

<template>
  <button
    type="button"
    class="base-checkbox"
    :class="{ 'is-checked': modelValue }"
    role="checkbox"
    :aria-checked="modelValue"
    :disabled="disabled"
    @click="toggle"
  >
    <span class="checkbox-mark" aria-hidden="true">
      <Check v-if="modelValue" :size="13" />
    </span>
    <span class="checkbox-copy">
      <span v-if="label || $slots.default" class="checkbox-label">
        <slot>{{ label }}</slot>
      </span>
      <small v-if="description">{{ description }}</small>
    </span>
  </button>
</template>

<style scoped>
.base-checkbox {
  min-width: 0;
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0 10px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  cursor: pointer;
  text-align: left;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    box-shadow 0.15s ease,
    color 0.15s ease;
}

.base-checkbox:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--green) 42%, var(--border));
  background: var(--surface-raised);
}

.base-checkbox:focus-visible {
  outline: none;
  border-color: var(--green);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--green) 20%, transparent);
}

.base-checkbox:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.base-checkbox.is-checked {
  border-color: color-mix(in srgb, var(--green) 72%, var(--border));
  background: var(--green-soft);
  color: var(--green);
}

.checkbox-mark {
  width: 17px;
  height: 17px;
  flex: 0 0 17px;
  display: inline-grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--text-muted) 44%, var(--border));
  border-radius: 5px;
  background: var(--surface);
  color: var(--green);
}

.is-checked .checkbox-mark {
  border-color: var(--green);
  background: var(--surface);
}

.checkbox-copy {
  min-width: 0;
  display: grid;
  gap: 1px;
}

.checkbox-label {
  overflow: hidden;
  font-size: 12px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.checkbox-copy small {
  color: var(--text-sub);
  font-size: 11px;
}
</style>
