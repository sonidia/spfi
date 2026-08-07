import type {
  OrderEventsResponse,
  OrderTransactionCountResponse,
  OrderTransactionResponse,
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
  OrderFulfillmentListQuery,
  OrderFulfillmentInput,
  OrderFulfillmentsResponse,
  OrderListQuery,
  OrderManualPaymentInput,
  OrderRefundInput,
  OrderRefundListQuery,
  OrderRefundsResponse,
  OrderRiskAssessmentsResponse,
  OrderTransactionDetailQuery,
  OrderTransactionListQuery,
  OrderVoidInput,
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
  function queryOptions(
    auth: OrderAuth,
    query: object = {},
  ) {
    return {
      params: {
        storeId: auth.storeId,
        ...(query as Record<string, unknown>),
      },
      headers: { "x-shopify-access-token": auth.token },
    };
  }

  function list(auth: OrderAuth, query: OrderListQuery = {}) {
    return $fetch<OrdersResponse>("/api/order/all", {
      method: "POST",
      body: { ...auth, query },
    });
  }

  function get(auth: OrderAuth, id: string | number, fields?: string) {
    return $fetch<OrdersResponse>(`/api/order/${id}`, {
      ...queryOptions(auth, fields ? { fields } : {}),
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
      ...queryOptions(auth),
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

  function getTransactions(
    auth: OrderAuth,
    id: string | number,
    query: OrderTransactionListQuery = {},
  ) {
    return $fetch<OrderTransactionsResponse>(`/api/order/${id}/transactions`, {
      ...queryOptions(auth, query),
    });
  }

  function getTransaction(
    auth: OrderAuth,
    orderId: string | number,
    transactionId: string | number,
    query: OrderTransactionDetailQuery = {},
  ) {
    return $fetch<OrderTransactionResponse>(
      `/api/order/${orderId}/transactions/${transactionId}`,
      queryOptions(auth, query),
    );
  }

  function countTransactions(auth: OrderAuth, id: string | number) {
    return $fetch<OrderTransactionCountResponse>(
      `/api/order/${id}/transactions/count`,
      queryOptions(auth),
    );
  }

  function getEvents(auth: OrderAuth, id: string | number) {
    return $fetch<OrderEventsResponse>(`/api/order/${id}/events`, {
      ...queryOptions(auth),
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

  function voidTransaction(
    auth: OrderAuth,
    id: string | number,
    input: OrderVoidInput,
  ) {
    return $fetch<{ transaction: Record<string, unknown> | null }>(
      `/api/order/${id}/void`,
      { method: "POST", body: { ...auth, ...input } },
    );
  }

  function createManualPayment(
    auth: OrderAuth,
    id: string | number,
    input: OrderManualPaymentInput,
  ) {
    return $fetch<{ order: Record<string, unknown> | null }>(
      `/api/order/${id}/manual-payment`,
      { method: "POST", body: { ...auth, ...input } },
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

  function getRefunds(
    auth: OrderAuth,
    id: string | number,
    query: OrderRefundListQuery = {},
  ) {
    return $fetch<OrderRefundsResponse>(`/api/order/${id}/refunds`, {
      ...queryOptions(auth, query),
    });
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
      queryOptions(auth),
    );
  }

  function getFulfillments(
    auth: OrderAuth,
    id: string | number,
    query: OrderFulfillmentListQuery = {},
  ) {
    return $fetch<OrderFulfillmentsResponse>(
      `/api/order/${id}/fulfillments`,
      queryOptions(auth, query),
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
      queryOptions(auth),
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
    getTransaction,
    countTransactions,
    getEvents,
    capture,
    markAsPaid,
    voidTransaction,
    createManualPayment,
    refund,
    getRefunds,
    beginEdit,
    commitEdit,
    getFulfillmentOrders,
    getFulfillments,
    fulfill,
    cancelFulfillment,
    getRiskAssessments,
    createRiskAssessment,
  };
}
