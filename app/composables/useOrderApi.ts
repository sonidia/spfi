import type { OrdersResponse } from "~~/types/shopify";
import type {
  OrderCancelInput,
  OrderCountQuery,
  OrderCountResponse,
  OrderCreateOptions,
  OrderListQuery,
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
    getRiskAssessments,
    createRiskAssessment,
  };
}
