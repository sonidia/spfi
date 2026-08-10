<template>
  <div class="orders-tab">
    <div class="orders-toolbar">
      <div>
        <strong>{{ orderStore.orderCount || orderStore.orders.length }}</strong>
        <span>total orders</span>
      </div>
      <button type="button" @click="isCreateOpen = true">
        <IconsAdd />
        Create order
      </button>
    </div>

    <div v-if="orderStore.isLoading && !orderStore.orders.length" class="empty">
      Loading orders…
    </div>
    <div v-else-if="orderStore.error" class="empty" style="color: red">
      {{ orderStore.error }}
    </div>
    <template v-else>
      <p
        v-if="orderStore.orderCount > orderStore.orders.length"
        class="orders-limit-note"
        role="status"
      >
        Showing {{ orderStore.orders.length }} loaded orders out of
        {{ orderStore.orderCount }}. Older orders are not included in this
        client-side page set.
      </p>
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
            v-for="(order, index) in paginatedOrders"
            :key="order.id || index"
            @click="router.push(orderLocation(order.id))"
            class="order-row"
          >
            <td>
              <NuxtLink :to="orderLocation(order.id)" class="order-link">
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
              <div class="delivery-actions">
                <div
                  v-if="order.fulfillments?.[0]?.shipment_status"
                  class="delivery-cell"
                >
                  <BasePopover align="right" position="top">
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
                              v-if="getSafeExternalUrl(order.fulfillments[0].tracking_url)"
                              :href="getSafeExternalUrl(order.fulfillments[0].tracking_url) || undefined"
                              target="_blank"
                              rel="noopener noreferrer"
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
                  </BasePopover>
                </div>
                <button
                  v-if="canAddTracking(order)"
                  type="button"
                  class="btn-add-track"
                  :class="{
                    'is-loading': processingOrderId === order.id,
                  }"
                  :disabled="processingOrderId !== null"
                  :aria-busy="processingOrderId === order.id"
                  @click.stop="addTracking(order)"
                >
                  <IconsAdd />
                  {{
                    processingOrderId === order.id ? "Adding..." : "Add track"
                  }}
                </button>
                <span
                  v-if="
                    !order.fulfillments?.[0]?.shipment_status &&
                    !canAddTracking(order)
                  "
                >
                  —
                </span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <PaginationControls
        v-if="orderStore.orders.length"
        :page="orderStore.currentPage"
        :page-size="orderStore.pageSize"
        :total-items="orderStore.orders.length"
        item-label="orders"
        @update:page="orderStore.setPage"
        @update:page-size="orderStore.setPageSize"
      />
      <div v-if="orderStore.orders.length === 0" class="empty">
        No orders found.
      </div>
    </template>
    <OrderCreateModal
      v-if="isCreateOpen"
      @close="isCreateOpen = false"
      @created="refreshCount"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useAutomaticTracking } from "~/composables/useAutomaticTracking";
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
import { getSafeExternalUrl } from "~~/utils/safe-url";

const orderStore = useOrderStore();
const router = useRouter();
const route = useRoute();
const { storeId, token, isReady } = useActiveShopAuth();
const { processingOrderId, canAddTracking, getTransactionStatus, addTracking } =
  useAutomaticTracking();
const isCreateOpen = ref(false);
const totalPages = computed(() =>
  Math.max(1, Math.ceil(orderStore.orders.length / orderStore.pageSize)),
);
const paginatedOrders = computed(() => {
  const page = Math.min(orderStore.currentPage, totalPages.value);
  const start = (page - 1) * orderStore.pageSize;
  return orderStore.orders.slice(start, start + orderStore.pageSize);
});

watch(totalPages, (pageCount) => {
  if (orderStore.currentPage > pageCount) {
    orderStore.setPage(pageCount);
  }
});

function orderLocation(orderId: number | string) {
  return {
    path: `/order/${orderId}`,
    query: route.query.shop ? { shop: route.query.shop } : {},
  };
}

async function refreshCount() {
  if (!isReady.value) return;
  await orderStore.fetchCount(storeId.value, token.value, { status: "any" });
}

onMounted(refreshCount);

watch(storeId, refreshCount);
</script>

<style scoped>
.orders-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 52px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.orders-toolbar > div {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.orders-toolbar strong {
  color: var(--text);
  font-size: 15px;
}

.orders-toolbar span {
  color: var(--text-sub);
  font-size: 12px;
}

.orders-toolbar button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 0 12px;
  border: 0;
  border-radius: 6px;
  background: var(--green);
  color: white;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.orders-limit-note {
  margin: 0;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--yellow-soft, #fff8e1);
  color: var(--text-sub);
  font-size: 12px;
}

.delivery-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
</style>
