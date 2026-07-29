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
                v-for="(order, index) in paginatedOrders"
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
                    <BasePopover align="right" position="top">
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
                    </BasePopover>
                  </div>
                  <span v-else-if="!order.fulfillments?.[0]?.shipment_status"
                    >—</span
                  >
                </td>
              </tr>
            </tbody>
          </table>
          <PaginationControls
            v-if="orders.length"
            :page="orderStore.currentPage"
            :page-size="orderStore.pageSize"
            :total-items="orders.length"
            item-label="orders"
            @update:page="orderStore.setPage"
            @update:page-size="orderStore.setPageSize"
          />
        </div>
      </div>
    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { computed, watch } from "vue";
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

const orderStore = useOrderStore();
const paymentStore = usePaymentStore();

const orders = computed(() => orderStore.orders);
const totalPages = computed(() =>
  Math.max(1, Math.ceil(orders.value.length / orderStore.pageSize)),
);
const paginatedOrders = computed(() => {
  const page = Math.min(orderStore.currentPage, totalPages.value);
  const start = (page - 1) * orderStore.pageSize;
  return orders.value.slice(start, start + orderStore.pageSize);
});

watch(totalPages, (pageCount) => {
  if (orderStore.currentPage > pageCount) {
    orderStore.setPage(pageCount);
  }
});

function getTransactionStatus(orderId: number | string | null | undefined) {
  if (!orderId) return null;
  const tx = paymentStore.balanceTransactions.find(
    (transaction) => String(transaction.source_order_id) === String(orderId),
  );
  return tx?.payout_status || null;
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
  font-size: 1.2rem;
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
  background: var(--amber-soft);
  color: var(--amber);
}
.badge-unfulfilled {
  background: var(--surface-soft);
  color: var(--text-sub);
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
  background: var(--surface-soft);
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
  background: var(--surface-soft);
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

.order-card:hover {
  background: var(--surface-soft);
}
</style>
