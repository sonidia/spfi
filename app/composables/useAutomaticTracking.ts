import { computed, ref } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useOrderApi } from "~/composables/useOrderApi";
import { useCredentialVaultStore } from "~/stores/credentialVault";
import { useOrderStore } from "~/stores/order";
import { usePaymentStore } from "~/stores/payment";
import { useToastStore } from "~/stores/toast";
import type {
  ShopifyAddress,
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
import { TRACKTACO_CARRIER_NAMES, TRACKTACO_TRACKING_URLS } from "~~/utils/tracktaco";

const TRACKING_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
const TRACKING_CARRIER = "fedex" as const;

export function useAutomaticTracking() {
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

    if (!credentialVault.trackingSettings.apiKey) {
      toast.warning("Tracktaco v2 is not configured. Add an API key in Settings.");
      return;
    }

    processingOrderId.value = order.id;
    toast.info(`Adding tracking for ${orderLabel(order)}...`);

    try {
      const tracking = await requestTrackingNumber(order);
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
            number: tracking.trackingNumber,
            company: TRACKTACO_CARRIER_NAMES[tracking.carrier],
            url: `${TRACKTACO_TRACKING_URLS[tracking.carrier]}${encodeURIComponent(
              tracking.trackingNumber,
            )}`,
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
          `Tracking added (${tracking.trackingNumber}), but the order list could not be fully refreshed.`,
        );
      } else {
        toast.success(`Tracking added successfully (${tracking.trackingNumber}).`);
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
    const now = Date.now();
    const body: TrackingNumberProxyRequest = {
      carrier: TRACKING_CARRIER,
      destination: resolveTrackingDestination(order),
      shippedBetween: {
        from: formatIsoDate(now - TRACKING_LOOKBACK_MS),
        to: formatIsoDate(now),
      },
      provider: {
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
    const trackingNumber = String(response.trackingNumber || "").trim();

    if (!trackingNumber) {
      throw new Error("The tracking provider returned an empty number.");
    }

    return { ...response, trackingNumber };
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

function resolveTrackingDestination(order: ShopifyOrder) {
  const address: ShopifyAddress =
    order.shipping_address ||
    order.billing_address ||
    order.customer?.default_address ||
    {};

  return {
    country: String(address.country_code || "")
      .trim()
      .toUpperCase(),
    state: String(address.province_code || "")
      .trim()
      .toUpperCase(),
    city: String(address.city || "").trim(),
  };
}

function formatIsoDate(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function orderLabel(order: ShopifyOrder) {
  return order.name || `#${order.order_number}`;
}
