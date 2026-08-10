export interface DashboardMoney {
  currency: string;
  amount: number;
}

export interface DashboardRevenuePoint {
  date: string;
  orders: number;
  values: DashboardMoney[];
}

export interface DashboardRevenueSummary {
  today: DashboardMoney[];
  week: DashboardMoney[];
  month: DashboardMoney[];
  orderCountToday: number;
  orderCountWeek: number;
  orderCountMonth: number;
  daily: DashboardRevenuePoint[];
}

export interface DashboardTopProduct {
  key: string;
  productId: string | null;
  title: string;
  units: number;
  orders: number;
  revenue: DashboardMoney[];
}

export interface DashboardFulfillmentBreakdown {
  fulfilled: number;
  partial: number;
  unfulfilled: number;
}

export interface DashboardPendingOrder {
  id: string;
  name: string;
  createdAt: string;
  fulfillmentStatus: string;
  amount: number;
  currency: string;
}

export interface DashboardPayoutSummary {
  count: number;
  pendingCount: number;
  paidCount: number;
  failedCount: number;
  total: DashboardMoney[];
  pending: DashboardMoney[];
}

export interface DashboardTransactionSummary {
  count: number;
  gross: DashboardMoney[];
  fees: DashboardMoney[];
  net: DashboardMoney[];
  recent: DashboardRecentTransaction[];
}

export interface DashboardRecentTransaction {
  id: string;
  type: string;
  processedAt: string;
  amount: number;
  fee: number;
  net: number;
  currency: string;
  orderName: string | null;
}

export interface DashboardUser {
  id: string;
  name: string;
  email: string;
  role: string;
  accountOwner: boolean;
}

export interface DashboardWarning {
  resource:
    | "orders"
    | "fulfillments"
    | "customers"
    | "products"
    | "payments"
    | "profile"
    | "users";
  message: string;
}

export interface StoreDashboardSnapshot {
  storeId: string;
  storeName: string;
  domain: string;
  currency: string;
  owner: string;
  email: string;
  plan: string;
  generatedAt: string;
  revenue: DashboardRevenueSummary;
  fulfillmentBreakdown: DashboardFulfillmentBreakdown;
  pendingFulfillments: {
    count: number;
    orders: DashboardPendingOrder[];
  };
  topProducts: DashboardTopProduct[];
  productCount: number;
  customerCount: number;
  payments: {
    available: boolean;
    balance: DashboardMoney[];
    payouts: DashboardPayoutSummary;
    transactions: DashboardTransactionSummary;
  };
  users: DashboardUser[];
  warnings: DashboardWarning[];
}

export interface DashboardStoreFailure {
  storeId: string;
  label: string;
  reason: "missing-token" | "expired-token" | "request-failed";
  message: string;
}

export interface DashboardAggregate {
  stores: StoreDashboardSnapshot[];
  failures: DashboardStoreFailure[];
  revenue: DashboardRevenueSummary;
  topProducts: Array<DashboardTopProduct & { storeId: string; storeName: string }>;
  pendingOrders: Array<DashboardPendingOrder & { storeId: string; storeName: string }>;
  recentTransactions: Array<
    DashboardRecentTransaction & { storeId: string; storeName: string }
  >;
  customerCount: number;
  productCount: number;
  userCount: number;
  pendingFulfillmentCount: number;
  fulfillmentBreakdown: DashboardFulfillmentBreakdown;
  payments: {
    availableStores: number;
    balance: DashboardMoney[];
    payouts: DashboardPayoutSummary;
    transactions: DashboardTransactionSummary;
  };
}
