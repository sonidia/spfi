import type {
  OrderEventsResponse,
  OrderTransactionsResponse,
  OrdersResponse,
  ShopifyFulfillmentOrder,
} from "~~/types/shopify";
import type {
  OrderCaptureInput,
  OrderCancelInput,
  OrderCountQuery,
  OrderCountResponse,
  OrderCreateOptions,
  OrderEditCommitInput,
  OrderEditCommitResponse,
  OrderEditSessionResponse,
  OrderFulfillmentInput,
  OrderListQuery,
  OrderRefundInput,
  OrderRiskAssessmentsResponse,
  RiskAssessmentLevel,
  ShopifyOrderPayload,
  ShopifyOrderRiskAssessment,
  ShopifyRiskFact,
} from "~~/types/shopify-order";

interface OrderAuth {
  storeId: string;
  token: string;
}

export function useOrderApi() {
  function list(auth: OrderAuth, query: OrderListQuery = {}) {
    return $fetch<OrdersResponse>("/api/order/all", {
      method: "POST",
      body: { ...auth, query },
    });
  }

  function get(auth: OrderAuth, id: string | number, fields?: string) {
    return $fetch<OrdersResponse>(`/api/order/${id}`, {
      params: { ...auth, ...(fields ? { fields } : {}) },
    });
  }

  function count(auth: OrderAuth, query: OrderCountQuery = {}) {
    return $fetch<OrderCountResponse>("/api/order/count", {
      method: "POST",
      body: { ...auth, query },
    });
  }

  function create(
    auth: OrderAuth,
    order: ShopifyOrderPayload,
    options: OrderCreateOptions = {},
  ) {
    return $fetch<OrdersResponse>("/api/order", {
      method: "POST",
      body: { ...auth, order, ...options },
    });
  }

  function update(
    auth: OrderAuth,
    id: string | number,
    order: ShopifyOrderPayload,
  ) {
    return $fetch<OrdersResponse>(`/api/order/${id}`, {
      method: "PUT",
      body: { ...auth, order },
    });
  }

  function remove(auth: OrderAuth, id: string | number) {
    return $fetch<{ success: true }>(`/api/order/${id}`, {
      method: "DELETE",
      params: auth,
    });
  }

  function cancel(
    auth: OrderAuth,
    id: string | number,
    input: OrderCancelInput = {},
  ) {
    return $fetch<OrdersResponse>(`/api/order/${id}/cancel`, {
      method: "POST",
      body: { ...auth, ...input },
    });
  }

  function close(auth: OrderAuth, id: string | number) {
    return $fetch<OrdersResponse>(`/api/order/${id}/close`, {
      method: "POST",
      body: auth,
    });
  }

  function open(auth: OrderAuth, id: string | number) {
    return $fetch<OrdersResponse>(`/api/order/${id}/open`, {
      method: "POST",
      body: auth,
    });
  }

  function getTransactions(auth: OrderAuth, id: string | number) {
    return $fetch<OrderTransactionsResponse>(`/api/order/${id}/transactions`, {
      params: auth,
    });
  }

  function getEvents(auth: OrderAuth, id: string | number) {
    return $fetch<OrderEventsResponse>(`/api/order/${id}/events`, {
      params: auth,
    });
  }

  function capture(
    auth: OrderAuth,
    id: string | number,
    input: OrderCaptureInput,
  ) {
    return $fetch<{ transaction: Record<string, unknown> | null }>(
      `/api/order/${id}/capture`,
      { method: "POST", body: { ...auth, ...input } },
    );
  }

  function markAsPaid(auth: OrderAuth, id: string | number) {
    return $fetch<{ order: Record<string, unknown> | null }>(
      `/api/order/${id}/mark-paid`,
      { method: "POST", body: auth },
    );
  }

  function refund(
    auth: OrderAuth,
    id: string | number,
    input: OrderRefundInput,
  ) {
    return $fetch<{ refund: Record<string, unknown> | null; idempotencyKey: string }>(
      `/api/order/${id}/refund`,
      { method: "POST", body: { ...auth, ...input } },
    );
  }

  function beginEdit(auth: OrderAuth, id: string | number) {
    return $fetch<OrderEditSessionResponse>(`/api/order/${id}/edit/begin`, {
      method: "POST",
      body: auth,
    });
  }

  function commitEdit(
    auth: OrderAuth,
    id: string | number,
    input: OrderEditCommitInput,
  ) {
    return $fetch<OrderEditCommitResponse>(`/api/order/${id}/edit/commit`, {
      method: "POST",
      body: { ...auth, ...input },
    });
  }

  function getFulfillmentOrders(auth: OrderAuth, id: string | number) {
    return $fetch<{ fulfillment_orders?: ShopifyFulfillmentOrder[] }>(
      `/api/order/${id}/fulfillment_orders`,
      { params: auth },
    );
  }

  function fulfill(
    auth: OrderAuth,
    id: string | number,
    fulfillment: OrderFulfillmentInput,
  ) {
    return $fetch<Record<string, unknown>>(`/api/order/${id}/fulfill`, {
      method: "POST",
      body: { ...auth, fulfillment },
    });
  }

  function cancelFulfillment(
    auth: OrderAuth,
    fulfillmentId: string | number,
  ) {
    return $fetch<{ fulfillment: Record<string, unknown> | null }>(
      `/api/fulfillments/${fulfillmentId}/cancel`,
      { method: "POST", body: auth },
    );
  }

  function getRiskAssessments(auth: OrderAuth, id: string | number) {
    return $fetch<OrderRiskAssessmentsResponse>(
      `/api/order/${id}/risk-assessments`,
      { params: auth },
    );
  }

  function createRiskAssessment(
    auth: OrderAuth,
    id: string | number,
    riskLevel: RiskAssessmentLevel,
    facts: ShopifyRiskFact[],
  ) {
    return $fetch<{ orderRiskAssessment: ShopifyOrderRiskAssessment }>(
      `/api/order/${id}/risk-assessments`,
      {
        method: "POST",
        body: { ...auth, riskLevel, facts },
      },
    );
  }

  return {
    list,
    get,
    count,
    create,
    update,
    remove,
    cancel,
    close,
    open,
    getTransactions,
    getEvents,
    capture,
    markAsPaid,
    refund,
    beginEdit,
    commitEdit,
    getFulfillmentOrders,
    fulfill,
    cancelFulfillment,
    getRiskAssessments,
    createRiskAssessment,
  };
}
