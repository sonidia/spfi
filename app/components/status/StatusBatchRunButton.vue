<script setup lang="ts">
defineProps<{
  busy: boolean;
  label: string;
  busyLabel: string;
}>();

const emit = defineEmits<{
  run: [];
  stop: [];
}>();
</script>

<template>
  <div class="batch-run">
    <button
      class="stop-button"
      type="button"
      :disabled="!busy"
      title="Stop batch check"
      @click="emit('stop')"
    >
      <span class="stop-icon" aria-hidden="true" />
      Stop
    </button>
    <button
      type="button"
      :disabled="busy"
      title="Run status check"
      @click="emit('run')"
    >
      <span v-if="busy" class="spinner" aria-hidden="true" />
      <span v-else class="play-icon" aria-hidden="true" />
      {{ busy ? busyLabel : label }}
    </button>
  </div>
</template>

<style scoped>
.batch-run {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
}

.batch-run button {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 0;
  border-radius: 8px;
  padding: 0 12px;
  background: var(--green);
  color: white;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.8rem;
  font-weight: 600;
}

.batch-run button:disabled {
  cursor: wait;
  opacity: 0.75;
}

.batch-run .stop-button {
  border: 1px solid rgba(180, 49, 43, 0.22);
  background: var(--red-soft);
  color: var(--red);
}

.batch-run .stop-button:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.45);
  border-top-color: white;
  border-radius: 999px;
  animation: spin 0.8s linear infinite;
}

.play-icon {
  width: 0;
  height: 0;
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  border-left: 9px solid currentColor;
}

.stop-icon {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background: currentColor;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 560px) {
  .batch-run,
  .batch-run button {
    width: 100%;
  }
}
</style>
