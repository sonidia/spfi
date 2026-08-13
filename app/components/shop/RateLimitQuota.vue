<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useLocalization } from "~/composables/useLocalization";
import { useFormStore } from "~/stores/form";
import { useRateLimitStore } from "~/stores/rateLimit";

defineProps<{
  collapsed: boolean;
}>();

const CIRCLE_RADIUS = 17;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

const rateLimit = useRateLimitStore();
const formStore = useFormStore();
const { locale, t } = useLocalization();
const now = ref(Date.now());
let clock: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  clock = setInterval(() => {
    now.value = Date.now();
  }, 1_000);
});

onBeforeUnmount(() => {
  if (clock) clearInterval(clock);
});

const effectiveRemaining = computed(() => {
  if (!rateLimit.isKnown) return null;
  if (now.value >= (rateLimit.resetAt || 0)) return rateLimit.limit;
  return rateLimit.remaining;
});

const exactPercentage = computed(() => {
  if (rateLimit.limit === null || effectiveRemaining.value === null) return 0;
  return Math.max(0, Math.min(100, (effectiveRemaining.value / rateLimit.limit) * 100));
});

const percentage = computed(() => Math.round(exactPercentage.value));
const ringOffset = computed(
  () => CIRCLE_CIRCUMFERENCE * (1 - exactPercentage.value / 100),
);
const requestTone = computed(() => {
  if (!rateLimit.isKnown) return "is-unknown";
  if (exactPercentage.value <= 20) return "is-critical";
  if (exactPercentage.value <= 50) return "is-warning";
  return "is-healthy";
});
const graphqlCost = computed(() => rateLimit.graphqlCosts[formStore.storeId] || null);
const effectiveGraphqlRemaining = computed(() => {
  const snapshot = graphqlCost.value;
  if (!snapshot) return null;

  const restored =
    (Math.max(0, now.value - snapshot.observedAt) / 1_000) * snapshot.restoreRate;
  return Math.min(snapshot.limit, snapshot.remaining + restored);
});
const exactGraphqlPercentage = computed(() => {
  const snapshot = graphqlCost.value;
  if (!snapshot || effectiveGraphqlRemaining.value === null) return 0;
  return Math.max(
    0,
    Math.min(100, (effectiveGraphqlRemaining.value / snapshot.limit) * 100),
  );
});
const graphqlPercentage = computed(() => Math.round(exactGraphqlPercentage.value));
const graphqlTone = computed(() => {
  if (!graphqlCost.value) return "is-unknown";
  if (exactGraphqlPercentage.value <= 20) return "is-critical";
  if (exactGraphqlPercentage.value <= 50) return "is-warning";
  return "is-healthy";
});
const resetText = computed(() => {
  if (!rateLimit.isKnown || rateLimit.resetAt === null) {
    return t("quota.waiting");
  }

  const seconds = Math.max(0, Math.ceil((rateLimit.resetAt - now.value) / 1_000));
  if (seconds === 0) return t("quota.refreshed");
  return t("quota.resetsIn", { seconds });
});
const accessibleLabel = computed(() => {
  if (!rateLimit.isKnown || effectiveRemaining.value === null) {
    return t("quota.accessibleWaiting");
  }

  return t("quota.accessibleRemaining", {
    remaining: formatNumber(effectiveRemaining.value),
    limit: formatNumber(rateLimit.limit || 0),
    percent: percentage.value,
  });
});
const graphqlAccessibleLabel = computed(() => {
  const snapshot = graphqlCost.value;
  if (!snapshot || effectiveGraphqlRemaining.value === null) {
    return t("quota.graphqlAccessibleWaiting");
  }

  return t("quota.graphqlAccessibleRemaining", {
    remaining: formatCost(effectiveGraphqlRemaining.value),
    limit: formatCost(snapshot.limit),
    percent: graphqlPercentage.value,
    rate: formatCost(snapshot.restoreRate),
  });
});

function formatNumber(value: number) {
  return new Intl.NumberFormat(locale.value).format(value);
}

function formatCost(value: number) {
  return new Intl.NumberFormat(locale.value, {
    maximumFractionDigits: 1,
  }).format(value);
}
</script>

<template>
  <section
    class="rate-limit-quota"
    :class="{ 'is-collapsed': collapsed }"
    :aria-label="accessibleLabel"
  >
    <template v-if="collapsed">
      <div
        class="quota-ring"
        :class="requestTone"
        role="meter"
        :aria-label="t('quota.remaining')"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="rateLimit.isKnown ? percentage : undefined"
        :title="accessibleLabel"
      >
        <svg viewBox="0 0 42 42" aria-hidden="true">
          <circle class="quota-ring-track" cx="21" cy="21" :r="CIRCLE_RADIUS" />
          <circle
            class="quota-ring-value"
            cx="21"
            cy="21"
            :r="CIRCLE_RADIUS"
            :stroke-dasharray="CIRCLE_CIRCUMFERENCE"
            :stroke-dashoffset="ringOffset"
          />
        </svg>
        <span>{{ rateLimit.isKnown ? percentage : "—" }}</span>
      </div>
    </template>

    <template v-else>
      <div class="quota-meter" :class="requestTone">
        <div class="quota-heading">
          <span class="quota-title">
            <span class="quota-status-dot" aria-hidden="true" />
            {{ t("quota.title") }}
          </span>
          <strong>{{ rateLimit.isKnown ? `${percentage}%` : "—" }}</strong>
        </div>

        <div
          class="quota-progress"
          role="meter"
          :aria-label="t('quota.remaining')"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="rateLimit.isKnown ? percentage : undefined"
        >
          <span :style="{ width: `${exactPercentage}%` }" />
        </div>

        <div class="quota-meta">
          <span v-if="rateLimit.isKnown && effectiveRemaining !== null">
            {{
              t("quota.inlineRemaining", {
                remaining: formatNumber(effectiveRemaining),
                limit: formatNumber(rateLimit.limit || 0),
              })
            }}
          </span>
          <span v-else>{{ t("quota.noData") }}</span>
          <span>{{ resetText }}</span>
        </div>
      </div>

      <div
        class="quota-meter graphql-cost-meter"
        :class="graphqlTone"
        :aria-label="graphqlAccessibleLabel"
      >
        <div class="quota-heading">
          <span class="quota-title">
            <span class="quota-status-dot" aria-hidden="true" />
            {{ t("quota.graphqlTitle") }}
          </span>
          <strong>{{ graphqlCost ? `${graphqlPercentage}%` : "—" }}</strong>
        </div>

        <div
          class="quota-progress"
          role="meter"
          :aria-label="t('quota.graphqlRemaining')"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="graphqlCost ? graphqlPercentage : undefined"
        >
          <span :style="{ width: `${exactGraphqlPercentage}%` }" />
        </div>

        <div class="quota-meta">
          <span v-if="graphqlCost && effectiveGraphqlRemaining !== null">
            {{
              t("quota.graphqlInlineRemaining", {
                remaining: formatCost(effectiveGraphqlRemaining),
                limit: formatCost(graphqlCost.limit),
              })
            }}
          </span>
          <span v-else>{{ t("quota.graphqlNoData") }}</span>
          <span v-if="graphqlCost">
            {{
              t("quota.graphqlRestoreRate", {
                rate: formatCost(graphqlCost.restoreRate),
              })
            }}
          </span>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.rate-limit-quota {
  flex: 0 0 auto;
  margin: 0 8px 8px;
  padding: 11px 12px 10px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--surface-low);
}

.quota-meter,
.quota-ring {
  --quota-color: var(--green);
}

.quota-meter.is-warning,
.quota-ring.is-warning {
  --quota-color: var(--amber);
}

.quota-meter.is-critical,
.quota-ring.is-critical {
  --quota-color: var(--red);
}

.quota-meter.is-unknown,
.quota-ring.is-unknown {
  --quota-color: var(--text-muted);
}

.graphql-cost-meter {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}

.quota-heading,
.quota-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.quota-heading {
  color: var(--text-primary);
  font-size: 12px;
}

.quota-heading strong {
  color: var(--quota-color);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.quota-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
}

.quota-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--quota-color);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--quota-color) 13%, transparent);
}

.quota-progress {
  height: 6px;
  margin: 9px 0 7px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, var(--quota-color) 14%, var(--surface-soft));
}

.quota-progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--quota-color);
  transition:
    width 180ms ease,
    background-color 180ms ease;
}

.quota-meta {
  color: var(--text-muted);
  font-size: 9.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.rate-limit-quota.is-collapsed {
  display: grid;
  place-items: center;
  margin: 0 6px 8px;
  padding: 5px;
  border-color: transparent;
  background: transparent;
}

.quota-ring {
  position: relative;
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  color: var(--quota-color);
  font-size: 9px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.quota-ring svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.quota-ring circle {
  fill: none;
  stroke-width: 3;
}

.quota-ring-track {
  stroke: color-mix(in srgb, var(--quota-color) 15%, var(--border));
}

.quota-ring-value {
  stroke: var(--quota-color);
  stroke-linecap: round;
  transition:
    stroke-dashoffset 180ms ease,
    stroke 180ms ease;
}

@media (prefers-reduced-motion: reduce) {
  .quota-progress span,
  .quota-ring-value {
    transition: none;
  }
}
</style>
