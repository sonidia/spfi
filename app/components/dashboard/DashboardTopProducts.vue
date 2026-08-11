<script setup lang="ts">
import { useLocalization } from "~/composables/useLocalization";
import type { DashboardAggregate } from "~~/types/dashboard";

const props = defineProps<{
  products: DashboardAggregate["topProducts"];
  metric: "units" | "orders" | "revenue";
}>();

const { locale, t } = useLocalization();

const maximumValue = computed(() =>
  Math.max(1, ...props.products.map((product) => rankingValue(product))),
);

function rankingValue(product: DashboardAggregate["topProducts"][number]) {
  if (props.metric === "orders") return product.orders;
  if (props.metric === "revenue") return product.revenue[0]?.amount || 0;
  return product.units;
}

function primaryLabel(product: DashboardAggregate["topProducts"][number]) {
  if (props.metric === "orders")
    return t("dashboard.ordersCount", { count: product.orders });
  if (props.metric === "revenue")
    return moneyLabel(product) || t("dashboard.noRevenue");
  return t("dashboard.unitsCount", { count: product.units });
}

function secondaryLabel(product: DashboardAggregate["topProducts"][number]) {
  if (props.metric === "orders")
    return t("dashboard.unitsCount", { count: product.units });
  if (props.metric === "revenue")
    return t("dashboard.unitsOrdersDetail", {
      units: product.units,
      orders: product.orders,
    });
  return moneyLabel(product);
}

function moneyLabel(product: DashboardAggregate["topProducts"][number]) {
  return product.revenue
    .slice(0, 2)
    .map((value) =>
      new Intl.NumberFormat(locale.value, {
        style: "currency",
        currency: value.currency,
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(value.amount),
    )
    .join(" · ");
}
</script>

<template>
  <div v-if="products.length" class="product-rankings">
    <div
      v-for="(product, index) in products"
      :key="product.key"
      class="product-ranking"
      :style="{ '--rank-delay': `${index * 65}ms` }"
    >
      <span class="rank-index">{{ String(index + 1).padStart(2, "0") }}</span>
      <div class="rank-main">
        <div class="rank-copy">
          <div>
            <strong>{{ product.title }}</strong>
            <span>{{ product.storeName }}</span>
          </div>
          <div class="rank-values">
            <strong>{{ primaryLabel(product) }}</strong>
            <span>{{ secondaryLabel(product) }}</span>
          </div>
        </div>
        <div class="rank-track" aria-hidden="true">
          <i
            :style="{
              width: `${Math.max(5, (rankingValue(product) / maximumValue) * 100)}%`,
            }"
          />
        </div>
      </div>
    </div>
  </div>
  <div v-else class="dashboard-list-empty">{{ t("dashboard.noProductSales") }}</div>
</template>

<style scoped>
.product-rankings {
  display: grid;
  gap: 16px;
}

.product-ranking {
  display: grid;
  grid-template-columns: 28px 1fr;
  align-items: center;
  gap: 10px;
  animation: ranking-enter 0.46s both;
  animation-delay: var(--rank-delay);
}

.rank-index {
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 11px;
}

.rank-main {
  min-width: 0;
}

.rank-copy {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 7px;
}

.rank-copy > div {
  display: grid;
  min-width: 0;
}

.rank-copy strong {
  overflow: hidden;
  color: var(--text);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rank-copy span {
  overflow: hidden;
  color: var(--muted);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rank-values {
  flex: 0 0 auto;
  text-align: right;
}

.rank-track {
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--surface-soft);
}

.rank-track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--green), var(--blue));
  transform-origin: left;
  animation: bar-grow 0.78s cubic-bezier(0.2, 0.75, 0.25, 1) both;
  animation-delay: var(--rank-delay);
}

.dashboard-list-empty {
  display: grid;
  min-height: 220px;
  place-items: center;
  color: var(--muted);
  font-size: 13px;
}

@keyframes ranking-enter {
  from {
    opacity: 0;
    transform: translateX(8px);
  }
}

@keyframes bar-grow {
  from {
    transform: scaleX(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .product-ranking,
  .rank-track i {
    animation: none;
  }
}
</style>
