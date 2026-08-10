<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string;
    value?: string;
    detail: string;
    tone?: "green" | "blue" | "amber" | "violet" | "red";
    delay?: number;
    loading?: boolean;
  }>(),
  {
    tone: "green",
    value: "",
    delay: 0,
    loading: false,
  },
);
</script>

<template>
  <article
    class="dashboard-metric"
    :class="[`tone-${tone}`, { 'is-loading': loading }]"
    :style="{ '--metric-delay': `${delay}ms` }"
  >
    <div class="metric-topline">
      <span class="metric-icon" aria-hidden="true"><slot /></span>
      <p class="metric-label">{{ label }}</p>
    </div>
    <div v-if="loading" class="metric-skeleton" aria-label="Loading metric" />
    <p v-else class="metric-value">
      <slot name="value">{{ value }}</slot>
    </p>
    <p class="metric-detail">{{ detail }}</p>
  </article>
</template>

<style scoped>
.dashboard-metric {
  --metric-accent: var(--green);
  --metric-soft: var(--green-soft);
  position: relative;
  min-height: 100px;
  padding: 12px 13px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 18px;
  background:
    radial-gradient(
      circle at 100% 0%,
      color-mix(in srgb, var(--metric-soft) 72%, transparent),
      transparent 56%
    ),
    var(--surface);
  box-shadow: var(--shadow-soft);
  animation: metric-enter 0.5s both;
  animation-delay: var(--metric-delay);
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.dashboard-metric:hover {
  transform: translateY(-3px);
  border-color: color-mix(in srgb, var(--metric-accent) 36%, var(--border));
  box-shadow: 0 18px 40px color-mix(in srgb, var(--metric-accent) 12%, transparent);
}

.tone-blue {
  --metric-accent: var(--blue);
  --metric-soft: var(--blue-soft);
}

.tone-amber {
  --metric-accent: var(--amber);
  --metric-soft: var(--amber-soft);
}

.tone-violet {
  --metric-accent: #7759b6;
  --metric-soft: #eee8ff;
}

.tone-red {
  --metric-accent: var(--red);
  --metric-soft: var(--red-soft);
}

.metric-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.metric-icon {
  display: inline-grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 9px;
  background: var(--metric-soft);
  color: var(--metric-accent);
}

.metric-icon :deep(svg) {
  width: 15px;
  height: 15px;
}

.metric-label {
  color: color-mix(in srgb, var(--metric-accent) 76%, var(--text-sub));
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.metric-value {
  max-width: 100%;
  overflow: hidden;
  color: var(--metric-accent);
  font-size: clamp(18px, 1.8vw, 23px);
  font-weight: 750;
  letter-spacing: -0.04em;
  line-height: 1.12;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
}

.metric-detail {
  margin-top: 4px;
  color: color-mix(in srgb, var(--metric-accent) 76%, var(--muted));
  font-size: 10px;
  text-align: center;
}

.metric-skeleton {
  width: 72%;
  height: 28px;
  margin: 5px 0;
  border-radius: 8px;
  background: linear-gradient(
    90deg,
    var(--surface-soft),
    color-mix(in srgb, var(--surface-soft) 48%, white),
    var(--surface-soft)
  );
  background-size: 220% 100%;
  animation: metric-shimmer 1.2s linear infinite;
}

@keyframes metric-enter {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes spark-rise {
  to {
    transform: scaleY(0.64);
    opacity: 0.55;
  }
}

@keyframes metric-shimmer {
  to {
    background-position: -220% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dashboard-metric,
  .metric-skeleton {
    animation: none;
  }
}
</style>
