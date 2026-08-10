import type {
  DashboardFulfillmentBreakdown,
  DashboardMoney,
  DashboardPendingOrder,
  DashboardPayoutSummary,
  DashboardRevenueSummary,
  DashboardTopProduct,
  DashboardTransactionSummary,
  DashboardUser,
} from "~~/types/dashboard";
import type {
  ShopifyBalance,
  ShopifyBalanceTransaction,
  ShopifyOrder,
  ShopifyPayout,
  ShopifyShop,
} from "~~/types/shopify";

export interface DashboardPeriod {
  timezoneOffsetMinutes: number;
  nowIso: string;
  todayStartIso: string;
  weekStartIso: string;
  monthStartIso: string;
  monthStartKey: string;
  todayKey: string;
  monthEndKey: string;
}

interface ShopifyDashboardUserRecord {
  id?: string | number;
  first_name?: string;
  last_name?: string;
  email?: string;
  account_owner?: boolean;
  permissions?: string[];
  user_type?: string;
}

const REVENUE_FINANCIAL_STATUSES = new Set([
  "paid",
  "partially_paid",
  "partially_refunded",
]);
const PENDING_PAYOUT_STATUSES = new Set(["scheduled", "in_transit"]);

export function createDashboardPeriod(
  now = new Date(),
  timezoneOffsetMinutes = 0,
): DashboardPeriod {
  const safeOffset = Number.isFinite(timezoneOffsetMinutes)
    ? Math.min(840, Math.max(-840, Math.trunc(timezoneOffsetMinutes)))
    : 0;
  const shifted = new Date(now.getTime() - safeOffset * 60_000);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  const day = shifted.getUTCDate();
  const weekday = shifted.getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;

  const toUtcIso = (localWallTime: number) =>
    new Date(localWallTime + safeOffset * 60_000).toISOString();
  const todayWallTime = Date.UTC(year, month, day);
  const monthStartWallTime = Date.UTC(year, month, 1);

  return {
    timezoneOffsetMinutes: safeOffset,
    nowIso: now.toISOString(),
    todayStartIso: toUtcIso(todayWallTime),
    weekStartIso: toUtcIso(todayWallTime - daysSinceMonday * 86_400_000),
    monthStartIso: toUtcIso(monthStartWallTime),
    monthStartKey: `${year}-${String(month + 1).padStart(2, "0")}-01`,
    todayKey: localDateKey(now, safeOffset),
    monthEndKey: localDateKey(now, safeOffset),
  };
}

export function aggregateOrderAnalytics(
  orders: ShopifyOrder[],
  period: DashboardPeriod,
): {
  revenue: DashboardRevenueSummary;
  topProducts: DashboardTopProduct[];
  fulfillmentBreakdown: DashboardFulfillmentBreakdown;
} {
  const today = new Map<string, number>();
  const week = new Map<string, number>();
  const month = new Map<string, number>();
  const daily = new Map<string, { orders: number; money: Map<string, number> }>();
  const products = new Map<
    string,
    DashboardTopProduct & { orderIds: Set<string>; money: Map<string, number> }
  >();
  const fulfillmentBreakdown: DashboardFulfillmentBreakdown = {
    fulfilled: 0,
    partial: 0,
    unfulfilled: 0,
  };
  let orderCountToday = 0;
  let orderCountWeek = 0;
  let orderCountMonth = 0;

  for (const order of orders) {
    const createdAt = new Date(order.created_at);
    if (Number.isNaN(createdAt.getTime())) continue;

    if (!order.cancelled_at) {
      const fulfillmentStatus = String(order.fulfillment_status || "unfulfilled");
      if (fulfillmentStatus === "fulfilled") fulfillmentBreakdown.fulfilled += 1;
      else if (fulfillmentStatus === "partial") fulfillmentBreakdown.partial += 1;
      else fulfillmentBreakdown.unfulfilled += 1;
    }

    if (!isRevenueOrder(order)) continue;
    const amount = finiteAmount(order.current_total_price ?? order.total_price);
    const currency = normalizeCurrency(order.currency);
    const createdIso = createdAt.toISOString();
    const dateKey = localDateKey(createdAt, period.timezoneOffsetMinutes);
    const dayEntry = daily.get(dateKey) || {
      orders: 0,
      money: new Map<string, number>(),
    };
    dayEntry.orders += 1;
    addMoney(dayEntry.money, currency, amount);
    daily.set(dateKey, dayEntry);

    orderCountMonth += 1;
    addMoney(month, currency, amount);
    if (createdIso >= period.weekStartIso) {
      orderCountWeek += 1;
      addMoney(week, currency, amount);
    }
    if (createdIso >= period.todayStartIso) {
      orderCountToday += 1;
      addMoney(today, currency, amount);
    }

    for (const item of order.line_items || []) {
      const productId = item.product_id ? String(item.product_id) : null;
      const title = String(item.title || item.name || "Untitled product").trim();
      const key = productId || `title:${title.toLowerCase()}`;
      const quantity = Math.max(0, Math.trunc(Number(item.quantity) || 0));
      const entry = products.get(key) || {
        key,
        productId,
        title,
        units: 0,
        orders: 0,
        revenue: [],
        orderIds: new Set<string>(),
        money: new Map<string, number>(),
      };
      entry.units += quantity;
      entry.orderIds.add(String(order.id));
      addMoney(entry.money, currency, finiteAmount(item.price) * quantity);
      products.set(key, entry);
    }
  }

  const dailyPoints = dateKeysBetween(
    period.monthStartIso,
    period.monthEndKey,
    period.timezoneOffsetMinutes,
  ).map((date) => {
    const entry = daily.get(date);
    return {
      date,
      orders: entry?.orders || 0,
      values: moneyFromMap(entry?.money),
    };
  });

  return {
    revenue: {
      today: moneyFromMap(today),
      week: moneyFromMap(week),
      month: moneyFromMap(month),
      orderCountToday,
      orderCountWeek,
      orderCountMonth,
      daily: dailyPoints,
    },
    topProducts: [...products.values()]
      .sort((a, b) => b.units - a.units || b.orders - a.orders)
      .slice(0, 10)
      .map(({ orderIds, money, ...product }) => ({
        ...product,
        orders: orderIds.size,
        revenue: moneyFromMap(money),
      })),
    fulfillmentBreakdown,
  };
}

export function mapPendingOrders(orders: ShopifyOrder[]): DashboardPendingOrder[] {
  return orders.slice(0, 12).map((order) => ({
    id: String(order.id),
    name: String(order.name || `#${order.order_number || order.id}`),
    createdAt: order.created_at,
    fulfillmentStatus: String(order.fulfillment_status || "unfulfilled"),
    amount: finiteAmount(order.current_total_price ?? order.total_price),
    currency: normalizeCurrency(order.currency),
  }));
}

export function aggregatePaymentAnalytics(
  balance: ShopifyBalance | ShopifyBalance[] | null | undefined,
  payouts: ShopifyPayout[],
  transactions: ShopifyBalanceTransaction[],
): {
  balance: DashboardMoney[];
  payouts: DashboardPayoutSummary;
  transactions: DashboardTransactionSummary;
} {
  const payoutTotal = new Map<string, number>();
  const payoutPending = new Map<string, number>();
  let pendingCount = 0;
  let paidCount = 0;
  let failedCount = 0;

  for (const payout of payouts) {
    const status = String(payout.status || "").toLowerCase();
    const currency = normalizeCurrency(payout.currency);
    const amount = finiteAmount(payout.amount);
    addMoney(payoutTotal, currency, amount);
    if (PENDING_PAYOUT_STATUSES.has(status)) {
      pendingCount += 1;
      addMoney(payoutPending, currency, amount);
    } else if (status === "paid") paidCount += 1;
    else if (status === "failed" || status === "canceled") failedCount += 1;
  }

  const gross = new Map<string, number>();
  const fees = new Map<string, number>();
  const net = new Map<string, number>();
  const realTransactions = transactions
    .filter((transaction) => !transaction.test && transaction.type !== "payout")
    .sort(
      (a, b) => new Date(b.processed_at).getTime() - new Date(a.processed_at).getTime(),
    );

  for (const transaction of realTransactions) {
    const currency = normalizeCurrency(transaction.currency);
    addMoney(gross, currency, finiteAmount(transaction.amount));
    addMoney(fees, currency, finiteAmount(transaction.fee));
    addMoney(net, currency, finiteAmount(transaction.net));
  }

  const balanceRows = Array.isArray(balance) ? balance : balance ? [balance] : [];

  return {
    balance: balanceRows.map((row) => ({
      currency: normalizeCurrency(row.currency),
      amount: finiteAmount(row.amount),
    })),
    payouts: {
      count: payouts.length,
      pendingCount,
      paidCount,
      failedCount,
      total: moneyFromMap(payoutTotal),
      pending: moneyFromMap(payoutPending),
    },
    transactions: {
      count: realTransactions.length,
      gross: moneyFromMap(gross),
      fees: moneyFromMap(fees),
      net: moneyFromMap(net),
      recent: realTransactions.slice(0, 8).map((transaction) => ({
        id: String(transaction.id),
        type: String(transaction.type || "transaction"),
        processedAt: transaction.processed_at,
        amount: finiteAmount(transaction.amount),
        fee: finiteAmount(transaction.fee),
        net: finiteAmount(transaction.net),
        currency: normalizeCurrency(transaction.currency),
        orderName: transaction.source_order_name || null,
      })),
    },
  };
}

export function mapDashboardUsers(
  users: ShopifyDashboardUserRecord[],
  shop: ShopifyShop | null,
): DashboardUser[] {
  const mapped = users.map((user) => {
    const name = [user.first_name, user.last_name].filter(Boolean).join(" ");
    return {
      id: String(user.id || user.email || name || "staff"),
      name: name || String(user.email || "Shop staff"),
      email: String(user.email || ""),
      role: user.account_owner
        ? "Store owner"
        : String(user.user_type || "Staff member"),
      accountOwner: Boolean(user.account_owner),
    };
  });

  if (mapped.length) {
    return mapped.sort((a, b) => Number(b.accountOwner) - Number(a.accountOwner));
  }
  if (!shop) return [];

  return [
    {
      id: String(shop.id || shop.email || "owner"),
      name: String(shop.shop_owner || shop.name || "Store owner"),
      email: String(shop.email || shop.customer_email || ""),
      role: "Store owner",
      accountOwner: true,
    },
  ];
}

export function emptyRevenueSummary(): DashboardRevenueSummary {
  return {
    today: [],
    week: [],
    month: [],
    orderCountToday: 0,
    orderCountWeek: 0,
    orderCountMonth: 0,
    daily: [],
  };
}

export function emptyPayoutSummary(): DashboardPayoutSummary {
  return {
    count: 0,
    pendingCount: 0,
    paidCount: 0,
    failedCount: 0,
    total: [],
    pending: [],
  };
}

export function emptyTransactionSummary(): DashboardTransactionSummary {
  return { count: 0, gross: [], fees: [], net: [], recent: [] };
}

function isRevenueOrder(order: ShopifyOrder) {
  return (
    !order.cancelled_at &&
    !order.test &&
    REVENUE_FINANCIAL_STATUSES.has(String(order.financial_status || "").toLowerCase())
  );
}

function localDateKey(date: Date, timezoneOffsetMinutes: number) {
  return new Date(date.getTime() - timezoneOffsetMinutes * 60_000)
    .toISOString()
    .slice(0, 10);
}

function dateKeysBetween(
  monthStartIso: string,
  endKey: string,
  timezoneOffsetMinutes: number,
) {
  const keys: string[] = [];
  let cursor = new Date(monthStartIso);

  while (keys.length < 32) {
    const key = localDateKey(cursor, timezoneOffsetMinutes);
    if (key > endKey) break;
    keys.push(key);
    cursor = new Date(cursor.getTime() + 86_400_000);
  }
  return keys;
}

function normalizeCurrency(currency: unknown) {
  return (
    String(currency || "USD")
      .trim()
      .toUpperCase() || "USD"
  );
}

function finiteAmount(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function addMoney(target: Map<string, number>, currency: string, amount: number) {
  target.set(currency, (target.get(currency) || 0) + amount);
}

function moneyFromMap(source?: Map<string, number>): DashboardMoney[] {
  if (!source) return [];
  return [...source.entries()]
    .map(([currency, amount]) => ({ currency, amount: roundMoney(amount) }))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
