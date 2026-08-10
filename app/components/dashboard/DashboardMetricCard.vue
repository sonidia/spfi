<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string;
    value: string;
    detail: string;
    tone?: "green" | "blue" | "amber" | "violet" | "red";
    delay?: number;
    loading?: boolean;
  }>(),
  {
    tone: "green",
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
      <span class="metric-spark"><i /><i /><i /><i /></span>
    </div>
    <p class="metric-label">{{ label }}</p>
    <div v-if="loading" class="metric-skeleton" aria-label="Loading metric" />
    <p v-else class="metric-value">{{ value }}</p>
    <p class="metric-detail">{{ detail }}</p>
  </article>
</template>

<style scoped>
.dashboard-metric {
  --metric-accent: var(--green);
  --metric-soft: var(--green-soft);
  position: relative;
  min-height: 156px;
  padding: 17px;
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
  margin-bottom: 14px;
}

.metric-icon {
  display: inline-grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 11px;
  background: var(--metric-soft);
  color: var(--metric-accent);
}

.metric-icon :deep(svg) {
  width: 18px;
  height: 18px;
}

.metric-spark {
  display: flex;
  height: 26px;
  align-items: flex-end;
  gap: 3px;
}

.metric-spark i {
  width: 3px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--metric-accent) 52%, transparent);
  animation: spark-rise 1.8s ease-in-out infinite alternate;
}

.metric-spark i:nth-child(1) {
  height: 31%;
}

.metric-spark i:nth-child(2) {
  height: 62%;
  animation-delay: 0.18s;
}

.metric-spark i:nth-child(3) {
  height: 47%;
  animation-delay: 0.34s;
}

.metric-spark i:nth-child(4) {
  height: 84%;
  animation-delay: 0.5s;
}

.metric-label {
  margin-bottom: 3px;
  color: var(--text-sub);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.metric-value {
  max-width: 100%;
  overflow: hidden;
  color: var(--text);
  font-size: clamp(20px, 2.2vw, 28px);
  font-weight: 750;
  letter-spacing: -0.04em;
  line-height: 1.12;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metric-detail {
  margin-top: 7px;
  color: var(--muted);
  font-size: 12px;
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
  .metric-spark i,
  .metric-skeleton {
    animation: none;
  }
}
</style>
