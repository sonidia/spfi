<script setup lang="ts">
import { History, RefreshCw } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useOrderApi } from "~/composables/useOrderApi";
import type {
  ShopifyFulfillment,
  ShopifyOrder,
  ShopifyRefund,
} from "~~/types/shopify";
import { getAppErrorMessage } from "~~/utils/error";

const props = defineProps<{ order: ShopifyOrder }>();
const orderApi = useOrderApi();
const { storeId, token, isReady } = useActiveShopAuth();
const activeTab = ref<"refunds" | "fulfillments">("refunds");
const refunds = ref<ShopifyRefund[]>([]);
const fulfillments = ref<ShopifyFulfillment[]>([]);
const isLoading = ref(false);
const error = ref("");

const auth = computed(() => ({
  storeId: storeId.value,
  token: token.value,
}));

watch(
  [() => props.order.id, () => props.order.updated_at, isReady],
  ([, , ready]) => {
    if (ready) void loadHistory();
  },
  { immediate: true },
);

async function loadHistory() {
  if (!isReady.value) return;
  isLoading.value = true;
  error.value = "";
  try {
    const [refundResponse, fulfillmentResponse] = await Promise.all([
      orderApi.getRefunds(auth.value, props.order.id),
      orderApi.getFulfillments(auth.value, props.order.id),
    ]);
    refunds.value = refundResponse.refunds || [];
    fulfillments.value = fulfillmentResponse.fulfillments || [];
  } catch (cause) {
    error.value = getAppErrorMessage(cause, "Failed to load order history.");
  } finally {
    isLoading.value = false;
  }
}

function refundAmount(refund: ShopifyRefund) {
  return (refund.transactions || []).reduce(
    (sum, transaction) => sum + Number(transaction.amount || 0),
    0,
  );
}

function refundQuantity(refund: ShopifyRefund) {
  return (refund.refund_line_items || []).reduce(
    (sum, line) => sum + Number(line.quantity || 0),
    0,
  );
}

function money(amount: number, currency = props.order.currency) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency || "USD"}`;
  }
}

function dateTime(value?: string) {
  if (!value) return "Unknown date";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
</script>

<template>
  <section class="history-panel" aria-labelledby="order-history-title">
    <header>
      <div class="heading">
        <History aria-hidden="true" />
        <div>
          <h2 id="order-history-title">Order history</h2>
          <p>Refund and fulfillment records loaded directly from Shopify.</p>
        </div>
      </div>
      <BaseButton
        icon-only
        title="Refresh order history"
        :loading="isLoading"
        @click="loadHistory"
      >
        <template #icon><RefreshCw /></template>
      </BaseButton>
    </header>

    <div class="tabs" role="tablist">
      <button
        type="button"
        :class="{ active: activeTab === 'refunds' }"
        role="tab"
        @click="activeTab = 'refunds'"
      >
        Refunds ({{ refunds.length }})
      </button>
      <button
        type="button"
        :class="{ active: activeTab === 'fulfillments' }"
        role="tab"
        @click="activeTab = 'fulfillments'"
      >
        Fulfillments ({{ fulfillments.length }})
      </button>
    </div>

    <div v-if="error" class="history-error" role="alert">{{ error }}</div>
    <div v-else-if="isLoading && !refunds.length && !fulfillments.length" class="empty">
      Loading order history…
    </div>

    <div v-else-if="activeTab === 'refunds'" class="history-list">
      <article v-for="refund in refunds" :key="refund.id">
        <div>
          <strong>Refund #{{ refund.id }}</strong>
          <span>{{ dateTime(refund.processed_at || refund.created_at) }}</span>
          <small v-if="refund.note">{{ refund.note }}</small>
        </div>
        <div class="history-summary">
          <strong>{{ money(refundAmount(refund)) }}</strong>
          <span>{{ refundQuantity(refund) }} item{{ refundQuantity(refund) === 1 ? "" : "s" }}</span>
        </div>
      </article>
      <div v-if="!refunds.length" class="empty">No refunds recorded.</div>
    </div>

    <div v-else class="history-list">
      <article
        v-for="fulfillment in fulfillments"
        :key="fulfillment.id"
      >
        <div>
          <strong>{{ fulfillment.name || `Fulfillment #${fulfillment.id}` }}</strong>
          <span>{{ dateTime(fulfillment.created_at) }}</span>
          <small>
            {{ fulfillment.tracking_company || fulfillment.service || "Manual" }}
            <template v-if="fulfillment.tracking_number">
              · {{ fulfillment.tracking_number }}
            </template>
          </small>
        </div>
        <div class="history-summary">
          <strong>{{ fulfillment.shipment_status || fulfillment.status || "unknown" }}</strong>
          <span>{{ fulfillment.line_items?.length || 0 }} line{{ fulfillment.line_items?.length === 1 ? "" : "s" }}</span>
        </div>
      </article>
      <div v-if="!fulfillments.length" class="empty">No fulfillments recorded.</div>
    </div>
  </section>
</template>

<style scoped>
.history-panel { margin-bottom: 10px; overflow: hidden; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); }
header, .heading, .history-list article { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
header { padding: 14px 16px; }
.heading { justify-content: flex-start; }
.heading > svg { width: 16px; color: var(--green); }
.heading h2 { color: var(--text); font-size: 15px; }
.heading p { margin-top: 2px; color: var(--text-sub); font-size: 11px; }
.tabs { display: flex; gap: 4px; padding: 0 16px 10px; border-bottom: 1px solid var(--border); }
.tabs button { border: 0; border-radius: 6px; padding: 7px 10px; background: transparent; color: var(--text-sub); cursor: pointer; font: inherit; font-size: 11px; font-weight: 600; }
.tabs button.active { background: var(--green-soft); color: var(--green); }
.history-list { display: grid; }
.history-list article { padding: 11px 16px; border-bottom: 1px solid var(--border); }
.history-list article:last-child { border-bottom: 0; }
.history-list article > div { display: grid; gap: 2px; }
.history-list strong { color: var(--text); font-size: 12px; }
.history-list span, .history-list small { color: var(--text-sub); font-size: 11px; }
.history-summary { text-align: right; }
.history-summary > strong { color: var(--green); text-transform: capitalize; }
.empty { padding: 24px 16px; color: var(--text-sub); text-align: center; font-size: 12px; }
.history-error { padding: 10px 16px; background: var(--red-soft); color: var(--red); font-size: 12px; }
</style>
