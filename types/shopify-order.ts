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
