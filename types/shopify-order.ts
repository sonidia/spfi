import type {
  ShopifyFulfillment,
  ShopifyNumericId,
  ShopifyOrder,
  ShopifyRefund,
} from "./shopify";
import type { ApiContractMeta, ApiSuccessResponse } from "./api-contract";

export type ShopifyOrderPayload = Record<string, unknown>;

export interface OrderListQuery {
  attribution_app_id?: string;
  created_at_max?: string;
  created_at_min?: string;
  fields?: string;
  financial_status?: string;
  fulfillment_status?: string;
  ids?: string;
  limit?: number;
  name?: string;
  page_info?: string;
  processed_at_max?: string;
  processed_at_min?: string;
  since_id?: number | string;
  status?: string;
  updated_at_max?: string;
  updated_at_min?: string;
}

export interface ShopifyPageInfo {
  nextCursor: string | null;
  previousCursor: string | null;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface PaginatedOrdersData {
  orders: ShopifyOrder[];
}

interface PaginatedOrdersMeta extends ApiContractMeta<"orders", "cursor"> {
  pagination: ShopifyPageInfo;
}

export type PaginatedOrdersResponse = ApiSuccessResponse<
  PaginatedOrdersData,
  PaginatedOrdersMeta
>;

export type OrderCountQuery = Pick<
  OrderListQuery,
  | "created_at_max"
  | "created_at_min"
  | "financial_status"
  | "fulfillment_status"
  | "status"
  | "updated_at_max"
  | "updated_at_min"
>;

export interface OrderCreateOptions {
  inventory_behaviour?:
    "bypass" | "decrement_ignoring_policy" | "decrement_obeying_policy";
  send_receipt?: boolean;
  send_fulfillment_receipt?: boolean;
}

export interface OrderCancelInput {
  amount?: string;
  currency?: string;
  email?: boolean;
  reason?: "customer" | "inventory" | "fraud" | "declined" | "other";
  refund?: Record<string, unknown>;
}

export interface OrderCountResponse {
  count: number;
}

export type RiskAssessmentLevel = "HIGH" | "MEDIUM" | "LOW" | "NONE" | "PENDING";

export type RiskFactSentiment = "NEGATIVE" | "NEUTRAL" | "POSITIVE";

export interface ShopifyRiskFact {
  description: string;
  sentiment: RiskFactSentiment;
}

export interface ShopifyOrderRiskAssessment {
  riskLevel: RiskAssessmentLevel;
  provider: { title: string } | null;
  facts: ShopifyRiskFact[];
}

export interface ShopifyOrderRiskSummary {
  assessments: ShopifyOrderRiskAssessment[];
  recommendation: string;
}

export interface OrderRiskAssessmentsResponse {
  orderId: string;
  risk: ShopifyOrderRiskSummary;
  capabilities: {
    read: true;
    create: true;
    update: false;
    delete: false;
  };
}

export interface OrderMutationResponse {
  order?: ShopifyOrder;
  success?: boolean;
}

export interface OrderCaptureInput {
  parentTransactionId: string | number;
  amount: string;
  currency?: string;
  finalCapture?: boolean;
}

export interface OrderVoidInput {
  parentTransactionId: string | number;
}

export interface OrderManualPaymentInput {
  amount: string;
  currency: string;
  paymentMethodName?: string;
  processedAt?: string;
}

export interface OrderTransactionListQuery {
  fields?: string;
  in_shop_currency?: boolean;
  since_id?: string | number;
}

export type OrderTransactionDetailQuery = Pick<
  OrderTransactionListQuery,
  "fields" | "in_shop_currency"
>;

export type RefundLineItemRestockType = "CANCEL" | "NO_RESTOCK" | "RETURN";

export interface OrderRefundLineItemInput {
  lineItemId: string | number;
  quantity: number;
  restockType?: RefundLineItemRestockType;
  locationId?: string | number;
}

export interface OrderRefundInput {
  amount: string;
  parentTransactionId: string | number;
  gateway: string;
  currency?: string;
  lineItems: OrderRefundLineItemInput[];
  note?: string;
  notify?: boolean;
  discrepancyReason?: "CUSTOMER" | "DAMAGE" | "OTHER" | "RESTOCK";
  idempotencyKey?: string;
}

export interface OrderRefundListQuery {
  fields?: string;
  in_shop_currency?: boolean;
  limit?: number;
}

export interface OrderRefundsResponse {
  refunds: ShopifyRefund[];
}

export interface OrderFulfillmentListQuery {
  created_at_max?: string;
  created_at_min?: string;
  fields?: string;
  limit?: number;
  since_id?: string | number;
  updated_at_max?: string;
  updated_at_min?: string;
}

export interface OrderFulfillmentsResponse {
  fulfillments: ShopifyFulfillment[];
}

export interface CalculatedOrderLineItem {
  id: string;
  title: string;
  sku?: string | null;
  quantity: number;
  editableQuantity: number;
  restockable: boolean;
}

export interface OrderEditSessionResponse {
  orderEditSessionId: string;
  calculatedOrderId: string;
  lineItems: CalculatedOrderLineItem[];
  hasMoreLineItems: boolean;
}

export interface OrderEditLineChange {
  calculatedLineItemId: string;
  quantity: number;
  restock?: boolean;
}

export interface OrderEditCustomItemInput {
  title: string;
  price: string;
  currencyCode: string;
  quantity: number;
  locationId?: string | number;
  requiresShipping?: boolean;
  taxable?: boolean;
}

export interface OrderEditCommitInput {
  orderEditSessionId: string;
  changes?: OrderEditLineChange[];
  customItems?: OrderEditCustomItemInput[];
  notifyCustomer?: boolean;
  staffNote?: string;
}

export interface OrderEditCommitResponse {
  orderId: string;
  successMessages: string[];
}

export interface OrderFulfillmentLineItemInput {
  id: ShopifyNumericId;
  quantity: number;
}

export interface OrderFulfillmentGroupInput {
  fulfillment_order_id: ShopifyNumericId;
  fulfillment_order_line_items: OrderFulfillmentLineItemInput[];
}

export interface OrderFulfillmentInput {
  notify_customer?: boolean;
  tracking_info?: {
    number?: string;
    company?: string;
    url?: string;
  };
  line_items_by_fulfillment_order: OrderFulfillmentGroupInput[];
}
