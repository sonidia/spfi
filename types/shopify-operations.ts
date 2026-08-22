export interface CommerceMoney {
  amount: string;
  currencyCode: string;
}

export interface CommercePageInfo {
  endCursor: string | null;
  hasNextPage: boolean;
}

export interface DraftOrderSummary {
  id: string;
  name: string;
  status: string;
  email: string;
  customerName: string;
  createdAt: string;
  updatedAt: string;
  invoiceSentAt: string | null;
  completedAt: string | null;
  invoiceUrl: string | null;
  totalPrice: CommerceMoney;
  itemCount: number;
  orderId: string | null;
}

export interface DiscountSummary {
  id: string;
  type: string;
  title: string;
  code: string | null;
  summary: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  usageCount: number;
}

export interface AbandonedCheckoutSummary {
  id: string;
  name: string;
  customerName: string;
  email: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  recoveryUrl: string;
  totalPrice: CommerceMoney;
  itemCount: number;
  itemTitles: string[];
  discountCodes: string[];
}

export interface ReturnSummary {
  id: string;
  name: string;
  status: "REQUESTED" | "OPEN" | "CLOSED" | "DECLINED" | "CANCELED" | string;
  createdAt: string;
  closedAt: string | null;
  totalQuantity: number;
  orderId: string;
  orderName: string;
  items: Array<{
    id: string;
    title: string;
    quantity: number;
    reason: string;
    customerNote: string;
  }>;
}

export type FulfillmentOrderStatusFilter =
  | "ACTIVE"
  | "OPEN"
  | "IN_PROGRESS"
  | "ON_HOLD"
  | "SCHEDULED"
  | "CLOSED"
  | "CANCELLED"
  | "INCOMPLETE";

export type FulfillmentOrderSupportedAction =
  | "CANCEL_FULFILLMENT_ORDER"
  | "CREATE_FULFILLMENT"
  | "EXTERNAL"
  | "HOLD"
  | "MARK_AS_OPEN"
  | "MERGE"
  | "MOVE"
  | "RELEASE_HOLD"
  | "REPORT_PROGRESS"
  | "REQUEST_CANCELLATION"
  | "REQUEST_FULFILLMENT"
  | "SPLIT"
  | string;

export type FulfillmentHoldReason =
  | "AWAITING_PAYMENT"
  | "AWAITING_RETURN_ITEMS"
  | "HIGH_RISK_OF_FRAUD"
  | "INCORRECT_ADDRESS"
  | "INVENTORY_OUT_OF_STOCK"
  | "ONLINE_STORE_POST_PURCHASE_CROSS_SELL"
  | "OTHER"
  | "UNKNOWN_DELIVERY_DATE";

export interface FulfillmentTrackingInput {
  company?: string;
  number?: string;
  url?: string;
  notifyCustomer?: boolean;
}

export interface FulfillmentOrderLineItemSummary {
  id: string;
  title: string;
  sku: string;
  variantTitle: string;
  remainingQuantity: number;
  totalQuantity: number;
}

export interface FulfillmentRecordSummary {
  id: string;
  name: string;
  status: string;
  displayStatus: string | null;
  createdAt: string;
  updatedAt: string;
  tracking: Array<{
    company: string;
    number: string;
    url: string;
  }>;
}

export interface FulfillmentHoldSummary {
  id: string;
  reason: FulfillmentHoldReason | string;
  displayReason: string;
  reasonNotes: string;
  heldByRequestingApp: boolean;
}

export interface FulfillmentOrderSummary {
  id: string;
  orderId: string;
  orderName: string;
  status: string;
  requestStatus: string;
  createdAt: string;
  updatedAt: string;
  fulfillAt: string | null;
  fulfillBy: string | null;
  assignedLocation: {
    id: string | null;
    name: string;
  };
  itemCount: number;
  lineItems: FulfillmentOrderLineItemSummary[];
  lineItemsTruncated: boolean;
  supportedActions: FulfillmentOrderSupportedAction[];
  holds: FulfillmentHoldSummary[];
  fulfillments: FulfillmentRecordSummary[];
}

export interface FulfillmentMoveLocation {
  id: string;
  name: string;
  movable: boolean;
  message: string;
}

export interface FulfillmentOrderCreateInput extends FulfillmentTrackingInput {
  lineItems?: Array<{ id: string; quantity: number }>;
}

export type FulfillmentOrderAction =
  "fulfill" | "hold" | "releaseHold" | "move" | "updateTracking";

export interface FulfillmentBulkResult {
  fulfillmentOrderId: string;
  ok: boolean;
  message: string;
}

export interface FulfillmentBulkResponse {
  requested: number;
  succeeded: number;
  failed: number;
  results: FulfillmentBulkResult[];
}

export interface CommerceListResponse<T> {
  items: T[];
  pageInfo: CommercePageInfo;
}

export interface DraftOrderCreateInput {
  email?: string;
  note?: string;
  tags?: string[];
  currencyCode: string;
  lineItems: Array<{
    title: string;
    quantity: number;
    unitPrice: string;
    requiresShipping?: boolean;
    taxable?: boolean;
  }>;
}

export type DraftOrderAction = "complete" | "invoice" | "delete";

export interface DiscountCreateInput {
  title: string;
  code: string;
  valueType: "percentage" | "fixed";
  value: string;
  startsAt?: string;
  endsAt?: string;
  usageLimit?: number | null;
  appliesOncePerCustomer?: boolean;
}

export type DiscountAction = "activate" | "deactivate";

export type ReturnAction = "approve" | "decline" | "close" | "cancel";

export interface ReturnActionInput {
  declineReason?: "FINAL_SALE" | "OTHER" | "RETURN_PERIOD_ENDED";
  declineNote?: string;
  notifyCustomer?: boolean;
}

export type OrderBulkAction = "capture" | "fulfill" | "refund";

export interface OrderBulkRequest {
  storeId: string;
  token: string;
  action: OrderBulkAction;
  orderIds: Array<string | number>;
  notifyCustomer?: boolean;
}

export interface OrderBulkResult {
  orderId: string;
  ok: boolean;
  message: string;
}

export interface OrderBulkResponse {
  action: OrderBulkAction;
  requested: number;
  succeeded: number;
  failed: number;
  results: OrderBulkResult[];
}
