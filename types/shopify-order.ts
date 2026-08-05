import type { ShopifyOrder } from "./shopify";

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
  processed_at_max?: string;
  processed_at_min?: string;
  since_id?: number | string;
  status?: string;
  updated_at_max?: string;
  updated_at_min?: string;
}

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
    | "bypass"
    | "decrement_ignoring_policy"
    | "decrement_obeying_policy";
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

export type RiskAssessmentLevel =
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "NONE"
  | "PENDING";

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

export type RefundLineItemRestockType =
  | "CANCEL"
  | "NO_RESTOCK"
  | "RETURN";

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

export interface CalculatedOrderLineItem {
  id: string;
  title: string;
  sku?: string | null;
  quantity: number;
  editableQuantity: number;
  restockable: boolean;
}

export interface OrderEditSessionResponse {
  calculatedOrderId: string;
  lineItems: CalculatedOrderLineItem[];
}

export interface OrderEditLineChange {
  calculatedLineItemId: string;
  quantity: number;
  restock?: boolean;
}

export interface OrderEditCommitInput {
  calculatedOrderId: string;
  changes: OrderEditLineChange[];
  notifyCustomer?: boolean;
  staffNote?: string;
}

export interface OrderEditCommitResponse {
  orderId: string;
  successMessages: string[];
}

export interface OrderFulfillmentLineItemInput {
  id: number;
  quantity: number;
}

export interface OrderFulfillmentGroupInput {
  fulfillment_order_id: number;
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
