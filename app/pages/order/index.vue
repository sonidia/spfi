<template>
  <NuxtLayout name="shop">
    <template #title>
      <span class="page-title">Orders</span>
    </template>

    <div class="page" id="app">
      <!-- Loading state -->
      <div v-if="orderStore.isLoading" id="loading">Loading order...</div>
      <div v-else-if="orderStore.error" id="loading" style="color: red">
        {{ orderStore.error }}
      </div>

      <!-- ════════════════════════════════════════ SCREEN: LIST -->
      <div v-else>
        <div class="page-meta">
          {{ orders.length }} order{{ orders.length !== 1 ? "s" : "" }}
        </div>
        <div class="card table-card">
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
                v-for="(order, index) in orders"
                :key="order.id || index"
                @click="$router.push(`/order/${order.id}`)"
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
                    :class="
                      transactionBadge(getTransactionStatus(order.id))?.cls
                    "
                  >
                    {{
                      transactionBadge(getTransactionStatus(order.id))?.label
                    }}
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
                              order.fulfillments[0].shipment_status ===
                              'delivered'
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
                  <div v-if="getTransactionStatus(order.id) === 'in_transit' && order.fulfillment_status !== 'fulfilled'">
                    <button
                      class="btn-add-track"
                      @click.stop="addTracking(order)"
                    >
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
        </div>
      </div>
    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useFormStore } from "~/stores/form";
import { useOrderStore } from "~/stores/order";
import { usePaymentStore } from "~/stores/payment";
import {
  financialBadge,
  fmtDateTime,
  fmtMoney,
  fulfillmentBadge,
  getCustomerName,
  getShipmentLabel,
  nilVal,
  transactionBadge,
} from "~~/utils/order";

definePageMeta({ layout: false });

// ── Store ──────────────────────────────────────────────────────────────────
const orderStore = useOrderStore();
const paymentStore = usePaymentStore();
const formStore = useFormStore();

const orders = computed(() => orderStore.orders);
const config = useRuntimeConfig();

function getTransactionStatus(orderId: any) {
  if (!orderId) return null;
  const tx = paymentStore.balanceTransactions.find(
    (t: any) => String(t.source_order_id) === String(orderId),
  );
  return tx?.payout_status || null;
}

// ── Data loading ──────────────────────────────────────────────────────────────
onMounted(() => {
  // If we already have data, just clear any leftover error
  if (orderStore.orders.length) {
    orderStore.error = null;
  }

  // Fetch transactions if we have storeId
  const sid = formStore.storeId;
  if (sid) {
    const cookie = useCookie<any>(sid);
    const token = cookie.value?.accessToken;
    if (token) {
      paymentStore.fetchBalanceTransactions(sid, token);
    }
  }
});

async function addTracking(order: any) {
  const sid = formStore.storeId;
  const cookie = sid ? useCookie<any>(sid) : null;
  const token = cookie?.value?.accessToken;

  if (!sid || !token) {
    alert("Error: Store ID or Access Token is missing. Please select a store first.");
    return;
  }

  const provinceCode = order.customer?.default_address?.province_code || "CA";
  const fulfillmentId = order.fulfillments?.[0]?.id;

  try {
    // 1. Get tracking number from our local proxy API
    const tracktacoRes = await $fetch<any>(
      "/api/tracktaco/get-trackingnr",
      {
        method: "POST",
        body: {
          state: provinceCode,
          from: 1778150769166,
          to: 1778237169166,
          carrier: "fedex",
        },
      },
    );

    const trackingNr = tracktacoRes.trackingNr;
    if (!trackingNr) {
      throw new Error("No tracking number returned from Tracktaco");
    }

    // 2. Get fulfillment order ID
    const foRes = await $fetch<any>(`/api/order/${order.id}/fulfillment_orders`, {
      method: "GET",
      params: { storeId: sid, token: token },
    });
    
    // Find an open or in_progress fulfillment order
    const openFO = foRes.fulfillment_orders?.find(
      (fo: any) => fo.status === "open" || fo.status === "in_progress"
    );

    if (!openFO) {
      throw new Error("No open fulfillment order found for this order.");
    }

    // 3. Prepare payload for fulfillment creation
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

    // 4. Call API to CREATE fulfillment
    const response = await $fetch<any>(`/api/order/${order.id}/fulfill`, {
      method: "POST",
      body: payload,
    });

    console.log("Tracking updated/created:", response);
    
    // 3. Refresh orders to show new status/tracking
    await orderStore.fetchAll(sid, token);
    
    alert(`Tracking updated successfully! (${trackingNr})`);
  } catch (err: any) {
    console.error("Failed to update tracking:", err);
    const msg = err.data?.message || err.message || "Unknown error";
    alert(`Failed to update tracking: ${msg}`);
  }
}
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}
.page-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text);
}
.page-meta {
  font-size: 13px;
  color: var(--text-sub);
  margin-bottom: 20px;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}
.badge::before {
  content: "•";
  font-size: 16px;
  line-height: 1;
}
.badge-paid {
  background: var(--badge-paid);
  color: var(--badge-paid-text);
}
.badge-fulfilled {
  background: var(--badge-fulfilled);
  color: var(--badge-fulfilled-text);
}
.badge-archived {
  background: var(--badge-archived);
  color: var(--badge-archived-text);
}
.badge-cancelled {
  background: var(--badge-cancelled);
  color: var(--badge-cancelled-text);
}
.badge-pending {
  background: var(--badge-pending);
  color: var(--badge-pending-text);
}
.badge-partial {
  background: #fff3cd;
  color: #856404;
}
.badge-unfulfilled {
  background: #f1f2f4;
  color: #6d7175;
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
}

.delivery-cell {
  display: flex;
  align-items: center;
}

.delivery-status-trigger {
  display: flex;
  align-items: center;
  gap: 4px;
}

.hover-arrow {
  display: inline-flex;
  align-items: center;
  color: var(--text-sub);
  transition: opacity 0.2s ease;
  rotate: 90deg;
}

.fulfillment-popover {
  padding: 12px;
  min-width: 220px;
}

.popover-line {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  font-size: 12px;
  padding: 4px 0;
}

.popover-line.border-top {
  border-top: 1px solid var(--border);
  margin-top: 6px;
  padding-top: 8px;
}

.popover-lbl {
  color: var(--text-sub);
  font-weight: 500;
}

.popover-val {
  color: var(--text);
  font-weight: 600;
  text-align: right;
}

.left-col .card + .card {
  margin-top: 16px;
}

.card-header {
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border-bottom: 1px solid var(--border);
}

.table-card {
  border-radius: var(--radius);
  overflow: visible !important;
}

.orders-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  text-align: left;
  background: var(--surface);
}

.orders-table th:first-child {
  border-top-left-radius: var(--radius);
}
.orders-table th:last-child {
  border-top-right-radius: var(--radius);
}
.orders-table tr:last-child td:first-child {
  border-bottom-left-radius: var(--radius);
}
.orders-table tr:last-child td:last-child {
  border-bottom-right-radius: var(--radius);
}

.orders-table th {
  padding: 12px 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-sub);
  background: #f9f9fa;
  border-bottom: 1px solid var(--border);
}

.orders-table td {
  padding: 12px 16px;
  font-size: 13px;
  color: var(--text);
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
}

.order-row {
  cursor: pointer;
  transition: background 0.15s ease;
}

.order-row:hover {
  background: #f8f9fa;
}

.order-link {
  color: var(--text-link);
  font-weight: 600;
  text-decoration: none;
}

.order-link:hover {
  text-decoration: underline;
}

.card-title {
  font-weight: 600;
  font-size: 14px;
}

.sidebar-body {
  padding: 14px 16px;
}
.sidebar-value {
  font-size: 13px;
  color: var(--text);
  line-height: 1.6;
}

#loading {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-sub);
  font-size: 15px;
}

.btn-add-track {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-link);
  cursor: pointer;
  transition: all 0.15s ease;
}
.btn-add-track:hover {
  background: #f8f9fa;
  border-color: var(--text-link);
}

.order-card:hover {
  background: #f8f9fa;
}
</style>
