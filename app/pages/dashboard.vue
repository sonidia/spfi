<script setup lang="ts">
import {
  Banknote,
  CalendarDays,
  CircleDollarSign,
  LayoutDashboard,
  PackageCheck,
  RefreshCw,
  ShoppingBag,
  Store,
  UserRoundCog,
  UsersRound,
  WalletCards,
} from "@lucide/vue";
import type { DashboardMoney, StoreDashboardSnapshot } from "~~/types/dashboard";
import {
  aggregateDashboardSnapshots,
  filterDashboardAggregateCurrency,
} from "~~/utils/dashboard-aggregate";

definePageMeta({ layout: false });
useHead({ title: "Dashboard · Spfi" });

const {
  stores: cachedStores,
  failures: cachedFailures,
  isLoading,
  completedStores,
  totalStores,
  progress,
  lastUpdated,
  ensureLoaded,
  refresh,
} = useDashboard();

const selectedStoreId = ref("all");
const selectedCurrency = ref("all");
const storeSort = ref("revenue-desc");
const searchQuery = ref("");
const chartRange = ref<"7d" | "14d" | "month">("month");
const productSort = ref<"units" | "orders" | "revenue">("units");
const queueSort = ref<"oldest" | "newest" | "value">("oldest");
const debouncedSearch = ref("");
const chartRangeOptions = [
  { value: "7d", label: "7D" },
  { value: "14d", label: "14D" },
  { value: "month", label: "MTD" },
] as const;
const productSortOptions = [
  { value: "units", label: "Units" },
  { value: "orders", label: "Orders" },
  { value: "revenue", label: "Revenue" },
] as const;
const queueSortOptions = [
  { value: "oldest", label: "Oldest" },
  { value: "newest", label: "Newest" },
  { value: "value", label: "Value" },
] as const;

const storeOptions = computed(() =>
  cachedStores.value
    .map((store) => ({ id: store.storeId, label: store.storeName }))
    .sort((a, b) => a.label.localeCompare(b.label)),
);
const currencies = computed(() => {
  const values = new Set<string>();
  for (const store of cachedStores.value) {
    values.add(store.currency);
    for (const group of [
      store.revenue.today,
      store.revenue.week,
      store.revenue.month,
      store.payments.balance,
    ]) {
      group.forEach((row) => values.add(row.currency));
    }
  }
  return [...values].filter(Boolean).sort();
});
const stores = computed(() => {
  const list = cachedStores.value.filter(
    (store) =>
      selectedStoreId.value === "all" || store.storeId === selectedStoreId.value,
  );
  return [...list].sort(compareStores);
});
const failures = computed(() =>
  cachedFailures.value.filter(
    (failure) =>
      selectedStoreId.value === "all" || failure.storeId === selectedStoreId.value,
  ),
);
const aggregate = computed(() =>
  filterDashboardAggregateCurrency(
    aggregateDashboardSnapshots(stores.value, failures.value),
    selectedCurrency.value,
  ),
);
const normalizedSearch = computed(() => debouncedSearch.value.trim().toLowerCase());
const visibleStores = computed(() =>
  stores.value.filter((store) =>
    matchesSearch(store.storeName, store.domain, store.owner, store.email),
  ),
);
const visibleProducts = computed(() =>
  [...aggregate.value.topProducts]
    .filter((product) => matchesSearch(product.title, product.storeName))
    .sort((a, b) => {
      if (productSort.value === "orders") return b.orders - a.orders;
      if (productSort.value === "revenue") {
        return moneyTotal(b.revenue) - moneyTotal(a.revenue);
      }
      return b.units - a.units;
    }),
);
const visiblePendingOrders = computed(() =>
  [...aggregate.value.pendingOrders]
    .filter((order) =>
      matchesSearch(order.name, order.storeName, order.fulfillmentStatus),
    )
    .sort((a, b) => {
      if (queueSort.value === "value") return b.amount - a.amount;
      const difference =
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return queueSort.value === "newest" ? -difference : difference;
    }),
);
const visibleRecentTransactions = computed(() =>
  aggregate.value.recentTransactions
    .filter((transaction) =>
      matchesSearch(
        transaction.orderName,
        transaction.type,
        transaction.storeName,
        transaction.currency,
      ),
    )
    .slice(0, 6),
);
const allUsers = computed(() =>
  stores.value
    .flatMap((store) =>
      store.users.map((user) => ({
        ...user,
        storeId: store.storeId,
        storeName: store.storeName,
      })),
    )
    .filter((user) => matchesSearch(user.name, user.email, user.role, user.storeName))
    .slice(0, 12),
);
const chartPoints = computed(() => {
  const points = aggregate.value.revenue.daily;
  if (chartRange.value === "7d") return points.slice(-7);
  if (chartRange.value === "14d") return points.slice(-14);
  return points;
});
const fulfillmentSegments = computed(() => [
  {
    label: "Fulfilled",
    value: aggregate.value.fulfillmentBreakdown.fulfilled,
  },
  { label: "Partial", value: aggregate.value.fulfillmentBreakdown.partial },
  {
    label: "Unfulfilled",
    value: aggregate.value.fulfillmentBreakdown.unfulfilled,
  },
]);
const warningCount = computed(() =>
  stores.value.reduce((total, store) => total + store.warnings.length, 0),
);
const isFiltered = computed(
  () =>
    selectedStoreId.value !== "all" ||
    selectedCurrency.value !== "all" ||
    storeSort.value !== "revenue-desc" ||
    Boolean(searchQuery.value),
);
const filterDescription = computed(() => {
  const storeLabel =
    selectedStoreId.value === "all"
      ? "All stores"
      : storeOptions.value.find((store) => store.id === selectedStoreId.value)?.label ||
        selectedStoreId.value;
  const currencyLabel =
    selectedCurrency.value === "all" ? "all currencies" : selectedCurrency.value;
  return `${storeLabel}, ${currencyLabel}`;
});

function compareStores(a: StoreDashboardSnapshot, b: StoreDashboardSnapshot) {
  if (storeSort.value === "name-asc") return a.storeName.localeCompare(b.storeName);
  if (storeSort.value === "orders-desc") {
    return b.revenue.orderCountMonth - a.revenue.orderCountMonth;
  }
  if (storeSort.value === "pending-desc") {
    return b.pendingFulfillments.count - a.pendingFulfillments.count;
  }
  if (storeSort.value === "customers-desc") return b.customerCount - a.customerCount;
  return moneyTotal(b.revenue.month) - moneyTotal(a.revenue.month);
}

function matchesSearch(...values: Array<string | null | undefined>) {
  if (!normalizedSearch.value) return true;
  return values.some((value) =>
    String(value || "")
      .toLowerCase()
      .includes(normalizedSearch.value),
  );
}

function moneyTotal(rows: DashboardMoney[]) {
  if (selectedCurrency.value === "all") return rows[0]?.amount || 0;
  return rows.find((row) => row.currency === selectedCurrency.value)?.amount || 0;
}

function primaryMoney(rows: DashboardMoney[]) {
  return rows[0] || null;
}

function primaryAmount(rows: DashboardMoney[]) {
  return primaryMoney(rows)?.amount || 0;
}

function primaryCurrency(rows: DashboardMoney[]) {
  return primaryMoney(rows)?.currency || "";
}

function setChartRange(value: (typeof chartRangeOptions)[number]["value"]) {
  chartRange.value = value;
}

function setProductSort(value: (typeof productSortOptions)[number]["value"]) {
  productSort.value = value;
}

function setQueueSort(value: (typeof queueSortOptions)[number]["value"]) {
  queueSort.value = value;
}

function formatMoney(rows: DashboardMoney[], compact = true) {
  if (!rows.length) return "—";
  const visible = rows.slice(0, 2).map((row) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: row.currency,
      notation: compact ? "compact" : "standard",
      maximumFractionDigits: compact ? 1 : 2,
    }).format(row.amount),
  );
  return `${visible.join(" · ")}${rows.length > 2 ? ` +${rows.length - 2}` : ""}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat(undefined, { notation: "compact" }).format(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatUpdatedAt(value: number | null) {
  return value
    ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";
}

function timeAgo(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "—";
  const hours = Math.max(0, Math.floor((Date.now() - timestamp) / 3_600_000));
  if (hours < 1) return "< 1h";
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "SP"
  );
}

function resetFilters() {
  selectedStoreId.value = "all";
  selectedCurrency.value = "all";
  storeSort.value = "revenue-desc";
  searchQuery.value = "";
  debouncedSearch.value = "";
}

useDebouncedWatch(
  () => searchQuery.value,
  (value) => {
    debouncedSearch.value = value;
  },
  180,
);
onMounted(ensureLoaded);
onActivated(ensureLoaded);
</script>

<template>
  <main class="dashboard-page">
    <section v-if="!isLoading && totalStores === 0" class="dashboard-empty-state">
      <span><LayoutDashboard /></span>
      <h2>Connect a store to activate the dashboard</h2>
      <p>Your all-store metrics will appear here after a Shopify store is added.</p>
      <NuxtLink to="/manager">Open Store Manager</NuxtLink>
    </section>

    <template v-else>
      <DashboardToolbar
        :stores="storeOptions"
        :currencies="currencies"
        :search="searchQuery"
        :store-id="selectedStoreId"
        :currency="selectedCurrency"
        :store-sort="storeSort"
        :is-filtered="isFiltered"
        :is-loading="isLoading"
        :progress="progress"
        @update:search="searchQuery = $event"
        @update:store-id="selectedStoreId = $event"
        @update:currency="selectedCurrency = $event"
        @update:store-sort="storeSort = $event"
        @reset="resetFilters"
      >
        <template #actions>
          <div class="dashboard-toolbar-actions">
            <DashboardExportMenu
              :dashboard="aggregate"
              :filter-description="filterDescription"
            />
            <button
              class="dashboard-refresh"
              type="button"
              :disabled="isLoading"
              :title="
                lastUpdated
                  ? `Cached at ${formatUpdatedAt(lastUpdated)}`
                  : 'Refresh all stores'
              "
              @click="refresh"
            >
              <RefreshCw :class="{ 'is-spinning': isLoading }" />
              {{ isLoading ? `${completedStores}/${totalStores}` : "Refresh" }}
            </button>
          </div>
        </template>
      </DashboardToolbar>

      <section class="dashboard-metric-grid" aria-label="Business overview">
        <DashboardMetricCard
          label="Total stores"
          :detail="`${cachedStores.length} reporting · ${cachedFailures.length} need attention`"
          :loading="isLoading && !cachedStores.length"
          tone="blue"
        >
          <Store />
          <template #value>
            <DashboardAnimatedNumber :value="totalStores" />
          </template>
        </DashboardMetricCard>
        <DashboardMetricCard
          label="Revenue today"
          :detail="`${formatNumber(aggregate.revenue.orderCountToday)} revenue orders`"
          :loading="isLoading && !stores.length"
          tone="green"
        >
          <CircleDollarSign />
          <template #value>
            <DashboardAnimatedNumber
              v-if="primaryMoney(aggregate.revenue.today)"
              :value="primaryAmount(aggregate.revenue.today)"
              :currency="primaryCurrency(aggregate.revenue.today)"
            />
            <span v-else>—</span>
            <small
              v-if="aggregate.revenue.today.length > 1"
              class="metric-currency-more"
            >
              +{{ aggregate.revenue.today.length - 1 }} FX
            </small>
          </template>
        </DashboardMetricCard>
        <DashboardMetricCard
          label="This week"
          :detail="`${formatNumber(aggregate.revenue.orderCountWeek)} orders since Monday`"
          :loading="isLoading && !stores.length"
          tone="blue"
          :delay="55"
        >
          <CalendarDays />
          <template #value>
            <DashboardAnimatedNumber
              v-if="primaryMoney(aggregate.revenue.week)"
              :value="primaryAmount(aggregate.revenue.week)"
              :currency="primaryCurrency(aggregate.revenue.week)"
            />
            <span v-else>—</span>
            <small
              v-if="aggregate.revenue.week.length > 1"
              class="metric-currency-more"
            >
              +{{ aggregate.revenue.week.length - 1 }} FX
            </small>
          </template>
        </DashboardMetricCard>
        <DashboardMetricCard
          label="This month"
          :detail="`${formatNumber(aggregate.revenue.orderCountMonth)} paid or partially paid`"
          :loading="isLoading && !stores.length"
          tone="violet"
          :delay="110"
        >
          <Banknote />
          <template #value>
            <DashboardAnimatedNumber
              v-if="primaryMoney(aggregate.revenue.month)"
              :value="primaryAmount(aggregate.revenue.month)"
              :currency="primaryCurrency(aggregate.revenue.month)"
            />
            <span v-else>—</span>
            <small
              v-if="aggregate.revenue.month.length > 1"
              class="metric-currency-more"
            >
              +{{ aggregate.revenue.month.length - 1 }} FX
            </small>
          </template>
        </DashboardMetricCard>
        <DashboardMetricCard
          label="Pending fulfillment"
          detail="Open unshipped and partial orders"
          :loading="isLoading && !stores.length"
          tone="amber"
          :delay="165"
        >
          <PackageCheck />
          <template #value>
            <DashboardAnimatedNumber :value="aggregate.pendingFulfillmentCount" />
          </template>
        </DashboardMetricCard>
        <DashboardMetricCard
          label="Customers"
          :detail="`${formatNumber(aggregate.productCount)} products across catalogues`"
          :loading="isLoading && !stores.length"
          tone="blue"
          :delay="220"
        >
          <UsersRound />
          <template #value>
            <DashboardAnimatedNumber :value="aggregate.customerCount" />
          </template>
        </DashboardMetricCard>
        <DashboardMetricCard
          label="Payout balance"
          :detail="`${aggregate.payments.availableStores}/${stores.length || totalStores} stores with Payments`"
          :loading="isLoading && !stores.length"
          tone="green"
          :delay="275"
        >
          <WalletCards />
          <template #value>
            <DashboardAnimatedNumber
              v-if="primaryMoney(aggregate.payments.balance)"
              :value="primaryAmount(aggregate.payments.balance)"
              :currency="primaryCurrency(aggregate.payments.balance)"
            />
            <span v-else>—</span>
            <small
              v-if="aggregate.payments.balance.length > 1"
              class="metric-currency-more"
            >
              +{{ aggregate.payments.balance.length - 1 }} FX
            </small>
          </template>
        </DashboardMetricCard>
        <DashboardMetricCard
          label="Users & staff"
          :detail="`${stores.length} stores reporting access data`"
          :loading="isLoading && !stores.length"
          tone="violet"
          :delay="330"
        >
          <UserRoundCog />
          <template #value>
            <DashboardAnimatedNumber :value="aggregate.userCount" />
          </template>
        </DashboardMetricCard>
      </section>

      <section v-if="failures.length || warningCount" class="dashboard-health-strip">
        <div>
          <strong>{{
            failures.length
              ? `${failures.length} store issue${failures.length === 1 ? "" : "s"}`
              : "Partial access"
          }}</strong>
          <span>
            {{ warningCount }} restricted resource{{ warningCount === 1 ? "" : "s" }}.
            Other dashboard data remains available.
          </span>
        </div>
        <NuxtLink to="/manager">Review stores</NuxtLink>
      </section>

      <section class="dashboard-chart-grid">
        <article class="dashboard-panel dashboard-revenue-panel">
          <header class="dashboard-panel-header">
            <div>
              <h2><CircleDollarSign /> Daily revenue</h2>
            </div>
            <div class="dashboard-segmented-control" aria-label="Revenue chart range">
              <button
                v-for="option in chartRangeOptions"
                :key="option.value"
                type="button"
                :class="{ active: chartRange === option.value }"
                @click="setChartRange(option.value)"
              >
                {{ option.label }}
              </button>
            </div>
          </header>
          <DashboardRevenueChart :points="chartPoints" />
        </article>

        <article class="dashboard-panel dashboard-flow-panel">
          <header class="dashboard-panel-header">
            <div>
              <h2><PackageCheck /> Fulfillment mix</h2>
            </div>
          </header>
          <DashboardDonutChart :segments="fulfillmentSegments" />
        </article>
      </section>

      <section class="dashboard-detail-grid">
        <article class="dashboard-panel">
          <header class="dashboard-panel-header">
            <div>
              <h2><ShoppingBag /> Top products</h2>
            </div>
            <div class="dashboard-segmented-control" aria-label="Product ranking">
              <button
                v-for="option in productSortOptions"
                :key="option.value"
                type="button"
                :class="{ active: productSort === option.value }"
                @click="setProductSort(option.value)"
              >
                {{ option.label }}
              </button>
            </div>
          </header>
          <DashboardTopProducts :products="visibleProducts" :metric="productSort" />
        </article>

        <article class="dashboard-panel">
          <header class="dashboard-panel-header">
            <div>
              <h2><WalletCards /> Payments pulse</h2>
            </div>
            <NuxtLink to="/store?tab=transactions">Explore →</NuxtLink>
          </header>
          <div class="payment-pulse-grid">
            <div>
              <span>Month gross</span>
              <strong>{{ formatMoney(aggregate.payments.transactions.gross) }}</strong>
            </div>
            <div>
              <span>Fees</span>
              <strong>{{ formatMoney(aggregate.payments.transactions.fees) }}</strong>
            </div>
            <div>
              <span>Net</span>
              <strong>{{ formatMoney(aggregate.payments.transactions.net) }}</strong>
            </div>
            <div>
              <span>Pending payouts</span>
              <strong>{{ aggregate.payments.payouts.pendingCount }}</strong>
            </div>
          </div>
          <div v-if="visibleRecentTransactions.length" class="dashboard-mini-list">
            <NuxtLink
              v-for="transaction in visibleRecentTransactions"
              :key="`${transaction.storeId}:${transaction.id}`"
              :to="{
                path: '/store',
                query: { shop: transaction.storeId, tab: 'transactions' },
              }"
            >
              <span class="transaction-type-icon"><Banknote /></span>
              <span>
                <strong>{{ transaction.orderName || transaction.type }}</strong>
                <small
                  >{{ transaction.storeName }} ·
                  {{ formatDate(transaction.processedAt) }}</small
                >
              </span>
              <b>{{
                formatMoney([
                  { currency: transaction.currency, amount: transaction.net },
                ])
              }}</b>
            </NuxtLink>
          </div>
          <div v-else class="dashboard-list-placeholder">
            No payment transactions this month.
          </div>
        </article>
      </section>

      <section class="dashboard-panel dashboard-table-panel">
        <header class="dashboard-panel-header">
          <div>
            <h2><PackageCheck /> Pending fulfillments</h2>
          </div>
          <div class="dashboard-segmented-control" aria-label="Fulfillment sorting">
            <button
              v-for="option in queueSortOptions"
              :key="option.value"
              type="button"
              :class="{ active: queueSort === option.value }"
              @click="setQueueSort(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
        </header>
        <div v-if="visiblePendingOrders.length" class="dashboard-table-scroll">
          <table class="dashboard-data-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Store</th>
                <th>Waiting</th>
                <th>Status</th>
                <th class="numeric">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="order in visiblePendingOrders"
                :key="`${order.storeId}:${order.id}`"
              >
                <td>
                  <NuxtLink
                    :to="{ path: `/order/${order.id}`, query: { shop: order.storeId } }"
                  >
                    {{ order.name }}
                  </NuxtLink>
                </td>
                <td>{{ order.storeName }}</td>
                <td>{{ timeAgo(order.createdAt) }}</td>
                <td>
                  <span class="dashboard-status-pill">{{
                    order.fulfillmentStatus
                  }}</span>
                </td>
                <td class="numeric">
                  {{
                    formatMoney(
                      [{ currency: order.currency, amount: order.amount }],
                      false,
                    )
                  }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="dashboard-list-placeholder">Fulfillment queue is clear.</div>
      </section>

      <section class="dashboard-bottom-grid">
        <article class="dashboard-panel">
          <header class="dashboard-panel-header">
            <div>
              <h2><Store /> Portfolio performance</h2>
            </div>
            <span>{{ visibleStores.length }} visible</span>
          </header>
          <div class="store-performance-list">
            <NuxtLink
              v-for="store in visibleStores"
              :key="store.storeId"
              :to="{ path: '/store', query: { shop: store.storeId } }"
              class="store-performance-row"
            >
              <span class="store-avatar">{{ initials(store.storeName) }}</span>
              <span class="store-performance-name">
                <strong>{{ store.storeName }}</strong>
                <small>{{ store.domain }}</small>
              </span>
              <span>
                <strong>{{ formatMoney(store.revenue.month) }}</strong>
                <small>{{ store.revenue.orderCountMonth }} month orders</small>
              </span>
              <span>
                <strong>{{ store.pendingFulfillments.count }}</strong>
                <small>pending</small>
              </span>
              <span
                class="store-health-dot"
                :class="{ 'has-warning': store.warnings.length }"
                :title="store.warnings.map((warning) => warning.message).join(' ')"
              />
            </NuxtLink>
            <div
              v-for="failure in failures"
              :key="failure.storeId"
              class="store-performance-row is-failed"
            >
              <span class="store-avatar">{{ initials(failure.label) }}</span>
              <span class="store-performance-name">
                <strong>{{ failure.label }}</strong>
                <small>{{ failure.message }}</small>
              </span>
              <NuxtLink :to="{ path: '/manager', query: { edit: failure.storeId } }"
                >Fix access</NuxtLink
              >
            </div>
          </div>
        </article>

        <article class="dashboard-panel">
          <header class="dashboard-panel-header">
            <div>
              <h2><UserRoundCog /> Store users</h2>
            </div>
            <span>{{ aggregate.userCount }} known</span>
          </header>
          <div v-if="allUsers.length" class="dashboard-user-grid">
            <NuxtLink
              v-for="user in allUsers"
              :key="`${user.storeId}:${user.id}`"
              :to="{ path: '/store', query: { shop: user.storeId, tab: 'profile' } }"
              class="dashboard-user"
            >
              <span>{{ initials(user.name) }}</span>
              <div>
                <strong>{{ user.name }}</strong>
                <small>{{ user.role }} · {{ user.storeName }}</small>
              </div>
              <UserRoundCog />
            </NuxtLink>
          </div>
          <div v-else class="dashboard-list-placeholder">
            User information is restricted.
          </div>
        </article>
      </section>

      <footer class="dashboard-footnote">
        <ShoppingBag /> Revenue includes paid, partially paid and partially refunded
        orders. Each currency remains separate.
      </footer>
    </template>
  </main>
</template>

<style src="~/assets/styles/pages/dashboard.css"></style>
