<script setup lang="ts">
import {
  Activity,
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
import type { DashboardMoney } from "~~/types/dashboard";

definePageMeta({ layout: false });
useHead({ title: "Dashboard · Spfi" });

const {
  aggregate,
  stores,
  failures,
  isLoading,
  completedStores,
  totalStores,
  progress,
  lastUpdated,
  refresh,
} = useDashboard();

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
const allUsers = computed(() =>
  stores.value
    .flatMap((store) =>
      store.users.map((user) => ({
        ...user,
        storeId: store.storeId,
        storeName: store.storeName,
      })),
    )
    .slice(0, 12),
);

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

onMounted(refresh);
</script>

<template>
  <main class="dashboard-page">
    <section class="dashboard-hero">
      <div class="dashboard-hero-copy">
        <div class="dashboard-eyebrow">
          <span class="dashboard-live-dot" />
          All-store intelligence
        </div>
        <h1>One pulse for every store.</h1>
        <p>
          Revenue, fulfillment, customers, products, payouts and people — aligned in
          your local timezone without mixing currencies.
        </p>
        <div class="dashboard-hero-meta">
          <span><Store /> {{ totalStores }} connected</span>
          <span><Activity /> {{ stores.length }} reporting</span>
          <span v-if="lastUpdated">
            Updated
            {{
              lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            }}
          </span>
        </div>
      </div>
      <div class="dashboard-hero-actions">
        <span class="currency-safe-badge">Multi-currency safe</span>
        <button
          class="dashboard-refresh"
          type="button"
          :disabled="isLoading"
          @click="refresh"
        >
          <RefreshCw :class="{ 'is-spinning': isLoading }" />
          {{ isLoading ? `${completedStores}/${totalStores}` : "Refresh all" }}
        </button>
      </div>
      <div v-if="isLoading" class="dashboard-progress" aria-live="polite">
        <i :style="{ width: `${progress}%` }" />
      </div>
      <div class="hero-orbit hero-orbit-one" aria-hidden="true" />
      <div class="hero-orbit hero-orbit-two" aria-hidden="true" />
    </section>

    <section v-if="!isLoading && totalStores === 0" class="dashboard-empty-state">
      <span><LayoutDashboard /></span>
      <h2>Connect a store to activate the dashboard</h2>
      <p>Your all-store metrics will appear here after a Shopify store is added.</p>
      <NuxtLink to="/manager">Open Store Manager</NuxtLink>
    </section>

    <template v-else>
      <section class="dashboard-metric-grid" aria-label="Business overview">
        <DashboardMetricCard
          label="Revenue today"
          :value="formatMoney(aggregate.revenue.today)"
          :detail="`${formatNumber(aggregate.revenue.orderCountToday)} revenue orders`"
          :loading="isLoading && !stores.length"
          tone="green"
        >
          <CircleDollarSign />
        </DashboardMetricCard>
        <DashboardMetricCard
          label="This week"
          :value="formatMoney(aggregate.revenue.week)"
          :detail="`${formatNumber(aggregate.revenue.orderCountWeek)} orders since Monday`"
          :loading="isLoading && !stores.length"
          tone="blue"
          :delay="55"
        >
          <CalendarDays />
        </DashboardMetricCard>
        <DashboardMetricCard
          label="This month"
          :value="formatMoney(aggregate.revenue.month)"
          :detail="`${formatNumber(aggregate.revenue.orderCountMonth)} paid or partially paid`"
          :loading="isLoading && !stores.length"
          tone="violet"
          :delay="110"
        >
          <Banknote />
        </DashboardMetricCard>
        <DashboardMetricCard
          label="Pending fulfillment"
          :value="formatNumber(aggregate.pendingFulfillmentCount)"
          detail="Open unshipped and partial orders"
          :loading="isLoading && !stores.length"
          tone="amber"
          :delay="165"
        >
          <PackageCheck />
        </DashboardMetricCard>
        <DashboardMetricCard
          label="Customers"
          :value="formatNumber(aggregate.customerCount)"
          :detail="`${formatNumber(aggregate.productCount)} products across catalogues`"
          :loading="isLoading && !stores.length"
          tone="blue"
          :delay="220"
        >
          <UsersRound />
        </DashboardMetricCard>
        <DashboardMetricCard
          label="Payout balance"
          :value="formatMoney(aggregate.payments.balance)"
          :detail="`${aggregate.payments.availableStores}/${stores.length || totalStores} stores with Payments`"
          :loading="isLoading && !stores.length"
          tone="green"
          :delay="275"
        >
          <WalletCards />
        </DashboardMetricCard>
        <DashboardMetricCard
          label="Users & staff"
          :value="formatNumber(aggregate.userCount)"
          :detail="`${stores.length} stores reporting access data`"
          :loading="isLoading && !stores.length"
          tone="violet"
          :delay="330"
        >
          <UserRoundCog />
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
              <span class="panel-kicker">Revenue velocity</span>
              <h2>Daily revenue this month</h2>
            </div>
            <span>{{ aggregate.revenue.daily.length }} days</span>
          </header>
          <DashboardRevenueChart :points="aggregate.revenue.daily" />
        </article>

        <article class="dashboard-panel dashboard-flow-panel">
          <header class="dashboard-panel-header">
            <div>
              <span class="panel-kicker">Order flow</span>
              <h2>Fulfillment mix</h2>
            </div>
          </header>
          <DashboardDonutChart :segments="fulfillmentSegments" />
        </article>
      </section>

      <section class="dashboard-detail-grid">
        <article class="dashboard-panel">
          <header class="dashboard-panel-header">
            <div>
              <span class="panel-kicker">Demand signals</span>
              <h2>Top products</h2>
            </div>
            <span>Ranked by units</span>
          </header>
          <DashboardTopProducts :products="aggregate.topProducts" />
        </article>

        <article class="dashboard-panel">
          <header class="dashboard-panel-header">
            <div>
              <span class="panel-kicker">Settlements</span>
              <h2>Payments pulse</h2>
            </div>
            <NuxtLink to="/store?tab=transactions">Explore</NuxtLink>
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
          <div v-if="aggregate.recentTransactions.length" class="dashboard-mini-list">
            <NuxtLink
              v-for="transaction in aggregate.recentTransactions.slice(0, 6)"
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
            <span class="panel-kicker">Operations queue</span>
            <h2>Oldest pending fulfillments</h2>
          </div>
          <span>{{ aggregate.pendingFulfillmentCount }} total</span>
        </header>
        <div v-if="aggregate.pendingOrders.length" class="dashboard-table-scroll">
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
                v-for="order in aggregate.pendingOrders"
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
              <span class="panel-kicker">Store comparison</span>
              <h2>Portfolio performance</h2>
            </div>
            <span>{{ stores.length }} live</span>
          </header>
          <div class="store-performance-list">
            <NuxtLink
              v-for="store in stores"
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
              <span class="panel-kicker">People & access</span>
              <h2>Store users</h2>
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
