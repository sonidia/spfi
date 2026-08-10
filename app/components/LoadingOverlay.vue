<script lang="ts" setup>
defineProps<{ visible: boolean }>();
const { t } = useLocalization();
</script>

<template>
  <Transition name="fade">
    <div
      v-if="visible"
      class="loading-overlay"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div class="loading-spinner">
        <svg
          class="spin-icon"
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          aria-hidden="true"
        >
          <path
            d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
          />
        </svg>
        <span class="loading-text">{{ t("common.loading") }}</span>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.loading-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--surface) 55%, transparent);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
}

.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  background: var(--surface, #fff);
  border: 1px solid var(--border, #e5e5e5);
  border-radius: 12px;
  padding: 24px 32px;
  box-shadow: var(--shadow-soft, 0 8px 32px rgba(0, 0, 0, 0.12));
}

.spin-icon {
  color: var(--text-secondary, #666);
  animation: spin 0.8s linear infinite;
}

.loading-text {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary, #666);
  font-family: inherit;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
