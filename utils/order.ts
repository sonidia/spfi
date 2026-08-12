import type { ShopifyAddress, ShopifyOrder } from "~~/types/shopify";

type BadgeInfo = {
  cls: string;
  label: string;
};

export function isNil(v: unknown) {
  return v === undefined || v === null || v === "None" || v === "";
}
export function nilVal<T>(v: T | null | undefined | "" | "None", fallback: T): T;
export function nilVal<T>(v: T | null | undefined | "" | "None"): T | null;
export function nilVal<T>(
  v: T | null | undefined | "" | "None",
  fallback: T | null = null,
) {
  return isNil(v) ? fallback : v;
}
export function fmtDate(iso?: string | null) {
  if (!iso || isNil(iso)) return null;
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
export function fmtDateTime(iso?: string | null) {
  if (!iso || isNil(iso)) return null;
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }) +
    " at " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase()
  );
}
export function fmtMoney(
  amount: string | number | null | undefined,
  currency?: string | null,
) {
  if (amount === undefined || amount === null) return "—";
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) return "—";

  const currencyCode = String(currency || "")
    .trim()
    .toUpperCase();
  if (currencyCode) {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currencyCode,
        currencyDisplay: "code",
      }).format(numericAmount);
    } catch {
      return `${numericAmount.toLocaleString("en-US")} ${currencyCode}`;
    }
  }

  return numericAmount.toLocaleString("en-US");
}

export function formatMoneyInput(amount: string | number, currency?: string | null) {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) return "";
  return numericAmount.toFixed(getCurrencyFractionDigits(currency));
}

export function getCurrencyFractionDigits(currency?: string | null) {
  const currencyCode = String(currency || "")
    .trim()
    .toUpperCase();
  if (!currencyCode) return 2;

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
    }).resolvedOptions().maximumFractionDigits;
  } catch {
    return 2;
  }
}
export function capitalize(str: string) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, " ");
}
export function addressSame(a?: ShopifyAddress | null, b?: ShopifyAddress | null) {
  if (!a || !b) return false;
  return a.address1 === b.address1 && a.city === b.city && a.zip === b.zip;
}
export function serviceName(s: string) {
  if (!s || s === "manual") return "Manual";
  return s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
export function getShipmentLabel(status?: string | null) {
  if (!status) return "";

  const labels: Record<string, string> = {
    in_transit: "In transit",
    delivered: "Delivered",
    out_for_delivery: "Out for delivery",
    attempted_delivery: "Attempted delivery",
    ready_for_pickup: "Ready for pickup",
    confirmed: "Confirmed",
    failure: "Delivery failed",
  };
  return labels[status] || capitalize(status);
}
export function getDeliverBy(createdAt?: string | null) {
  if (!createdAt) return "";

  const d = new Date(createdAt);
  d.setDate(d.getDate() + 3);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
export function getSource(order?: ShopifyOrder | null) {
  const sourceMap: Record<string, string> = {
    web: "Online Store",
    pos: "POS",
    draft_orders: "Draft Order",
    shopify_draft_order: "Draft Order",
  };
  if (!order) return "Online Store";
  const sourceName = order.source_name || "";
  return sourceMap[sourceName] || capitalize(sourceName) || "Online Store";
}
export function financialBadge(status?: string | null) {
  if (!status) return null;
  const cls: Record<string, string> = {
    paid: "badge-paid",
    pending: "badge-pending",
    refunded: "badge-cancelled",
    partially_refunded: "badge-partial",
    voided: "badge-archived",
    authorized: "badge-pending",
  };
  return { cls: cls[status] || "badge-archived", label: capitalize(status) };
}
export function fulfillmentBadge(status?: string | null) {
  if (isNil(status)) return { cls: "badge-unfulfilled", label: "Unfulfilled" };
  const normalizedStatus = String(status);
  const cls: Record<string, string> = {
    fulfilled: "badge-fulfilled",
    partial: "badge-partial",
    restocked: "badge-archived",
  };
  return {
    cls: cls[normalizedStatus] || "badge-archived",
    label: capitalize(normalizedStatus),
  };
}
export function transactionBadge(status?: string | null) {
  if (!status) return null;
  const cls: Record<string, string> = {
    paid: "badge-paid",
    pending: "badge-unfulfilled",
    in_transit: "badge-partial",
  };

  return { cls: cls[status] || "badge-archived", label: capitalize(status) };
}

export function getOrderBadges(order?: ShopifyOrder | null): BadgeInfo[] {
  const badges: BadgeInfo[] = [];
  if (!order) return badges;
  if (order.financial_status) {
    const b = financialBadge(order.financial_status);
    if (b) badges.push(b);
  }
  if (order.fulfillment_status !== undefined) {
    const b = fulfillmentBadge(order.fulfillment_status);
    if (b) badges.push(b);
  }
  if (!isNil(order.closed_at))
    badges.push({ cls: "badge-archived", label: "Archived" });
  if (!isNil(order.cancelled_at))
    badges.push({ cls: "badge-cancelled", label: "Cancelled" });
  return badges;
}
export function getCustomerName(order?: ShopifyOrder | null) {
  if (!order || !order.customer) return null;
  const cust = order.customer;
  const name = [nilVal(cust.first_name, ""), nilVal(cust.last_name, "")]
    .filter(Boolean)
    .join(" ");
  return name || null;
}
export function getCustomerEmail(order?: ShopifyOrder | null) {
  if (!order) return null;
  return (
    nilVal(order.customer?.email) ||
    nilVal(order.email) ||
    nilVal(order.contact_email) ||
    null
  );
}
export function getSubtotal(order?: ShopifyOrder | null) {
  if (!order) return "0.00";
  return nilVal(order.subtotal_price, nilVal(order.current_subtotal_price, "0.00"));
}
export function getTax(order?: ShopifyOrder | null) {
  if (!order) return "0.00";
  return nilVal(order.total_tax, nilVal(order.current_total_tax, "0.00"));
}
export function getDiscount(order?: ShopifyOrder | null) {
  if (!order) return "0.00";
  return nilVal(order.total_discounts, nilVal(order.current_total_discounts, "0.00"));
}
export function getItemCount(order?: ShopifyOrder | null) {
  if (!order) return 0;
  return (order.line_items || []).reduce((sum, item) => sum + (item.quantity || 1), 0);
}
