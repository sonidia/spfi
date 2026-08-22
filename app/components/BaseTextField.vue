<script setup lang="ts">
import { useAttrs } from "vue";

defineOptions({ inheritAttrs: false });

withDefaults(
  defineProps<{
    modelValue?: string;
    type?: "text" | "search" | "url" | "email" | "password" | "date";
    multiline?: boolean;
    rows?: number;
    disabled?: boolean;
    size?: "small" | "medium";
    className?: string;
  }>(),
  {
    modelValue: "",
    type: "text",
    multiline: false,
    rows: 3,
    disabled: false,
    size: "medium",
    className: "",
  },
);

const emit = defineEmits<{ "update:modelValue": [value: string] }>();
const attrs = useAttrs();

function updateValue(event: Event) {
  emit("update:modelValue", (event.target as HTMLInputElement).value);
}
</script>

<template>
  <span
    class="base-text-field"
    :class="[`is-${size}`, { 'has-icon': $slots.icon }, className]"
  >
    <span v-if="$slots.icon" class="text-field-icon" aria-hidden="true">
      <slot name="icon" />
    </span>
    <textarea
      v-if="multiline"
      v-bind="attrs"
      class="text-field-control"
      :value="modelValue"
      :rows="rows"
      :disabled="disabled"
      @input="updateValue"
    />
    <input
      v-else
      v-bind="attrs"
      class="text-field-control"
      :value="modelValue"
      :type="type"
      :disabled="disabled"
      @input="updateValue"
    />
  </span>
</template>

<style scoped>
.base-text-field {
  position: relative;
  min-width: 0;
  width: 100%;
  display: flex;
  color: var(--text);
  font-family: inherit;
}

.text-field-control {
  width: 100%;
  min-width: 0;
  min-height: var(--control-height-md);
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--control-radius-sm);
  outline: none;
  background: var(--surface-raised);
  color: var(--text);
  font: inherit;
  font-size: 13px;
  line-height: 1.45;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    background 0.15s ease;
}

textarea.text-field-control {
  resize: vertical;
}

.text-field-control:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--green) 48%, var(--border));
  background: var(--surface-soft);
}

.text-field-control:focus-visible {
  border-color: var(--green);
  box-shadow: var(--focus-ring);
}

.text-field-control:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.text-field-control::placeholder {
  color: var(--text-muted);
}

.is-small .text-field-control {
  min-height: var(--control-height-sm);
  padding-block: 5px;
}

.has-icon .text-field-control {
  padding-left: 34px;
}

.text-field-icon {
  position: absolute;
  z-index: 1;
  left: 11px;
  top: calc(var(--control-height-md) / 2);
  width: 15px;
  height: 15px;
  display: grid;
  place-items: center;
  color: var(--text-muted);
  pointer-events: none;
  transform: translateY(-50%);
}

.text-field-icon :deep(svg) {
  width: 15px;
  height: 15px;
}
</style>
