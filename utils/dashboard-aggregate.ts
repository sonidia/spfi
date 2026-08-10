import type {
  DashboardAggregate,
  DashboardMoney,
  DashboardPayoutSummary,
  DashboardRevenuePoint,
  DashboardRevenueSummary,
  DashboardStoreFailure,
  DashboardTransactionSummary,
  StoreDashboardSnapshot,
} from "~~/types/dashboard";

export function aggregateDashboardSnapshots(
  stores: StoreDashboardSnapshot[],
  failures: DashboardStoreFailure[] = [],
): DashboardAggregate {
  const today = new Map<string, number>();
  const week = new Map<string, number>();
  const month = new Map<string, number>();
  const balance = new Map<string, number>();
  const payoutTotal = new Map<string, number>();
  const payoutPending = new Map<string, number>();
  const transactionGross = new Map<string, number>();
  const transactionFees = new Map<string, number>();
  const transactionNet = new Map<string, number>();
  const daily = new Map<string, { orders: number; money: Map<string, number> }>();
  let orderCountToday = 0;
  let orderCountWeek = 0;
  let orderCountMonth = 0;
  let customerCount = 0;
  let productCount = 0;
  let userCount = 0;
  let pendingFulfillmentCount = 0;
  let availableStores = 0;
  const fulfillmentBreakdown = {
    fulfilled: 0,
    partial: 0,
    unfulfilled: 0,
  };
  const payouts: DashboardPayoutSummary = {
    count: 0,
    pendingCount: 0,
    paidCount: 0,
    failedCount: 0,
    total: [],
    pending: [],
  };
  const transactions: DashboardTransactionSummary = {
    count: 0,
    gross: [],
    fees: [],
    net: [],
    recent: [],
  };

  for (const store of stores) {
    addMoneyRows(today, store.revenue.today);
    addMoneyRows(week, store.revenue.week);
    addMoneyRows(month, store.revenue.month);
    orderCountToday += store.revenue.orderCountToday;
    orderCountWeek += store.revenue.orderCountWeek;
    orderCountMonth += store.revenue.orderCountMonth;
    customerCount += store.customerCount;
    productCount += store.productCount;
    userCount += store.users.length;
    pendingFulfillmentCount += store.pendingFulfillments.count;
    fulfillmentBreakdown.fulfilled += store.fulfillmentBreakdown.fulfilled;
    fulfillmentBreakdown.partial += store.fulfillmentBreakdown.partial;
    fulfillmentBreakdown.unfulfilled += store.fulfillmentBreakdown.unfulfilled;

    for (const point of store.revenue.daily) {
      const entry = daily.get(point.date) || {
        orders: 0,
        money: new Map<string, number>(),
      };
      entry.orders += point.orders;
      addMoneyRows(entry.money, point.values);
      daily.set(point.date, entry);
    }

    if (store.payments.available) availableStores += 1;
    addMoneyRows(balance, store.payments.balance);
    payouts.count += store.payments.payouts.count;
    payouts.pendingCount += store.payments.payouts.pendingCount;
    payouts.paidCount += store.payments.payouts.paidCount;
    payouts.failedCount += store.payments.payouts.failedCount;
    addMoneyRows(payoutTotal, store.payments.payouts.total);
    addMoneyRows(payoutPending, store.payments.payouts.pending);
    transactions.count += store.payments.transactions.count;
    addMoneyRows(transactionGross, store.payments.transactions.gross);
    addMoneyRows(transactionFees, store.payments.transactions.fees);
    addMoneyRows(transactionNet, store.payments.transactions.net);
  }

  const revenue: DashboardRevenueSummary = {
    today: moneyRows(today),
    week: moneyRows(week),
    month: moneyRows(month),
    orderCountToday,
    orderCountWeek,
    orderCountMonth,
    daily: [...daily.entries()]
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, entry]): DashboardRevenuePoint => ({
        date,
        orders: entry.orders,
        values: moneyRows(entry.money),
      })),
  };

  return {
    stores,
    failures,
    revenue,
    topProducts: stores
      .flatMap((store) =>
        store.topProducts.map((product) => ({
          ...product,
          key: `${store.storeId}:${product.key}`,
          storeId: store.storeId,
          storeName: store.storeName,
        })),
      )
      .sort((a, b) => b.units - a.units || b.orders - a.orders)
      .slice(0, 10),
    pendingOrders: stores
      .flatMap((store) =>
        store.pendingFulfillments.orders.map((order) => ({
          ...order,
          storeId: store.storeId,
          storeName: store.storeName,
        })),
      )
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(0, 12),
    recentTransactions: stores
      .flatMap((store) =>
        store.payments.transactions.recent.map((transaction) => ({
          ...transaction,
          storeId: store.storeId,
          storeName: store.storeName,
        })),
      )
      .sort(
        (a, b) => new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime(),
      )
      .slice(0, 12),
    customerCount,
    productCount,
    userCount,
    pendingFulfillmentCount,
    fulfillmentBreakdown,
    payments: {
      availableStores,
      balance: moneyRows(balance),
      payouts: {
        ...payouts,
        total: moneyRows(payoutTotal),
        pending: moneyRows(payoutPending),
      },
      transactions: {
        ...transactions,
        gross: moneyRows(transactionGross),
        fees: moneyRows(transactionFees),
        net: moneyRows(transactionNet),
        recent: [],
      },
    },
  };
}

export function filterDashboardAggregateCurrency(
  dashboard: DashboardAggregate,
  currency: string,
): DashboardAggregate {
  if (!currency || currency === "all") return dashboard;
  const filterMoney = (rows: DashboardMoney[]) =>
    rows.filter((row) => row.currency === currency);

  return {
    ...dashboard,
    stores: dashboard.stores.map((store) => ({
      ...store,
      revenue: {
        ...store.revenue,
        today: filterMoney(store.revenue.today),
        week: filterMoney(store.revenue.week),
        month: filterMoney(store.revenue.month),
        daily: store.revenue.daily.map((point) => ({
          ...point,
          values: filterMoney(point.values),
        })),
      },
      topProducts: store.topProducts.map((product) => ({
        ...product,
        revenue: filterMoney(product.revenue),
      })),
      payments: {
        ...store.payments,
        balance: filterMoney(store.payments.balance),
        payouts: {
          ...store.payments.payouts,
          total: filterMoney(store.payments.payouts.total),
          pending: filterMoney(store.payments.payouts.pending),
        },
        transactions: {
          ...store.payments.transactions,
          gross: filterMoney(store.payments.transactions.gross),
          fees: filterMoney(store.payments.transactions.fees),
          net: filterMoney(store.payments.transactions.net),
          recent: store.payments.transactions.recent.filter(
            (transaction) => transaction.currency === currency,
          ),
        },
      },
    })),
    revenue: {
      ...dashboard.revenue,
      today: filterMoney(dashboard.revenue.today),
      week: filterMoney(dashboard.revenue.week),
      month: filterMoney(dashboard.revenue.month),
      daily: dashboard.revenue.daily.map((point) => ({
        ...point,
        values: filterMoney(point.values),
      })),
    },
    topProducts: dashboard.topProducts.map((product) => ({
      ...product,
      revenue: filterMoney(product.revenue),
    })),
    recentTransactions: dashboard.recentTransactions.filter(
      (transaction) => transaction.currency === currency,
    ),
    payments: {
      ...dashboard.payments,
      balance: filterMoney(dashboard.payments.balance),
      payouts: {
        ...dashboard.payments.payouts,
        total: filterMoney(dashboard.payments.payouts.total),
        pending: filterMoney(dashboard.payments.payouts.pending),
      },
      transactions: {
        ...dashboard.payments.transactions,
        gross: filterMoney(dashboard.payments.transactions.gross),
        fees: filterMoney(dashboard.payments.transactions.fees),
        net: filterMoney(dashboard.payments.transactions.net),
      },
    },
  };
}

function addMoneyRows(target: Map<string, number>, rows: DashboardMoney[]) {
  for (const row of rows) {
    target.set(row.currency, (target.get(row.currency) || 0) + row.amount);
  }
}

function moneyRows(source: Map<string, number>): DashboardMoney[] {
  return [...source.entries()]
    .map(([currency, amount]) => ({
      currency,
      amount: Math.round((amount + Number.EPSILON) * 100) / 100,
    }))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
}
