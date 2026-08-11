<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    value: number;
    currency?: string;
    compact?: boolean;
    maximumFractionDigits?: number;
    suffix?: string;
  }>(),
  {
    currency: "",
    compact: true,
    maximumFractionDigits: 1,
    suffix: "",
  },
);

const root = ref<HTMLElement | null>(null);
const displayedValue = ref(0);
const isAnimating = ref(false);
let observer: IntersectionObserver | null = null;
let animationFrame = 0;
let hasEntered = false;

const label = computed(() => {
  const options: Intl.NumberFormatOptions = {
    notation: props.compact ? "compact" : "standard",
    maximumFractionDigits: props.maximumFractionDigits,
  };
  if (props.currency) {
    options.style = "currency";
    options.currency = props.currency;
  }
  return `${new Intl.NumberFormat(undefined, options).format(displayedValue.value)}${props.suffix}`;
});

function animateTo(target: number) {
  cancelAnimationFrame(animationFrame);
  if (
    typeof window === "undefined" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    displayedValue.value = target;
    isAnimating.value = false;
    return;
  }

  const start = displayedValue.value;
  const change = target - start;
  const startedAt = performance.now();
  isAnimating.value = true;

  const tick = (now: number) => {
    const elapsed = Math.min(1, (now - startedAt) / 850);
    const eased = 1 - (1 - elapsed) ** 4;
    displayedValue.value = start + change * eased;
    if (elapsed < 1) {
      animationFrame = requestAnimationFrame(tick);
    } else {
      displayedValue.value = target;
      window.setTimeout(() => (isAnimating.value = false), 140);
    }
  };
  animationFrame = requestAnimationFrame(tick);
}

watch(
  () => props.value,
  (value) => {
    if (hasEntered) animateTo(value);
  },
);

onMounted(() => {
  observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry?.isIntersecting) return;
      hasEntered = true;
      animateTo(props.value);
      observer?.disconnect();
    },
    { threshold: 0.35 },
  );
  if (root.value) observer.observe(root.value);
});

onBeforeUnmount(() => {
  observer?.disconnect();
  cancelAnimationFrame(animationFrame);
});
</script>

<template>
  <span
    ref="root"
    class="dashboard-animated-number"
    :class="{ 'is-counting': isAnimating }"
  >
    {{ label }}
  </span>
</template>

<style scoped>
.dashboard-animated-number {
  display: inline-block;
  font-variant-numeric: tabular-nums;
  transform-origin: left bottom;
}

:global(html[data-locale-direction="rtl"]) .dashboard-animated-number {
  transform-origin: right bottom;
}

.dashboard-animated-number.is-counting {
  animation: dashboard-number-pop 0.34s ease-in-out infinite alternate;
}

@keyframes dashboard-number-pop {
  to {
    transform: translateY(-1px) scale(1.018);
  }
}

@media (prefers-reduced-motion: reduce) {
  .dashboard-animated-number.is-counting {
    animation: none;
  }
}
</style>
