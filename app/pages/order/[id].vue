<template>
  <NuxtLayout name="shop">
    <template #title>
      <div class="order-title-row">
        <NuxtLink
          :to="{ path: '/store', query: { ...route.query, tab: 'orders' } }"
          class="order-back-link"
          aria-label="Back to orders"
          title="Back to orders"
        >
          <ArrowLeft :size="16" aria-hidden="true" />
        </NuxtLink>
        <span class="page-title">{{
          nilVal(
            currentOrder?.name,
            currentOrder?.order_number
              ? "#" + currentOrder.order_number
              : "Loading...",
          )
        }}</span>
        <template
          v-for="badge in getOrderBadges(currentOrder)"
          :key="badge.cls + badge.label"
        >
          <span class="badge" :class="badge.cls">{{ badge.label }}</span>
        </template>
      </div>
    </template>

    <div class="page" id="app">
      <!-- Loading state -->
      <div v-if="orderStore.isLoading" id="loading">Loading order...</div>
      <div v-else-if="orderStore.error" id="loading" style="color: red">
        {{ orderStore.error }}
      </div>

      <!-- ════════════════════════════════════════ SCREEN: ORDER DETAIL -->
      <template v-else-if="currentOrder">
        <div class="page-meta">
          {{ fmtDateTime(currentOrder.created_at) || "—" }} from
          {{ getSource(currentOrder) }}
        </div>

        <div class="grid">
          <!-- Left column -->
          <div class="left-col">
            <OrderActionsPanel :order="currentOrder" @deleted="returnToOrders" />
            <OrderFinancialActions :order="currentOrder" />
            <OrderLineItemEditor :order="currentOrder" />
            <OrderFulfillmentPanel :order="currentOrder" />

            <!-- Fulfillments -->
            <template
              v-if="
                currentOrder.fulfillments &&
                currentOrder.fulfillments.length > 0
              "
            >
              <div
                v-for="(f, fi) in currentOrder.fulfillments"
                :key="f.id || fi"
                class="card"
              >
                <div class="card-header">
                  <div class="card-header-left">
                    <span
                      v-if="f.status === 'success'"
                      style="
                        color: var(--green);
                        font-weight: 600;
                        font-size: 14px;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                      "
                    >
                      <span v-html="ICONS.box"></span> Fulfilled
                    </span>
                    <span
                      v-else
                      style="
                        color: var(--text-sub);
                        font-weight: 600;
                        font-size: 14px;
                      "
                    >
                      {{ capitalize(f.status || "") }}
                    </span>
                    <span
                      style="
                        font-size: 13px;
                        color: var(--text-sub);
                        display: flex;
                        align-items: center;
                        gap: 4px;
                      "
                    >
                      <span v-html="ICONS.pin"></span>
                      {{ serviceName(nilVal(f.service, "Manual")) }}
                    </span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 8px">
                    <OrderFulfillmentCancelButton
                      :order-id="currentOrder.id"
                      :fulfillment="f"
                    />
                    <span
                      v-if="nilVal(f.name, '')"
                      style="font-size: 13px; color: var(--text-sub)"
                      >{{ f.name }}</span
                    >
                    <button class="kebab">···</button>
                  </div>
                </div>

                <!-- Tracking block -->
                <div v-if="nilVal(f.shipment_status)" class="tracking-info">
                  <span
                    :class="
                      f.shipment_status === 'delivered'
                        ? 'transit-badge delivered-badge'
                        : 'transit-badge'
                    "
                  >
                    <span v-html="ICONS.truck"></span
                    >{{ getShipmentLabel(f.shipment_status) }}
                  </span>
                  <div v-if="nilVal(f.created_at)" class="tracking-row">
                    <span v-html="ICONS.cal"></span> {{ fmtDate(f.created_at) }}
                  </div>
                  <div v-if="nilVal(f.created_at)" class="tracking-row">
                    <span v-html="ICONS.deliver"></span> Deliver by
                    {{ getDeliverBy(f.created_at) }}
                  </div>
                  <div v-if="nilVal(f.tracking_number)" class="tracking-row">
                    <span v-html="ICONS.link"></span>
                    {{
                      nilVal(f.tracking_company)
                        ? f.tracking_company + " tracking: "
                        : "Tracking: "
                    }}
                    <a :href="nilVal(f.tracking_url) || '#'" target="_blank">{{
                      f.tracking_number
                    }}</a>
                  </div>
                </div>

                <!-- Fulfillment line items -->
                <div
                  v-for="(item, ii) in f.line_items || []"
                  :key="ii"
                  class="line-item"
                >
                  <div class="product-img">📦</div>
                  <div class="product-info">
                    <div class="product-name">
                      {{ item.name || item.title || "—" }}
                    </div>
                    <div
                      v-if="nilVal(item.variant_title)"
                      class="product-variant"
                    >
                      {{ item.variant_title }}
                    </div>
                    <div v-if="nilVal(item.sku)" class="product-sku">
                      {{ item.sku }}
                    </div>
                  </div>
                  <div class="product-price">
                    {{
                      fmtMoney(item.price, nilVal(currentOrder.currency, "CAD"))
                    }}
                    × {{ item.quantity || 1 }}
                  </div>
                  <div class="product-total">
                    {{
                      fmtMoney(
                        (
                          Number(item.price || 0) * (item.quantity || 1)
                        ).toFixed(2),
                        nilVal(currentOrder.currency, "CAD"),
                      )
                    }}
                  </div>
                </div>
              </div>
            </template>

            <!-- Unfulfilled (no fulfillments) -->
            <template v-else>
              <div v-if="(currentOrder.line_items || []).length" class="card">
                <div class="card-header">
                  <div class="card-header-left">
                    <span
                      style="
                        color: var(--text-sub);
                        font-weight: 600;
                        font-size: 14px;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                      "
                    >
                      <span v-html="ICONS.box"></span> Unfulfilled
                    </span>
                  </div>
                </div>
                <div
                  v-for="(item, ii) in currentOrder.line_items || []"
                  :key="ii"
                  class="line-item"
                >
                  <div class="product-img">📦</div>
                  <div class="product-info">
                    <div class="product-name">
                      {{ item.name || item.title || "—" }}
                    </div>
                    <div
                      v-if="nilVal(item.variant_title)"
                      class="product-variant"
                    >
                      {{ item.variant_title }}
                    </div>
                    <div v-if="nilVal(item.sku)" class="product-sku">
                      {{ item.sku }}
                    </div>
                  </div>
                  <div class="product-price">
                    {{
                      fmtMoney(item.price, nilVal(currentOrder.currency, "CAD"))
                    }}
                    × {{ item.quantity || 1 }}
                  </div>
                  <div class="product-total">
                    {{
                      fmtMoney(
                        (
                          Number(item.price || 0) * (item.quantity || 1)
                        ).toFixed(2),
                        nilVal(currentOrder.currency, "CAD"),
                      )
                    }}
                  </div>
                </div>
              </div>
            </template>

            <!-- Payment card -->
            <div class="card">
              <div class="card-header">
                <div class="card-header-left">
                  <span style="color: var(--green)" v-html="ICONS.card"></span>
                  <span class="card-title" style="color: var(--green)"
                    >Paid</span
                  >
                </div>
              </div>
              <div class="payment-rows">
                <div class="payment-row">
                  <span
                    >Subtotal
                    <span style="font-size: 12px; color: var(--text-sub)"
                      >{{ getItemCount(currentOrder) }} item{{
                        getItemCount(currentOrder) !== 1 ? "s" : ""
                      }}</span
                    ></span
                  >
                  <span>{{
                    fmtMoney(
                      getSubtotal(currentOrder),
                      nilVal(currentOrder.currency, "CAD"),
                    )
                  }}</span>
                </div>
                <div
                  v-if="parseFloat(getDiscount(currentOrder)) > 0"
                  class="payment-row"
                >
                  <span>Discount</span>
                  <span
                    >-{{
                      fmtMoney(
                        getDiscount(currentOrder),
                        nilVal(currentOrder.currency, "CAD"),
                      )
                    }}</span
                  >
                </div>
                <div class="payment-row">
                  <span
                    >Shipping
                    <span style="font-size: 12px; color: var(--text-sub)">{{
                      nilVal(
                        currentOrder.shipping_lines?.[0]?.title,
                        "Shipping",
                      )
                    }}</span></span
                  >
                  <span>{{
                    fmtMoney(
                      nilVal(
                        currentOrder.total_shipping_price_set?.shop_money
                          ?.amount,
                        "0.00",
                      ),
                      nilVal(currentOrder.currency, "CAD"),
                    )
                  }}</span>
                </div>
                <div
                  v-if="parseFloat(getTax(currentOrder)) > 0"
                  class="payment-row"
                >
                  <span>Tax</span>
                  <span>{{
                    fmtMoney(
                      getTax(currentOrder),
                      nilVal(currentOrder.currency, "CAD"),
                    )
                  }}</span>
                </div>
                <div class="payment-row total">
                  <span>Total</span>
                  <span>{{
                    fmtMoney(
                      nilVal(
                        currentOrder.total_price,
                        nilVal(currentOrder.current_total_price, "0.00"),
                      ),
                      nilVal(currentOrder.currency, "CAD"),
                    )
                  }}</span>
                </div>
                <div class="payment-row paid-row">
                  <span><span class="paid-badge-inline">Paid</span></span>
                  <span>{{
                    fmtMoney(
                      nilVal(
                        currentOrder.total_price,
                        nilVal(currentOrder.current_total_price, "0.00"),
                      ),
                      nilVal(currentOrder.currency, "CAD"),
                    )
                  }}</span>
                </div>
              </div>
            </div>

            <!-- Timeline -->
            <div class="card timeline-card">
              <OrderTransactions :order="currentOrder" />
            </div>
          </div>

          <!-- Sidebar -->
          <div class="sidebar">
            <OrderRiskPanel :order-id="currentOrder.id" />

            <!-- Notes (only if there is a note) -->
            <div v-if="nilVal(currentOrder.note)" class="card">
              <div class="card-header">
                <div class="card-title-row"><FileText class="card-title-icon" aria-hidden="true" /><span class="card-title">Notes</span></div>
                <button class="icon-btn" v-html="ICONS.edit"></button>
              </div>
              <div class="sidebar-body">
                <span class="sidebar-value">{{ currentOrder.note }}</span>
              </div>
            </div>

            <!-- Customer -->
            <div class="card">
              <div class="card-header">
                <div class="card-title-row"><User class="card-title-icon" aria-hidden="true" /><span class="card-title">Customer</span></div>
                <button class="icon-btn" v-html="ICONS.dots"></button>
              </div>
              <div class="sidebar-body">
                <div class="sidebar-section">
                  <a
                    v-if="getCustomerName(currentOrder)"
                    href="#"
                    class="sidebar-link"
                    style="font-weight: 500"
                    >{{ getCustomerName(currentOrder) }}</a
                  >
                  <span v-else class="sidebar-sub">Guest</span>
                  <div class="sidebar-sub" style="margin-top: 2px">
                    {{ nilVal(currentOrder.customer?.orders_count, 1) }} order{{
                      nilVal(currentOrder.customer?.orders_count, 1) !== 1
                        ? "s"
                        : ""
                    }}
                  </div>
                </div>
                <div class="sidebar-section">
                  <div class="sidebar-label">Contact information</div>
                  <a
                    v-if="getCustomerEmail(currentOrder)"
                    :href="'mailto:' + getCustomerEmail(currentOrder)"
                    class="sidebar-link"
                    >{{ getCustomerEmail(currentOrder) }}</a
                  >
                  <div v-else class="sidebar-sub">No email</div>
                  <div class="sidebar-sub" style="margin-top: 2px">
                    {{
                      nilVal(currentOrder.customer?.phone) ||
                      nilVal(currentOrder.phone) ||
                      "No phone number"
                    }}
                  </div>
                </div>
                <div
                  v-if="currentOrder.shipping_address"
                  class="sidebar-section"
                >
                  <div class="sidebar-label">Shipping address</div>
                  <div
                    class="sidebar-value"
                    v-html="formatAddress(currentOrder.shipping_address)"
                  ></div>
                  <a
                    v-if="currentOrder.shipping_address.latitude != null"
                    :href="`https://maps.google.com/?q=${currentOrder.shipping_address.latitude},${currentOrder.shipping_address.longitude}`"
                    target="_blank"
                    class="sidebar-link"
                    style="display: inline-block; margin-top: 4px"
                    >View map</a
                  >
                </div>
                <div class="sidebar-section">
                  <div class="sidebar-label">Billing address</div>
                  <div
                    v-if="
                      addressSame(
                        currentOrder.shipping_address,
                        currentOrder.billing_address,
                      )
                    "
                    class="sidebar-sub"
                  >
                    Same as shipping address
                  </div>
                  <div
                    v-else-if="currentOrder.billing_address"
                    class="sidebar-value"
                    v-html="formatAddress(currentOrder.billing_address)"
                  ></div>
                  <div v-else class="sidebar-sub">No billing address</div>
                </div>
              </div>
            </div>

            <!-- Conversion summary -->
            <div class="card">
              <div class="card-header">
                <div class="card-title-row"><Activity class="card-title-icon" aria-hidden="true" /><span class="card-title">Conversion summary</span></div>
              </div>
              <div class="sidebar-body">
                <div
                  v-if="nilVal(currentOrder.customer?.orders_count, 1) === 1"
                  class="conversion-item"
                >
                  <span v-html="ICONS.user"></span> This is their 1st order
                </div>
                <div class="conversion-item">
                  <span v-html="ICONS.clock"></span>
                  <template v-if="!nilVal(currentOrder.referring_site)"
                    >1st session was direct to your store</template
                  >
                  <template v-else>
                    <a
                      :href="currentOrder.referring_site || '#'"
                      target="_blank"
                      class="sidebar-link"
                      >{{ currentOrder.referring_site }}</a
                    >
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>

      <div v-else id="loading">Order not found.</div>
    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
definePageMeta({ layout: false });
import { Activity, ArrowLeft, FileText, User } from "@lucide/vue";
import { computed, watch } from "vue";
import { useRoute } from "vue-router";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useOrderStore } from "~/stores/order";
import {
  addressSame,
  capitalize,
  fmtDate,
  fmtDateTime,
  fmtMoney,
  formatAddress,
  getCustomerEmail,
  getCustomerName,
  getDeliverBy,
  getDiscount,
  getItemCount,
  getOrderBadges,
  getShipmentLabel,
  getSource,
  getSubtotal,
  getTax,
  ICONS,
  nilVal,
  serviceName,
} from "~~/utils/order";

// ── Store ──────────────────────────────────────────────────────────────────
const orderStore = useOrderStore();
const route = useRoute();
const router = useRouter();
const { storeId, token, isReady } = useActiveShopAuth();

// ── State ─────────────────────────────────────────────────────────────────────
const currentOrder = computed(() => {
  const orderId = route.params.id;
  return (
    orderStore.orders.find((order) => order.id.toString() === orderId) || null
  );
});

watch(
  [() => route.params.id, isReady],
  ([orderId, ready]) => {
    if (!ready || !orderId) return;
    void orderStore.fetchById(
      storeId.value,
      token.value,
      String(orderId),
      true,
    );
  },
  { immediate: true },
);

function returnToOrders() {
  router.replace({
    path: "/store",
    query: { ...route.query, tab: "orders" },
  });
}
</script>

<style scoped>
.order-title-row,
.page-header {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.page-header {
  margin-bottom: 6px;
}

.order-back-link {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--green) 18%, var(--border));
  border-radius: 8px;
  background: var(--surface-raised);
  color: var(--text-sub);
  box-shadow: var(--shadow-soft);
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease,
    transform 0.15s ease;
}

.order-back-link:hover {
  border-color: color-mix(in srgb, var(--green) 45%, var(--border));
  background: var(--green-soft);
  color: var(--green);
  transform: translateX(-1px);
}

.order-back-link:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--green) 20%, transparent);
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
  background: var(--badge-archived);
  color: var(--badge-archived-text);
}

.grid {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 16px;
  align-items: start;
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
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
.card-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.card-title-row {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.card-title-icon {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  color: var(--green);
}

.card-title {
  font-weight: 600;
  font-size: 14px;
}

.transit-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: var(--badge-pending);
  color: var(--badge-pending-text);
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 8px;
}
.delivered-badge {
  background: var(--badge-paid);
  color: var(--badge-paid-text);
}

.tracking-info {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}
.tracking-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-sub);
  margin-bottom: 4px;
}
.tracking-row:last-child {
  margin-bottom: 0;
}
.tracking-row :deep(svg) {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}
.tracking-row a {
  color: var(--text-link);
  text-decoration: none;
}
.tracking-row a:hover {
  text-decoration: underline;
}

.line-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
}
.line-item:last-child {
  border-bottom: none;
}
.product-img {
  width: 44px;
  height: 44px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--surface-soft);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}
.product-info {
  flex: 1;
  min-width: 0;
}
.product-name {
  font-weight: 500;
  color: var(--text-link);
  font-size: 13px;
}
.product-sku {
  font-size: 11px;
  color: var(--text-sub);
  font-family: "DM Mono", monospace;
  word-break: break-all;
  margin-top: 2px;
}
.product-variant {
  font-size: 12px;
  color: var(--text-sub);
  margin-top: 2px;
}
.product-price {
  font-size: 13px;
  color: var(--text-sub);
  margin-left: auto;
  white-space: nowrap;
}
.product-total {
  font-size: 13px;
  font-weight: 500;
  margin-left: 16px;
  white-space: nowrap;
}

.payment-rows {
  padding: 12px 16px;
}
.payment-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  padding: 4px 0;
  color: var(--text-sub);
}
.payment-row.total {
  font-weight: 600;
  color: var(--text);
  border-top: 1px solid var(--border);
  padding-top: 10px;
  margin-top: 6px;
}
.payment-row.paid-row {
  border-top: 1px solid var(--border);
  padding-top: 10px;
  margin-top: 4px;
}
.paid-badge-inline {
  background: var(--badge-paid);
  color: var(--badge-paid-text);
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  margin-right: 6px;
}

.sidebar .card + .card {
  margin-top: 16px;
}
.sidebar-body {
  padding: 14px 16px;
}
.sidebar-section + .sidebar-section {
  border-top: 1px solid var(--border);
  padding-top: 12px;
  margin-top: 12px;
}
.sidebar-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-sub);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 6px;
}
.sidebar-value {
  font-size: 13px;
  color: var(--text);
  line-height: 1.6;
}
.sidebar-link {
  color: var(--text-link);
  text-decoration: none;
  font-size: 13px;
}
.sidebar-link:hover {
  text-decoration: underline;
}
.sidebar-sub {
  font-size: 13px;
  color: var(--text-sub);
}

.conversion-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-sub);
  margin-bottom: 6px;
}
.conversion-item :deep(svg) {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-sub);
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
}
.icon-btn:hover {
  background: var(--surface-soft);
}
.kebab {
  display: none;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-sub);
  font-size: 18px;
  padding: 2px 6px;
  border-radius: 4px;
  line-height: 1;
}

#loading {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-sub);
  font-size: 15px;
}

@media (max-width: 700px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
