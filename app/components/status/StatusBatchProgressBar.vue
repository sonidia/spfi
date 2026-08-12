<script setup lang="ts">
defineProps<{
  completed: number;
  errors: number;
  label: string;
  percent: number;
  running: number;
  total: number;
}>();
</script>

<template>
  <div
    class="batch-progress"
    role="progressbar"
    :aria-label="label"
    :aria-valuemax="total"
    aria-valuemin="0"
    :aria-valuenow="completed"
  >
    <div class="batch-progress-head">
      <span>{{ label }}</span>
      <strong>{{ percent }}%</strong>
    </div>
    <div class="batch-progress-track" aria-hidden="true">
      <div class="batch-progress-fill" :style="{ width: `${percent}%` }" />
    </div>
    <div class="batch-progress-meta">
      <span>{{ running }} running</span>
      <span>{{ errors }} errors</span>
    </div>
  </div>
</template>

<style scoped>
.batch-progress {
  display: grid;
  gap: 7px;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 10px 12px;
  background: var(--surface-soft);
}

.batch-progress-head,
.batch-progress-meta {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.batch-progress-head span,
.batch-progress-meta {
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 600;
}

.batch-progress-head strong {
  color: var(--text);
  font-size: 0.82rem;
}

.batch-progress-track {
  height: 9px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(101, 117, 108, 0.18);
}

.batch-progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--green), var(--blue));
  transition: width 0.18s ease;
}
</style>
