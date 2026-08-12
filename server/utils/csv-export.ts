import { createApiErrorFromMessage } from "./callShopifyApi";
import { buildOrderListParams } from "./shopify-order-query";
import { buildBalanceTransactionQueryParams } from "./shopify-payment-query";

export const CSV_EXPORT_RESOURCES = ["orders", "products", "payments"] as const;
export type CsvExportResource = (typeof CSV_EXPORT_RESOURCES)[number];

export interface CsvExportDefinition {
  path: string;
  resourceKey: string;
  columns: string[];
  params: Record<string, unknown>;
  preserveUnsafeIntegers?: boolean;
  mapRow: (item: Record<string, unknown>) => Record<string, unknown>;
}

export function getCsvExportDefinition(
  resource: string,
  filters: unknown,
): CsvExportDefinition {
  if (resource === "orders") {
    const {
      page_info: _cursor,
      limit: _limit,
      ...params
    } = buildOrderListParams(filters);
    return {
      path: "/orders.json",
      resourceKey: "orders",
      columns: [
        "id",
        "name",
        "created_at",
        "customer",
        "email",
        "financial_status",
        "fulfillment_status",
        "currency",
        "total_price",
        "tags",
      ],
      params,
      preserveUnsafeIntegers: true,
      mapRow: mapOrderRow,
    };
  }

  if (resource === "products") {
    return {
      path: "/products.json",
      resourceKey: "products",
      columns: [
        "id",
        "title",
        "status",
        "vendor",
        "product_type",
        "variants_count",
        "created_at",
        "updated_at",
        "tags",
      ],
      params: {},
      preserveUnsafeIntegers: true,
      mapRow: mapProductRow,
    };
  }

  if (resource === "payments") {
    return {
      path: "/shopify_payments/balance/transactions.json",
      resourceKey: "transactions",
      columns: [
        "id",
        "processed_at",
        "type",
        "test",
        "payout_id",
        "payout_status",
        "currency",
        "amount",
        "fee",
        "net",
        "source_id",
        "source_type",
        "source_order_id",
      ],
      params: buildBalanceTransactionQueryParams(filters),
      preserveUnsafeIntegers: true,
      mapRow: mapPaymentRow,
    };
  }

  throw createApiErrorFromMessage(
    `Unsupported CSV export resource: ${resource || "(empty)"}.`,
    400,
  );
}

function mapOrderRow(item: Record<string, unknown>) {
  const customer = toRecord(item.customer);
  return {
    id: item.id,
    name: item.name,
    created_at: item.created_at,
    customer: [customer.first_name, customer.last_name].filter(Boolean).join(" "),
    email: item.email || customer.email,
    financial_status: item.financial_status,
    fulfillment_status: item.fulfillment_status,
    currency: item.currency,
    total_price: item.total_price,
    tags: item.tags,
  };
}

function mapProductRow(item: Record<string, unknown>) {
  return {
    id: item.id,
    title: item.title,
    status: item.status,
    vendor: item.vendor,
    product_type: item.product_type,
    variants_count: Array.isArray(item.variants) ? item.variants.length : 0,
    created_at: item.created_at,
    updated_at: item.updated_at,
    tags: item.tags,
  };
}

function mapPaymentRow(item: Record<string, unknown>) {
  return {
    id: item.id,
    processed_at: item.processed_at,
    type: item.type,
    test: item.test,
    payout_id: item.payout_id,
    payout_status: item.payout_status,
    currency: item.currency,
    amount: item.amount,
    fee: item.fee,
    net: item.net,
    source_id: item.source_id,
    source_type: item.source_type,
    source_order_id: item.source_order_id,
  };
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
