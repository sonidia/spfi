import { computed, ref } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useOrderApi } from "~/composables/useOrderApi";
import { useCredentialVaultStore } from "~/stores/credentialVault";
import { useOrderStore } from "~/stores/order";
import { usePaymentStore } from "~/stores/payment";
import { useToastStore } from "~/stores/toast";
import type {
  ShopifyFulfillmentOrder,
  ShopifyNumericId,
  ShopifyOrder,
} from "~~/types/shopify";
import type {
  TrackingNumberProxyRequest,
  TrackingNumberResponse,
} from "~~/types/tracking";
import { getAppErrorMessage } from "~~/utils/error";
import { buildOrderTransactionStatusMap } from "~~/utils/payment-transactions";
import { markStoreResourceLoaded } from "~~/utils/store-resource-cache";

const TRACKING_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_TRACKING_STATE = "CA";
const TRACKING_CARRIER = "fedex";

export function useAutomaticTracking() {
  const appConfig = useAppConfig();
  const credentialVault = useCredentialVaultStore();
  const orderApi = useOrderApi();
  const orderStore = useOrderStore();
  const paymentStore = usePaymentStore();
  const toast = useToastStore();
  const { storeId, token, isReady } = useActiveShopAuth();
  const processingOrderId = ref<ShopifyNumericId | null>(null);
  const transactionStatusByOrderId = computed(() =>
    buildOrderTransactionStatusMap(paymentStore.balanceTransactions),
  );

  function canAddTracking(order: ShopifyOrder) {
    return (
      getTransactionStatus(order.id) === "in_transit" &&
      order.fulfillment_status !== "fulfilled"
    );
  }

  function getTransactionStatus(orderId: number | string | null | undefined) {
    return orderId
      ? transactionStatusByOrderId.value.get(String(orderId)) || null
      : null;
  }

  async function addTracking(order: ShopifyOrder) {
    if (processingOrderId.value !== null) return;

    if (!isReady.value) {
      toast.error("Store ID or Access Token is missing. Please select a store first.");
      return;
    }

    if (orderStore.isMutating) {
      toast.warning("Another order update is already in progress.");
      return;
    }

    if (
      !credentialVault.trackingSettings.baseUrl ||
      !credentialVault.trackingSettings.apiKey
    ) {
      toast.warning(
        "Tracktaco is not configured. Add the endpoint and API key in Settings.",
      );
      return;
    }

    processingOrderId.value = order.id;
    toast.info(`Adding tracking for ${orderLabel(order)}...`);

    try {
      const trackingNumber = await requestTrackingNumber(order);
      const fulfillmentOrder = await getOpenFulfillmentOrder(order);
      const fulfillmentLineItems = (fulfillmentOrder.line_items || [])
        .map((lineItem) => ({
          id: lineItem.id,
          quantity: Math.floor(lineItem.fulfillable_quantity ?? lineItem.quantity),
        }))
        .filter((lineItem) => lineItem.quantity > 0);

      if (!fulfillmentLineItems.length) {
        throw new Error("The open fulfillment order has no fulfillable line items.");
      }

      const updatedOrder = await orderStore.fulfillOrder(
        storeId.value,
        token.value,
        order.id,
        {
          notify_customer: true,
          line_items_by_fulfillment_order: [
            {
              fulfillment_order_id: fulfillmentOrder.id,
              fulfillment_order_line_items: fulfillmentLineItems,
            },
          ],
          tracking_info: {
            number: trackingNumber,
            company: String(appConfig.tracking.company || TRACKING_CARRIER),
            url: `${appConfig.tracking.url}${encodeURIComponent(trackingNumber)}`,
          },
        },
      );

      if (!updatedOrder) {
        throw new Error(
          orderStore.mutationError || "Shopify did not return the updated order.",
        );
      }

      await orderStore.fetchAll(storeId.value, token.value, true);

      if (!orderStore.error) {
        markStoreResourceLoaded(storeId.value, "orders");
      }
      if (orderStore.error || paymentStore.error) {
        toast.warning(
          `Tracking added (${trackingNumber}), but the order list could not be fully refreshed.`,
        );
      } else {
        toast.success(`Tracking added successfully (${trackingNumber}).`);
      }
    } catch (error) {
      toast.error(
        `Failed to add tracking: ${getAppErrorMessage(error, "Unknown error")}`,
      );
    } finally {
      processingOrderId.value = null;
    }
  }

  async function requestTrackingNumber(order: ShopifyOrder) {
    const to = Date.now();
    const body: TrackingNumberProxyRequest = {
      state: resolveTrackingState(order),
      from: to - TRACKING_LOOKBACK_MS,
      to,
      carrier: TRACKING_CARRIER,
      provider: {
        baseUrl: credentialVault.trackingSettings.baseUrl,
        apiKey: credentialVault.trackingSettings.apiKey,
      },
    };
    const response = await $fetch<TrackingNumberResponse>(
      "/api/tracktaco/get-trackingnr",
      {
        method: "POST",
        body,
      },
    );
    const trackingNumber = String(response.trackingNr || "").trim();

    if (!trackingNumber) {
      throw new Error("The tracking provider returned an empty number.");
    }

    return trackingNumber;
  }

  async function getOpenFulfillmentOrder(order: ShopifyOrder) {
    const response = await orderApi.getFulfillmentOrders(
      { storeId: storeId.value, token: token.value },
      order.id,
    );
    const fulfillmentOrder = (response.fulfillment_orders || []).find(
      isOpenAndFulfillable,
    );

    if (!fulfillmentOrder) {
      throw new Error("No open fulfillment order was found for this order.");
    }

    return fulfillmentOrder;
  }

  return {
    processingOrderId,
    canAddTracking,
    getTransactionStatus,
    addTracking,
  };
}

function isOpenAndFulfillable(order: ShopifyFulfillmentOrder) {
  return (
    (order.status === "open" || order.status === "in_progress") &&
    (order.line_items || []).some(
      (lineItem) => (lineItem.fulfillable_quantity ?? lineItem.quantity) > 0,
    )
  );
}

function resolveTrackingState(order: ShopifyOrder) {
  return String(
    order.shipping_address?.province_code ||
      order.billing_address?.province_code ||
      order.customer?.default_address?.province_code ||
      DEFAULT_TRACKING_STATE,
  )
    .trim()
    .toUpperCase();
}

function orderLabel(order: ShopifyOrder) {
  return order.name || `#${order.order_number}`;
}
