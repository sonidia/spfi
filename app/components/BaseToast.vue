<script lang="ts" setup>
import { X } from "@lucide/vue";
import { useToastStore } from "../stores/toast";

const toastStore = useToastStore();
const { t } = useLocalization();
</script>

<template>
  <div class="toast-container" aria-live="polite" aria-atomic="false">
    <TransitionGroup name="toast">
      <div
        v-for="toast in toastStore.toasts"
        :key="toast.id"
        class="toast-item"
        :class="toast.type"
        :role="toast.type === 'error' ? 'alert' : 'status'"
        :aria-live="toast.type === 'error' ? 'assertive' : 'polite'"
      >
        <div class="toast-icon" aria-hidden="true">
          <svg
            v-if="toast.type === 'success'"
            width="16"
            height="16"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clip-rule="evenodd"
            />
          </svg>
          <svg
            v-else-if="toast.type === 'error'"
            width="16"
            height="16"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clip-rule="evenodd"
            />
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path
              fill-rule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clip-rule="evenodd"
            />
          </svg>
        </div>
        <div class="toast-message">{{ toast.message }}</div>
        <button
          type="button"
          class="toast-dismiss"
          :aria-label="t('common.dismissNotification')"
          @click="toastStore.removeToast(toast.id)"
        >
          <X aria-hidden="true" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
}

.toast-item {
  pointer-events: auto;
  min-width: 280px;
  max-width: 400px;
  padding: 12px 16px;
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  gap: 12px;
  border-left: 4px solid var(--border);
  font-size: 13.5px;
  font-weight: 500;
}

.toast-item.success {
  border-left-color: var(--badge-paid-text);
  color: var(--badge-paid-text);
  background: var(--badge-paid);
}

.toast-item.error {
  border-left-color: var(--badge-cancelled-text);
  color: var(--badge-cancelled-text);
  background: var(--badge-cancelled);
}

.toast-item.warning {
  border-left-color: var(--badge-pending-text);
  color: var(--badge-pending-text);
  background: var(--badge-pending);
}

.toast-item.info {
  border-left-color: var(--blue);
  color: var(--blue);
  background: var(--badge-fulfilled);
}

.toast-message {
  flex: 1;
}

.toast-dismiss {
  width: 24px;
  height: 24px;
  display: inline-grid;
  place-items: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: currentColor;
  cursor: pointer;
  font: inherit;
  font-size: 18px;
  line-height: 1;
}

.toast-dismiss :deep(svg) {
  width: 14px;
  height: 14px;
}

.toast-dismiss:hover,
.toast-dismiss:focus-visible {
  background: color-mix(in srgb, currentColor 12%, transparent);
}

.toast-dismiss:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}

/* Animations */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.toast-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
</style>
