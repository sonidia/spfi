<script setup lang="ts">
import type { DashboardRevenuePoint } from "~~/types/dashboard";

const props = defineProps<{
  points: DashboardRevenuePoint[];
}>();

const canvas = ref<HTMLCanvasElement | null>(null);
const chartShell = ref<HTMLElement | null>(null);
const hoveredIndex = ref<number | null>(null);
const tooltipX = ref(0);
let resizeObserver: ResizeObserver | null = null;
let themeObserver: MutationObserver | null = null;
let animationFrame = 0;
let chartGeometry = { left: 54, width: 0 };

const currencies = computed(() => {
  const totals = new Map<string, number>();
  for (const point of props.points) {
    for (const value of point.values) {
      totals.set(value.currency, (totals.get(value.currency) || 0) + value.amount);
    }
  }
  return [...totals.entries()]
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 4)
    .map(([currency]) => currency);
});

const palette = ["#2b8a5b", "#3e7db5", "#d38a2d", "#8b6fc0"];
const tooltipPoint = computed(() =>
  hoveredIndex.value === null ? null : props.points[hoveredIndex.value] || null,
);

function valueFor(point: DashboardRevenuePoint, currency: string) {
  return point.values.find((value) => value.currency === currency)?.amount || 0;
}

function formatCompact(value: number, currency?: string) {
  return new Intl.NumberFormat(undefined, {
    style: currency ? "currency" : "decimal",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function draw(progress = 1) {
  const element = canvas.value;
  const shell = chartShell.value;
  if (!element || !shell) return;
  const width = Math.max(320, shell.clientWidth);
  const height = 286;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  element.width = Math.round(width * ratio);
  element.height = Math.round(height * ratio);
  element.style.width = `${width}px`;
  element.style.height = `${height}px`;

  const context = element.getContext("2d");
  if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);

  const styles = getComputedStyle(document.documentElement);
  const lineColor = styles.getPropertyValue("--border").trim() || "#d9e4dd";
  const textColor = styles.getPropertyValue("--muted").trim() || "#65756c";
  const left = 54;
  const right = 18;
  const top = 18;
  const bottom = 38;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  chartGeometry = { left, width: chartWidth };

  const values = currencies.value.flatMap((currency) =>
    props.points.map((point) => valueFor(point, currency)),
  );
  const maxValue = Math.max(1, ...values);
  const niceMax = niceCeiling(maxValue);

  context.font = '11px "DM Sans", sans-serif';
  context.textBaseline = "middle";
  context.lineWidth = 1;
  for (let index = 0; index <= 4; index += 1) {
    const y = top + (chartHeight * index) / 4;
    context.strokeStyle = lineColor;
    context.globalAlpha = index === 4 ? 0.8 : 0.48;
    context.beginPath();
    context.moveTo(left, y);
    context.lineTo(width - right, y);
    context.stroke();
    context.globalAlpha = 1;
    context.fillStyle = textColor;
    context.textAlign = "right";
    context.fillText(formatCompact(niceMax * (1 - index / 4)), left - 9, y);
  }

  const pointX = (index: number) =>
    left +
    (props.points.length <= 1
      ? chartWidth / 2
      : (chartWidth * index) / (props.points.length - 1));
  const pointY = (value: number) => top + chartHeight * (1 - value / niceMax);

  currencies.value.forEach((currency, seriesIndex) => {
    const color = palette[seriesIndex] || "#2b8a5b";
    const drawnCount = Math.max(
      1,
      Math.ceil(props.points.length * Math.min(1, progress)),
    );
    const visible = props.points.slice(0, drawnCount);
    if (!visible.length) return;

    const gradient = context.createLinearGradient(0, top, 0, top + chartHeight);
    gradient.addColorStop(0, `${color}30`);
    gradient.addColorStop(1, `${color}00`);
    context.beginPath();
    visible.forEach((point, index) => {
      const x = pointX(index);
      const y = pointY(valueFor(point, currency));
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.lineTo(pointX(visible.length - 1), top + chartHeight);
    context.lineTo(pointX(0), top + chartHeight);
    context.closePath();
    context.fillStyle = gradient;
    context.fill();

    context.beginPath();
    visible.forEach((point, index) => {
      const x = pointX(index);
      const y = pointY(valueFor(point, currency));
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.strokeStyle = color;
    context.lineWidth = seriesIndex === 0 ? 2.7 : 2;
    context.lineJoin = "round";
    context.lineCap = "round";
    context.stroke();
  });

  const labelIndexes = new Set([
    0,
    Math.floor((props.points.length - 1) / 2),
    props.points.length - 1,
  ]);
  context.fillStyle = textColor;
  context.textAlign = "center";
  for (const index of labelIndexes) {
    const point = props.points[index];
    if (!point) continue;
    context.fillText(
      new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
        new Date(`${point.date}T12:00:00`),
      ),
      pointX(index),
      height - 15,
    );
  }

  if (hoveredIndex.value !== null && props.points[hoveredIndex.value]) {
    const x = pointX(hoveredIndex.value);
    context.strokeStyle = textColor;
    context.globalAlpha = 0.5;
    context.setLineDash([3, 4]);
    context.beginPath();
    context.moveTo(x, top);
    context.lineTo(x, top + chartHeight);
    context.stroke();
    context.setLineDash([]);
    context.globalAlpha = 1;
    currencies.value.forEach((currency, seriesIndex) => {
      context.beginPath();
      context.arc(
        x,
        pointY(valueFor(props.points[hoveredIndex.value as number]!, currency)),
        4,
        0,
        Math.PI * 2,
      );
      context.fillStyle = palette[seriesIndex] || "#2b8a5b";
      context.fill();
    });
  }
}

function animate() {
  cancelAnimationFrame(animationFrame);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) {
    draw(1);
    return;
  }
  const startedAt = performance.now();
  const tick = (now: number) => {
    const elapsed = Math.min(1, (now - startedAt) / 780);
    draw(1 - (1 - elapsed) ** 3);
    if (elapsed < 1) animationFrame = requestAnimationFrame(tick);
  };
  animationFrame = requestAnimationFrame(tick);
}

function handlePointer(event: PointerEvent) {
  if (!canvas.value || !props.points.length) return;
  const rect = canvas.value.getBoundingClientRect();
  const relativeX = event.clientX - rect.left;
  const normalized = Math.min(
    1,
    Math.max(0, (relativeX - chartGeometry.left) / chartGeometry.width),
  );
  hoveredIndex.value = Math.round(normalized * (props.points.length - 1));
  tooltipX.value = Math.min(rect.width - 84, Math.max(84, relativeX));
  draw(1);
}

function clearPointer() {
  hoveredIndex.value = null;
  draw(1);
}

function niceCeiling(value: number) {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

watch(
  () => props.points,
  () => nextTick(animate),
  { deep: true },
);

onMounted(() => {
  resizeObserver = new ResizeObserver(() => draw(1));
  if (chartShell.value) resizeObserver.observe(chartShell.value);
  themeObserver = new MutationObserver(() => draw(1));
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  animate();
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  themeObserver?.disconnect();
  cancelAnimationFrame(animationFrame);
});
</script>

<template>
  <div ref="chartShell" class="revenue-chart-shell">
    <div v-if="currencies.length" class="chart-legend" aria-label="Currencies">
      <span v-for="(currency, index) in currencies" :key="currency">
        <i :style="{ background: palette[index] }" />{{ currency }}
      </span>
    </div>
    <div v-if="!points.length" class="chart-empty">No revenue data this month.</div>
    <canvas
      v-else
      ref="canvas"
      class="revenue-canvas"
      role="img"
      :aria-label="`Daily revenue chart with ${points.length} days`"
      @pointermove="handlePointer"
      @pointerleave="clearPointer"
    />
    <div
      v-if="tooltipPoint"
      class="chart-tooltip"
      :style="{ left: `${tooltipX}px` }"
      aria-live="polite"
    >
      <strong>{{ tooltipPoint.date }}</strong>
      <span>{{ tooltipPoint.orders }} orders</span>
      <span v-for="value in tooltipPoint.values" :key="value.currency">
        {{ formatCompact(value.amount, value.currency) }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.revenue-chart-shell {
  position: relative;
  width: 100%;
  min-height: 286px;
}

.revenue-canvas {
  display: block;
  max-width: 100%;
  touch-action: pan-y;
}

.chart-legend {
  position: absolute;
  top: 0;
  right: 10px;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px 12px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
}

.chart-legend span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.chart-legend i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.chart-tooltip {
  position: absolute;
  top: 20px;
  z-index: 2;
  display: grid;
  min-width: 128px;
  padding: 9px 11px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-overlay);
  box-shadow: var(--shadow-soft);
  color: var(--muted);
  font-size: 11px;
  pointer-events: none;
  transform: translateX(-50%);
  backdrop-filter: blur(12px);
}

.chart-tooltip strong {
  margin-bottom: 3px;
  color: var(--text);
}

.chart-empty {
  display: grid;
  min-height: 260px;
  place-items: center;
  color: var(--muted);
  font-size: 13px;
}

@media (max-width: 560px) {
  .chart-legend {
    position: static;
    justify-content: flex-start;
    margin-bottom: 8px;
  }
}
</style>
