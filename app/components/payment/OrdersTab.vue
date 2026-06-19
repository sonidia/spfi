<template>
  <div class="orders-tab">
    <div v-if="orderStore.isLoading && !orderStore.orders.length" class="empty">
      Loading orders…
    </div>
    <div v-else-if="orderStore.error" class="empty" style="color: red">
      {{ orderStore.error }}
    </div>
    <template v-else>
      <table class="orders-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Date</th>
            <th>Customer</th>
            <th>Total</th>
            <th>Financial status</th>
            <th>Transaction status</th>
            <th>Fulfillment status</th>
            <th>Delivery status</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(order, index) in orderStore.orders"
            :key="order.id || index"
            @click="router.push(`/order/${order.id}`)"
            class="order-row"
          >
            <td>
              <NuxtLink :to="`/order/${order.id}`" class="order-link">
                {{ nilVal(order.name, "#" + order.order_number) }}
              </NuxtLink>
            </td>
            <td>
              {{ fmtDateTime(order.created_at) || "—" }}
            </td>
            <td>
              {{ getCustomerName(order) || "—" }}
            </td>
            <td style="font-weight: 500">
              {{
                fmtMoney(
                  nilVal(
                    order.total_price,
                    nilVal(order.current_total_price, "0.00"),
                  ),
                  nilVal(order.currency, "CAD"),
                )
              }}
            </td>
            <td>
              <span
                v-if="order.financial_status"
                class="badge"
                :class="financialBadge(order.financial_status)?.cls"
              >
                {{ financialBadge(order.financial_status)?.label }}
              </span>
            </td>
            <td>
              <span
                v-if="getTransactionStatus(order.id)"
                class="badge"
                :class="transactionBadge(getTransactionStatus(order.id))?.cls"
              >
                {{ transactionBadge(getTransactionStatus(order.id))?.label }}
              </span>
              <span v-else>—</span>
            </td>

            <td>
              <span
                class="badge"
                :class="fulfillmentBadge(order.fulfillment_status).cls"
              >
                {{ fulfillmentBadge(order.fulfillment_status).label }}
              </span>
            </td>
            <td>
              <div
                v-if="order.fulfillments?.[0]?.shipment_status"
                class="delivery-cell"
              >
                <AppPopover align="right" position="top">
                  <template #trigger>
                    <div class="delivery-status-trigger">
                      <span
                        class="badge"
                        :class="
                          order.fulfillments[0].shipment_status === 'delivered'
                            ? 'badge-paid'
                            : 'badge-pending'
                        "
                      >
                        {{
                          getShipmentLabel(
                            order.fulfillments[0].shipment_status,
                          )
                        }}
                      </span>
                      <span class="hover-arrow">
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 20 20"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          style="margin-top: 2px"
                        >
                          <path
                            d="M7 15l5-5-5-5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          />
                        </svg>
                      </span>
                    </div>
                  </template>
                  <template #default>
                    <div class="fulfillment-popover" @click.stop>
                      <div class="popover-line">
                        <span class="popover-lbl">ID:</span>
                        <span class="popover-val">{{
                          order.fulfillments[0].id
                        }}</span>
                      </div>
                      <div class="popover-line">
                        <span class="popover-lbl">Company:</span>
                        <span class="popover-val">{{
                          order.fulfillments[0].tracking_company || "—"
                        }}</span>
                      </div>
                      <div class="popover-line">
                        <span class="popover-lbl">Tracking:</span>
                        <span class="popover-val">
                          <a
                            v-if="order.fulfillments[0].tracking_url"
                            :href="order.fulfillments[0].tracking_url"
                            target="_blank"
                            class="order-link"
                          >
                            {{ order.fulfillments[0].tracking_number }}
                          </a>
                          <span v-else>{{
                            order.fulfillments[0].tracking_number || "—"
                          }}</span>
                        </span>
                      </div>
                      <div class="popover-line border-top">
                        <span class="popover-lbl">Created:</span>
                        <span class="popover-val">{{
                          fmtDateTime(order.fulfillments[0].created_at)
                        }}</span>
                      </div>
                    </div>
                  </template>
                </AppPopover>
              </div>
              <div
                v-if="
                  getTransactionStatus(order.id) === 'in_transit' &&
                  order.fulfillment_status !== 'fulfilled'
                "
              >
                <button 
                  class="btn-add-track" 
                  @click.stop="addTracking(order)"
                  :disabled="processingOrderId === order.id"
                  :class="{ 'is-loading': processingOrderId === order.id }"
                >
                  <span v-html="ICONS.plus"></span>
                  Add track
                </button>
              </div>
              <span v-else-if="!order.fulfillments?.[0]?.shipment_status"
                >—</span
              >
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="orderStore.orders.length === 0" class="empty">
        No orders found.
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import {
  financialBadge,
  fmtDateTime,
  fmtMoney,
  fulfillmentBadge,
  getCustomerName,
  getShipmentLabel,
  ICONS,
  nilVal,
  transactionBadge,
} from "~~/utils/order";

const orderStore = useOrderStore();
const paymentStore = usePaymentStore();
const formStore = useFormStore();
const toastStore = useToastStore();
const router = useRouter();
const processingOrderId = ref<string | null>(null);

function getTransactionStatus(orderId: any) {
  if (!orderId) return null;
  const tx = paymentStore.balanceTransactions.find(
    (t: any) => String(t.source_order_id) === String(orderId),
  );
  return tx?.payout_status || null;
}

function resolveToken(sid: string): string | null {
  const storeCookie = useLocalStorage<any>(sid, {}).state;
  const data = storeCookie.value;
  const now = Date.now();
  if (data?.accessToken && data?.expiresTime && now < data.expiresTime) {
    return data.accessToken;
  }
  return null;
}

async function addTracking(order: any) {
  const sid = formStore.storeId;
  const token = sid ? resolveToken(sid) : null;

  if (!sid || !token) {
    alert(
      "Error: Store ID or Access Token is missing. Please select a store first.",
    );
    return;
  }

  processingOrderId.value = order.id;
  toastStore.addToast(`Adding tracking for order ${order.name || "#" + order.order_number}...`, "info");

  // Priority: 1. Shipping Address, 2. Billing Address, 3. Customer Default Address, 4. Fallback 'CA'
  const provinceCode =
    order.shipping_address?.province_code ||
    order.billing_address?.province_code ||
    order.customer?.default_address?.province_code ||
    "CA";

  try {
    const toTs = Date.now();
    const fromTs = toTs - 7 * 24 * 60 * 60 * 1000; // 7 days ago

    const payloadBody = {
      state: provinceCode,
      from: fromTs,
      to: toTs,
      carrier: "fedex",
    };
    console.log("Requesting trackingnr from Tracktaco:", {
      state: provinceCode,
      from: new Date(fromTs).toLocaleString(),
      to: new Date(toTs).toLocaleString(),
      carrier: "fedex",
    });

    const tracktacoRes = await $fetch<any>("/api/tracktaco/get-trackingnr", {
      method: "POST",
      body: payloadBody,
    });

    const trackingNr = tracktacoRes.trackingNr;
    if (!trackingNr) {
      throw new Error("No tracking number returned from Tracktaco");
    }

    const foRes = await $fetch<any>(
      `/api/order/${order.id}/fulfillment_orders`,
      {
        method: "GET",
        params: { storeId: sid, token: token },
      },
    );

    const openFO = foRes.fulfillment_orders?.find(
      (fo: any) => fo.status === "open" || fo.status === "in_progress",
    );

    if (!openFO) {
      throw new Error("No open fulfillment order found for this order.");
    }

    const payload = {
      storeId: sid,
      token: token,
      fulfillment: {
        line_items_by_fulfillment_order: [
          {
            fulfillment_order_id: openFO.id,
          },
        ],
        tracking_info: {
          number: trackingNr,
          url: `https://www.fedex.com/fedextrack/?trknbr=${trackingNr}`,
        },
      },
    };

    const response = await $fetch<any>(`/api/order/${order.id}/fulfill`, {
      method: "POST",
      body: payload,
    });

    console.log("Tracking updated/created:", response);
    await orderStore.fetchAll(sid, token);

    toastStore.addToast(
      `Tracking updated successfully! (${trackingNr})`,
      "success",
    );
  } catch (err: any) {
    console.error("Failed to update tracking:", err);
    const msg = err.data?.message || err.message || "Unknown error";
    if (err.data) {
      console.error("Detailed error data:", err.data);
    }
    toastStore.addToast(`Failed to update tracking: ${msg}`, "error");
  } finally {
    processingOrderId.value = null;
  }
}

</script>
