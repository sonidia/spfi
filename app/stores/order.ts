import { defineStore } from "pinia";
import { ref } from "vue";
import { useOrderApi } from "~/composables/useOrderApi";
import type { ShopifyOrder } from "~~/types/shopify";
import type {
  OrderCaptureInput,
  OrderCancelInput,
  OrderCountQuery,
  OrderCreateOptions,
  OrderEditCommitInput,
  OrderFulfillmentInput,
  OrderListQuery,
  OrderRefundInput,
  RiskAssessmentLevel,
  ShopifyOrderPayload,
  ShopifyOrderRiskSummary,
  ShopifyRiskFact,
} from "~~/types/shopify-order";
import { getAppErrorMessage } from "~~/utils/error";

export const useOrderStore = defineStore("order", () => {
  const orderApi = useOrderApi();
  const orders = ref<ShopifyOrder[]>([]);
  const orderCount = ref(0);
  const riskByOrder = ref<Record<string, ShopifyOrderRiskSummary>>({});
  const hasFetchedAll = ref(false);
  const isLoading = ref(false);
  const isMutating = ref(false);
  const isRiskLoading = ref(false);
  const error = ref<string | null>(null);
  const mutationError = ref<string | null>(null);
  const riskError = ref<string | null>(null);
  const activeStoreId = ref("");
  const currentPage = ref(1);
  const pageSize = ref(20);
  const storeCache = ref<
    Record<
      string,
      {
        orders: ShopifyOrder[];
        orderCount: number;
        hasFetchedAll: boolean;
        currentPage: number;
        pageSize: number;
      }
    >
  >({});

  function rememberStore(storeId = activeStoreId.value) {
    if (!storeId) return;
    storeCache.value[storeId] = {
      orders: [...orders.value],
      orderCount: orderCount.value,
      hasFetchedAll: hasFetchedAll.value,
      currentPage: currentPage.value,
      pageSize: pageSize.value,
    };
  }

  function activateStore(storeId: string) {
    if (activeStoreId.value === storeId) return;
    hydrate(storeId);
  }

  async function fetchAll(
    storeId: string,
    token: string,
    force = false,
    query: OrderListQuery = {},
  ) {
    if (!storeId || !token) {
      error.value = "Store ID and Access Token are required.";
      return;
    }

    activateStore(storeId);
    if (!force && hasFetchedAll.value) return;

    isLoading.value = true;
    error.value = null;

    try {
      const response = await orderApi.list({ storeId, token }, query);

      storeCache.value[storeId] = {
        orders: response.orders || (response.order ? [response.order] : []),
        orderCount: orderCount.value,
        hasFetchedAll: true,
        currentPage: force ? 1 : currentPage.value,
        pageSize: pageSize.value,
      };
      if (activeStoreId.value === storeId) {
        orders.value = [...storeCache.value[storeId].orders];
        hasFetchedAll.value = true;
        if (force) currentPage.value = 1;
      }
    } catch (err) {
      if (activeStoreId.value === storeId) {
        error.value = getAppErrorMessage(err, "Failed to fetch order data.");
      }
    } finally {
      if (activeStoreId.value === storeId) {
        isLoading.value = false;
      }
    }
  }

  async function fetchById(
    storeId: string,
    token: string,
    id: string,
    force = false,
  ) {
    void force;
    if (!storeId || !token || !id) return;

    activateStore(storeId);
    isLoading.value = true;
    error.value = null;

    try {
      const response = await orderApi.get({ storeId, token }, id);

      if (response.order && activeStoreId.value === storeId) {
        const index = orders.value.findIndex(
          (order) => order.id?.toString() === id,
        );
        if (index > -1) {
          orders.value[index] = response.order;
        } else {
          orders.value.push(response.order);
        }
        rememberStore(storeId);
      }
    } catch (err) {
      if (activeStoreId.value === storeId) {
        error.value = getAppErrorMessage(err, "Failed to fetch order detail.");
      }
    } finally {
      if (activeStoreId.value === storeId) {
        isLoading.value = false;
      }
    }
  }

  function hydrate(storeId: string): boolean {
    activeStoreId.value = storeId;
    const cached = storeCache.value[storeId];
    if (!cached) {
      $reset();
      return false;
    }
    orders.value = [...cached.orders];
    orderCount.value = cached.orderCount;
    hasFetchedAll.value = cached.hasFetchedAll;
    currentPage.value = cached.currentPage;
    pageSize.value = cached.pageSize;
    error.value = null;
    return true;
  }

  function setPage(page: number) {
    currentPage.value = Math.max(1, Math.floor(page));
    rememberStore();
  }

  function setPageSize(size: number) {
    pageSize.value = Math.max(1, Math.floor(size));
    currentPage.value = 1;
    rememberStore();
  }

  async function fetchCount(
    storeId: string,
    token: string,
    query: OrderCountQuery = { status: "any" },
  ) {
    try {
      const response = await orderApi.count({ storeId, token }, query);
      if (activeStoreId.value === storeId) {
        orderCount.value = response.count;
        rememberStore(storeId);
      }
      return response.count;
    } catch (err) {
      mutationError.value = getAppErrorMessage(
        err,
        "Failed to fetch the order count.",
      );
      return null;
    }
  }

  async function createOrder(
    storeId: string,
    token: string,
    order: ShopifyOrderPayload,
    options: OrderCreateOptions = {},
  ) {
    return runMutation(storeId, async () => {
      const response = await orderApi.create({ storeId, token }, order, options);
      if (response.order) upsertOrder(response.order);
      orderCount.value += response.order ? 1 : 0;
      return response.order || null;
    }, "Failed to create the order.");
  }

  async function updateOrder(
    storeId: string,
    token: string,
    id: string | number,
    order: ShopifyOrderPayload,
  ) {
    return runMutation(storeId, async () => {
      const response = await orderApi.update({ storeId, token }, id, order);
      if (response.order) upsertOrder(response.order);
      return response.order || null;
    }, "Failed to update the order.");
  }

  async function cancelOrder(
    storeId: string,
    token: string,
    id: string | number,
    input: OrderCancelInput = {},
  ) {
    return runOrderAction(storeId, token, id, "cancel", input);
  }

  async function closeOrder(
    storeId: string,
    token: string,
    id: string | number,
  ) {
    return runOrderAction(storeId, token, id, "close");
  }

  async function openOrder(
    storeId: string,
    token: string,
    id: string | number,
  ) {
    return runOrderAction(storeId, token, id, "open");
  }

  async function deleteOrder(
    storeId: string,
    token: string,
    id: string | number,
  ) {
    return runMutation(storeId, async () => {
      await orderApi.remove({ storeId, token }, id);
      orders.value = orders.value.filter((order) => String(order.id) !== String(id));
      orderCount.value = Math.max(0, orderCount.value - 1);
      rememberStore(storeId);
      return true;
    }, "Failed to delete the order.");
  }

  async function capturePayment(
    storeId: string,
    token: string,
    id: string | number,
    input: OrderCaptureInput,
  ) {
    return runOrderMutationAndRefresh(
      storeId,
      token,
      id,
      () => orderApi.capture({ storeId, token }, id, input),
      "Failed to capture the order payment.",
    );
  }

  async function markOrderAsPaid(
    storeId: string,
    token: string,
    id: string | number,
  ) {
    return runOrderMutationAndRefresh(
      storeId,
      token,
      id,
      () => orderApi.markAsPaid({ storeId, token }, id),
      "Failed to mark the order as paid.",
    );
  }

  async function refundOrder(
    storeId: string,
    token: string,
    id: string | number,
    input: OrderRefundInput,
  ) {
    return runOrderMutationAndRefresh(
      storeId,
      token,
      id,
      () => orderApi.refund({ storeId, token }, id, input),
      "Failed to refund the order.",
    );
  }

  async function commitOrderEdit(
    storeId: string,
    token: string,
    id: string | number,
    input: OrderEditCommitInput,
  ) {
    return runOrderMutationAndRefresh(
      storeId,
      token,
      id,
      () => orderApi.commitEdit({ storeId, token }, id, input),
      "Failed to edit the order items.",
    );
  }

  async function fulfillOrder(
    storeId: string,
    token: string,
    id: string | number,
    input: OrderFulfillmentInput,
  ) {
    return runOrderMutationAndRefresh(
      storeId,
      token,
      id,
      () => orderApi.fulfill({ storeId, token }, id, input),
      "Failed to fulfill the selected items.",
    );
  }

  async function cancelFulfillment(
    storeId: string,
    token: string,
    orderId: string | number,
    fulfillmentId: string | number,
  ) {
    return runOrderMutationAndRefresh(
      storeId,
      token,
      orderId,
      () => orderApi.cancelFulfillment({ storeId, token }, fulfillmentId),
      "Failed to cancel the fulfillment.",
    );
  }

  async function fetchRiskAssessments(
    storeId: string,
    token: string,
    id: string | number,
  ) {
    return runRiskOperation(async () => {
      const response = await orderApi.getRiskAssessments(
        { storeId, token },
        id,
      );
      riskByOrder.value[String(id)] = response.risk;
      return response.risk;
    }, "Failed to fetch order risk assessments.");
  }

  async function createRiskAssessment(
    storeId: string,
    token: string,
    id: string | number,
    riskLevel: RiskAssessmentLevel,
    facts: ShopifyRiskFact[],
  ) {
    return runRiskOperation(async () => {
      const response = await orderApi.createRiskAssessment(
        { storeId, token },
        id,
        riskLevel,
        facts,
      );
      const refreshed = await orderApi.getRiskAssessments(
        { storeId, token },
        id,
      );
      riskByOrder.value[String(id)] = refreshed.risk;
      return response.orderRiskAssessment;
    }, "Failed to create the order risk assessment.");
  }

  async function runOrderAction(
    storeId: string,
    token: string,
    id: string | number,
    action: "cancel" | "close" | "open",
    input: OrderCancelInput = {},
  ) {
    return runMutation(storeId, async () => {
      const auth = { storeId, token };
      const response =
        action === "cancel"
          ? await orderApi.cancel(auth, id, input)
          : action === "close"
            ? await orderApi.close(auth, id)
            : await orderApi.open(auth, id);
      if (response.order) upsertOrder(response.order);
      return response.order || null;
    }, `Failed to ${action} the order.`);
  }

  async function runMutation<T>(
    storeId: string,
    operation: () => Promise<T>,
    fallback: string,
  ): Promise<T | null> {
    if (isMutating.value) return null;
    isMutating.value = true;
    mutationError.value = null;
    try {
      const result = await operation();
      if (activeStoreId.value === storeId) rememberStore(storeId);
      return result;
    } catch (err) {
      mutationError.value = getAppErrorMessage(err, fallback);
      return null;
    } finally {
      isMutating.value = false;
    }
  }

  async function runOrderMutationAndRefresh(
    storeId: string,
    token: string,
    id: string | number,
    operation: () => Promise<unknown>,
    fallback: string,
  ) {
    return runMutation(storeId, async () => {
      await operation();
      try {
        const response = await orderApi.get({ storeId, token }, id);
        if (response.order) upsertOrder(response.order);
        return response.order || null;
      } catch (refreshError) {
        const refreshMessage = getAppErrorMessage(
          refreshError,
          "The refreshed order could not be loaded.",
        );
        mutationError.value = `The action succeeded, but refresh failed: ${refreshMessage}`;
        return (
          orders.value.find((order) => String(order.id) === String(id)) || null
        );
      }
    }, fallback);
  }

  async function runRiskOperation<T>(
    operation: () => Promise<T>,
    fallback: string,
  ): Promise<T | null> {
    isRiskLoading.value = true;
    riskError.value = null;
    try {
      return await operation();
    } catch (err) {
      riskError.value = getAppErrorMessage(err, fallback);
      return null;
    } finally {
      isRiskLoading.value = false;
    }
  }

  function upsertOrder(order: ShopifyOrder) {
    const index = orders.value.findIndex((item) => item.id === order.id);
    if (index >= 0) orders.value[index] = order;
    else orders.value.unshift(order);
  }

  function $reset() {
    orders.value = [];
    orderCount.value = 0;
    riskByOrder.value = {};
    hasFetchedAll.value = false;
    currentPage.value = 1;
    pageSize.value = 20;
    error.value = null;
    isLoading.value = false;
    isMutating.value = false;
    isRiskLoading.value = false;
    mutationError.value = null;
    riskError.value = null;
  }

  return {
    orders,
    orderCount,
    riskByOrder,
    hasFetchedAll,
    isLoading,
    isMutating,
    isRiskLoading,
    error,
    mutationError,
    riskError,
    activeStoreId,
    currentPage,
    pageSize,
    fetchAll,
    fetchById,
    fetchCount,
    createOrder,
    updateOrder,
    cancelOrder,
    closeOrder,
    openOrder,
    deleteOrder,
    capturePayment,
    markOrderAsPaid,
    refundOrder,
    commitOrderEdit,
    fulfillOrder,
    cancelFulfillment,
    fetchRiskAssessments,
    createRiskAssessment,
    hydrate,
    setPage,
    setPageSize,
    $reset,
  };
});
