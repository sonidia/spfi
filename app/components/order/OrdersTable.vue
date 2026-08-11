<script setup lang="ts">
import { useAutomaticTracking } from "~/composables/useAutomaticTracking";
import type { ShopifyOrder } from "~~/types/shopify";
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

withDefaults(
  defineProps<{
    orders: ShopifyOrder[];
    trackingActions?: boolean;
  }>(),
  { trackingActions: false },
);

const router = useRouter();
const route = useRoute();
const { t } = useLocalization();
const { processingOrderId, canAddTracking, getTransactionStatus, addTracking } =
  useAutomaticTracking();

function orderLocation(orderId: number | string) {
  return {
    path: `/order/${orderId}`,
    query: route.query.shop ? { shop: route.query.shop } : {},
  };
}

function statusLabel(category: string, status: string) {
  return t("a11y.statusWithCategory", { category, status });
}
</script>

<template>
  <div class="orders-table-wrap">
    <table class="orders-table">
      <thead>
        <tr>
          <th>{{ t("order.columnOrder") }}</th>
          <th>{{ t("order.columnDate") }}</th>
          <th>{{ t("order.columnCustomer") }}</th>
          <th>{{ t("order.columnTotal") }}</th>
          <th>{{ t("order.columnFinancial") }}</th>
          <th>{{ t("order.columnTransaction") }}</th>
          <th>{{ t("order.columnFulfillment") }}</th>
          <th>{{ t("order.columnDelivery") }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(order, index) in orders"
          :key="order.id || index"
          class="order-row"
          @click="router.push(orderLocation(order.id))"
        >
          <td>
            <NuxtLink :to="orderLocation(order.id)" class="order-link" @click.stop>
              {{ nilVal(order.name, `#${order.order_number}`) }}
            </NuxtLink>
          </td>
          <td>{{ fmtDateTime(order.created_at) || "—" }}</td>
          <td>{{ getCustomerName(order) || "—" }}</td>
          <td class="money-cell">
            {{
              fmtMoney(
                nilVal(order.total_price, nilVal(order.current_total_price, "0.00")),
                nilVal(order.currency, "CAD"),
              )
            }}
          </td>
          <td>
            <span
              v-if="order.financial_status"
              class="badge"
              :class="financialBadge(order.financial_status)?.cls"
              :aria-label="
                statusLabel(
                  t('order.statusFinancial'),
                  financialBadge(order.financial_status)?.label || '',
                )
              "
            >
              {{ financialBadge(order.financial_status)?.label }}
            </span>
            <span v-else>—</span>
          </td>
          <td>
            <span
              v-if="getTransactionStatus(order.id)"
              class="badge"
              :class="transactionBadge(getTransactionStatus(order.id))?.cls"
              :aria-label="
                statusLabel(
                  t('order.statusTransaction'),
                  transactionBadge(getTransactionStatus(order.id))?.label || '',
                )
              "
            >
              {{ transactionBadge(getTransactionStatus(order.id))?.label }}
            </span>
            <span v-else>—</span>
          </td>
          <td>
            <span
              class="badge"
              :class="fulfillmentBadge(order.fulfillment_status).cls"
              :aria-label="
                statusLabel(
                  t('order.statusFulfillment'),
                  fulfillmentBadge(order.fulfillment_status).label,
                )
              "
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
                <BasePopover align="right" position="top" role="dialog">
                  <template #trigger="{ triggerProps }">
                    <button
                      v-bind="triggerProps"
                      type="button"
                      class="delivery-status-trigger"
                      :aria-label="
                        statusLabel(
                          t('order.statusDelivery'),
                          getShipmentLabel(order.fulfillments[0].shipment_status),
                        )
                      "
                    >
                      <span
                        class="badge"
                        :class="
                          order.fulfillments[0].shipment_status === 'delivered'
                            ? 'badge-paid'
                            : 'badge-pending'
                        "
                        aria-hidden="true"
                      >
                        {{ getShipmentLabel(order.fulfillments[0].shipment_status) }}
                      </span>
                      <span class="hover-arrow" aria-hidden="true">›</span>
                    </button>
                  </template>
                  <template #default>
                    <div class="fulfillment-popover" @click.stop>
                      <div class="popover-line">
                        <span class="popover-lbl">{{ t("order.detailId") }}</span>
                        <span class="popover-val">{{ order.fulfillments[0].id }}</span>
                      </div>
                      <div class="popover-line">
                        <span class="popover-lbl">{{ t("order.detailCompany") }}</span>
                        <span class="popover-val">
                          {{ order.fulfillments[0].tracking_company || "—" }}
                        </span>
                      </div>
                      <div class="popover-line">
                        <span class="popover-lbl">{{ t("order.detailTracking") }}</span>
                        <span class="popover-val">
                          <a
                            v-if="
                              getSafeExternalUrl(order.fulfillments[0].tracking_url)
                            "
                            :href="
                              getSafeExternalUrl(order.fulfillments[0].tracking_url) ||
                              undefined
                            "
                            target="_blank"
                            rel="noopener noreferrer"
                            class="order-link"
                          >
                            {{ order.fulfillments[0].tracking_number }}
                          </a>
                          <span v-else>
                            {{ order.fulfillments[0].tracking_number || "—" }}
                          </span>
                        </span>
                      </div>
                      <div class="popover-line border-top">
                        <span class="popover-lbl">{{ t("order.detailCreated") }}</span>
                        <span class="popover-val">
                          {{ fmtDateTime(order.fulfillments[0].created_at) }}
                        </span>
                      </div>
                    </div>
                  </template>
                </BasePopover>
              </div>
              <button
                v-if="trackingActions && canAddTracking(order)"
                type="button"
                class="btn-add-track"
                :class="{ 'is-loading': processingOrderId === order.id }"
                :disabled="processingOrderId !== null"
                :aria-busy="processingOrderId === order.id"
                @click.stop="addTracking(order)"
              >
                <IconsAdd aria-hidden="true" />
                {{
                  processingOrderId === order.id
                    ? t("order.addingTracking")
                    : t("order.addTracking")
                }}
              </button>
              <span
                v-if="
                  !order.fulfillments?.[0]?.shipment_status &&
                  (!trackingActions || !canAddTracking(order))
                "
              >
                —
              </span>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.orders-table-wrap {
  width: 100%;
  overflow-x: auto;
}

.orders-table {
  width: 100%;
  min-width: 1040px;
  border-collapse: separate;
  border-spacing: 0;
  text-align: left;
  background: var(--surface);
}

.orders-table th,
.orders-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
}

.orders-table th {
  background: var(--surface-soft);
  color: var(--text-sub);
  font-size: 13px;
  font-weight: 600;
}

.orders-table td {
  color: var(--text);
  font-size: 13px;
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

.money-cell {
  font-weight: 500;
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

.badge-pending,
.badge-partial {
  background: var(--badge-pending);
  color: var(--badge-pending-text);
}

.badge-unfulfilled {
  background: var(--surface-soft);
  color: var(--text-sub);
}

.delivery-actions,
.delivery-cell,
.delivery-status-trigger {
  display: flex;
  align-items: center;
}

.delivery-actions {
  gap: 8px;
  white-space: nowrap;
}

.delivery-status-trigger {
  gap: 4px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
}

.delivery-status-trigger:focus-visible {
  outline: 2px solid var(--green);
  outline-offset: 3px;
  border-radius: 20px;
}

.hover-arrow {
  color: var(--text-sub);
  font-size: 18px;
  line-height: 1;
}

.fulfillment-popover {
  min-width: 220px;
  padding: 12px;
}

.popover-line {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 4px 0;
  font-size: 12px;
}

.popover-line.border-top {
  margin-top: 6px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
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

.btn-add-track {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 28px;
  padding: 0 8px;
  border: 1px solid var(--green);
  border-radius: 6px;
  background: transparent;
  color: var(--green);
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

.btn-add-track:disabled {
  cursor: wait;
  opacity: 0.6;
}
</style>
