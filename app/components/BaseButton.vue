<script setup lang="ts">
import { LoaderCircle } from "@lucide/vue";

withDefaults(
  defineProps<{
    variant?: "secondary" | "primary" | "danger" | "danger-ghost" | "ghost";
    size?: "small" | "medium";
    loading?: boolean;
    iconOnly?: boolean;
    disabled?: boolean;
  }>(),
  {
    variant: "secondary",
    size: "small",
    loading: false,
    iconOnly: false,
    disabled: false,
  },
);
</script>

<template>
  <button
    type="button"
    class="base-button"
    :class="[`is-${variant}`, `is-${size}`, { 'is-icon-only': iconOnly }]"
    :disabled="loading || disabled"
    :aria-busy="loading"
  >
    <span v-if="loading || $slots.icon" class="button-icon" aria-hidden="true">
      <LoaderCircle v-if="loading" class="spinner" :size="15" />
      <slot v-else name="icon" />
    </span>
    <span v-if="!iconOnly" class="button-label"><slot /></span>
  </button>
</template>

<style scoped>
.base-button {
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 11px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface-raised);
  color: var(--text);
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.base-button:hover:not(:disabled) {
  background: var(--surface-soft);
  border-color: color-mix(in srgb, var(--green) 38%, var(--border));
}

.base-button:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--green) 20%, transparent);
}

.base-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.base-button.is-medium {
  min-height: 36px;
  padding: 0 14px;
}

.base-button.is-primary {
  border-color: var(--green);
  background: var(--green);
  color: var(--bg);
}

.base-button.is-primary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--green) 88%, var(--text));
}

.base-button.is-danger {
  border-color: var(--red);
  background: var(--red);
  color: var(--bg);
}

.base-button.is-danger-ghost {
  color: var(--red);
}

.base-button.is-ghost {
  border-color: transparent;
  background: transparent;
}

.base-button.is-icon-only {
  width: 32px;
  padding: 0;
}

.base-button.is-icon-only.is-medium {
  width: 36px;
}

.button-icon,
.button-icon :deep(svg) {
  width: 15px;
  height: 15px;
  flex: 0 0 15px;
}

.button-icon {
  display: inline-grid;
  place-items: center;
}

.button-label {
  overflow: hidden;
  text-overflow: ellipsis;
}

.spinner {
  animation: button-spin 0.8s linear infinite;
}

@keyframes button-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
