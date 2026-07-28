import type { ShopifyAddress, ShopifyOrder } from "~~/types/shopify";

type BadgeInfo = {
  cls: string;
  label: string;
};

export const ICONS = {
  edit: `<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z"/><path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z"/></svg>`,
  dots: `<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M3 10a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm5.5 0a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm7-1.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"/></svg>`,
  cal: `<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clip-rule="evenodd"/></svg>`,
  box: `<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 1.5a.75.75 0 01.682.44l7.25 15.5a.75.75 0 01-.682 1.06H2.75a.75.75 0 01-.682-1.06l7.25-15.5A.75.75 0 0110 1.5zm0 3.26L4.413 17h11.174L10 4.76z" clip-rule="evenodd"/></svg>`,
  truck: `<svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor"><path d="M6.5 3A1.5 1.5 0 005 4.5v.563A3.001 3.001 0 002 8v7.5A1.5 1.5 0 003.5 17h13a1.5 1.5 0 001.5-1.5V8a3 3 0 00-3-3V4.5A1.5 1.5 0 0013.5 3h-7zm0 1.5h7v.563A3.003 3.003 0 0010 7.5a3.003 3.003 0 00-3.5-2.437V4.5z"/></svg>`,
  deliver: `<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd"/></svg>`,
  link: `<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M12.232 4.232a2.5 2.5 0 013.536 3.536l-1.225 1.224a.75.75 0 001.061 1.061l1.224-1.224a4 4 0 00-5.656-5.656l-3 3a4 4 0 00.225 5.865.75.75 0 00.977-1.138 2.5 2.5 0 01-.142-3.667l3-3z"/><path d="M11.603 7.963a.75.75 0 00-.977 1.138 2.5 2.5 0 01.142 3.667l-3 3a2.5 2.5 0 01-3.536-3.536l1.225-1.224a.75.75 0 00-1.061-1.061l-1.224 1.224a4 4 0 105.656 5.656l3-3a4 4 0 00-.225-5.865z"/></svg>`,
  user: `<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z"/></svg>`,
  clock: `<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clip-rule="evenodd"/></svg>`,
  card: `<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="5" width="16" height="11" rx="2"/><path d="M2 9h16" stroke-linecap="round"/></svg>`,
  pin: `<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 103 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 002.273 1.765 11.842 11.842 0 00.976.544l.062.029.018.008.006.003zM10 11.25a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z" clip-rule="evenodd"/></svg>`,
  plus: `<svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z"/></svg>`,
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
    d
      .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
      .toLowerCase()
  );
}
export function fmtMoney(
  amount: string | number | null | undefined,
  currency?: string | null,
) {
  if (amount === undefined || amount === null) return "—";
  return `$${Number(amount).toFixed(2)} ${currency || ""}`.trim();
}
export function capitalize(str: string) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, " ");
}
export function addressSame(
  a?: ShopifyAddress | null,
  b?: ShopifyAddress | null,
) {
  if (!a || !b) return false;
  return a.address1 === b.address1 && a.city === b.city && a.zip === b.zip;
}
export function formatAddress(addr?: ShopifyAddress | null) {
  if (!addr) return "";
  return [
    nilVal(addr.name),
    nilVal(addr.company),
    nilVal(addr.address1),
    nilVal(addr.address2),
    [
      nilVal(addr.city),
      nilVal(addr.province_code) || nilVal(addr.province),
      nilVal(addr.zip),
    ]
      .filter(Boolean)
      .join(" "),
    nilVal(addr.country),
  ]
    .filter(Boolean)
    .join("<br>");
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
  return nilVal(
    order.subtotal_price,
    nilVal(order.current_subtotal_price, "0.00"),
  );
}
export function getTax(order?: ShopifyOrder | null) {
  if (!order) return "0.00";
  return nilVal(order.total_tax, nilVal(order.current_total_tax, "0.00"));
}
export function getDiscount(order?: ShopifyOrder | null) {
  if (!order) return "0.00";
  return nilVal(
    order.total_discounts,
    nilVal(order.current_total_discounts, "0.00"),
  );
}
export function getItemCount(order?: ShopifyOrder | null) {
  if (!order) return 0;
  return (order.line_items || []).reduce(
    (sum, item) => sum + (item.quantity || 1),
    0,
  );
}
