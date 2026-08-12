<script setup lang="ts">
import { Banknote, PackageCheck, RotateCcw, X } from "@lucide/vue";
import { computed, ref } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useOrderApi } from "~/composables/useOrderApi";
import { useOrderStore } from "~/stores/order";
import { usePaymentStore } from "~/stores/payment";
import type { ShopifyOrder } from "~~/types/shopify";
import type { OrderBulkAction, OrderBulkResponse } from "~~/types/shopify-operations";
import { getEligibleBulkOrderIds } from "~~/utils/order-bulk";
import { getAppErrorMessage } from "~~/utils/error";

const props = defineProps<{
  orders: ShopifyOrder[];
  selectedOrderIds: string[];
}>();
const emit = defineEmits<{ "update:selectedOrderIds": [value: string[]] }>();

const api = useOrderApi();
const orderStore = useOrderStore();
const paymentStore = usePaymentStore();
const { storeId, token } = useActiveShopAuth();
const { requestConfirmation } = useConfirmDialog();
const feedback = useStoreFeedback();
const isRunning = ref(false);
const notifyCustomer = ref(false);
const result = ref<OrderBulkResponse | null>(null);
const MAX_BULK_ORDERS = 25;
const selectedSet = computed(() => new Set(props.selectedOrderIds));
const eligibleCounts = computed(() => ({
  capture: eligible("capture").length,
  fulfill: eligible("fulfill").length,
  refund: eligible("refund").length,
}));

function eligible(action: OrderBulkAction) {
  return getEligibleBulkOrderIds(props.orders, selectedSet.value, action).slice(
    0,
    MAX_BULK_ORDERS,
  );
}

async function run(action: OrderBulkAction) {
  const orderIds = eligible(action);
  if (!orderIds.length) return;
  const copy: Record<
    OrderBulkAction,
    { title: string; message: string; label: string }
  > = {
    capture: {
      title: "Capture authorized payments",
      message: `Capture the full available authorization for ${orderIds.length} orders? Each order is isolated and failures will not stop the rest.`,
      label: "Capture payments",
    },
    fulfill: {
      title: "Fulfill available items",
      message: `Fulfill every currently open item for ${orderIds.length} orders${
        notifyCustomer.value ? " and notify customers" : " without customer email"
      }?`,
      label: "Fulfill orders",
    },
    refund: {
      title: "Issue full refunds",
      message: `Refund the full remaining amount for ${orderIds.length} orders? Inventory will not be restocked automatically; use Returns for physical goods coming back.`,
      label: "Refund orders",
    },
  };
  if (
    !(await requestConfirmation({
      title: copy[action].title,
      message: copy[action].message,
      confirmLabel: copy[action].label,
      danger: action === "refund",
    }))
  ) {
    return;
  }

  isRunning.value = true;
  result.value = null;
  try {
    const response = await api.bulk(
      { storeId: storeId.value, token: token.value },
      action,
      orderIds,
      notifyCustomer.value,
    );
    result.value = response;
    const succeeded = new Set(
      response.results.filter((item) => item.ok).map((item) => item.orderId),
    );
    emit(
      "update:selectedOrderIds",
      props.selectedOrderIds.filter((id) => !succeeded.has(id)),
    );
    await orderStore.fetchAll(storeId.value, token.value, true, orderStore.activeQuery);
    if (action === "capture" || action === "refund") {
      paymentStore.evictStore(storeId.value);
      await paymentStore.fetchBalanceTransactions(storeId.value, token.value, true);
    }
    if (response.failed) {
      feedback.warning(
        `${response.succeeded} succeeded; ${response.failed} need review.`,
        6000,
      );
    } else {
      feedback.success(`${response.succeeded} orders updated.`);
    }
  } catch (error) {
    feedback.error(getAppErrorMessage(error, "Bulk order action failed."));
  } finally {
    isRunning.value = false;
  }
}
</script>

<template>
  <section
    v-if="selectedOrderIds.length"
    class="bulk-actions"
    aria-label="Bulk order actions"
  >
    <div class="bulk-selection">
      <strong>{{ selectedOrderIds.length }} selected</strong>
      <button
        type="button"
        class="bulk-clear"
        :disabled="isRunning"
        aria-label="Clear order selection"
        @click="emit('update:selectedOrderIds', [])"
      >
        <X :size="14" />
      </button>
    </div>
    <div class="bulk-buttons">
      <BaseButton
        :loading="isRunning"
        :disabled="!eligibleCounts.capture"
        @click="run('capture')"
      >
        <template #icon><Banknote /></template>
        Capture ({{ eligibleCounts.capture }})
      </BaseButton>
      <BaseButton
        variant="primary"
        :loading="isRunning"
        :disabled="!eligibleCounts.fulfill"
        @click="run('fulfill')"
      >
        <template #icon><PackageCheck /></template>
        Fulfill ({{ eligibleCounts.fulfill }})
      </BaseButton>
      <BaseButton
        variant="danger-ghost"
        :loading="isRunning"
        :disabled="!eligibleCounts.refund"
        @click="run('refund')"
      >
        <template #icon><RotateCcw /></template>
        Full refund ({{ eligibleCounts.refund }})
      </BaseButton>
      <BaseCheckbox
        v-model="notifyCustomer"
        label="Notify on fulfill/refund"
        :disabled="isRunning"
      />
    </div>
    <small v-if="selectedOrderIds.length > MAX_BULK_ORDERS" class="bulk-limit-note">
      Each action processes the first {{ MAX_BULK_ORDERS }} eligible visible orders.
    </small>
    <div v-if="result?.failed" class="bulk-results" role="status">
      <strong>{{ result.failed }} failed</strong>
      <span
        v-for="item in result.results.filter((entry) => !entry.ok)"
        :key="item.orderId"
      >
        #{{ item.orderId }} — {{ item.message }}
      </span>
    </div>
  </section>
</template>

<style scoped>
.bulk-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--surface-soft);
}

.bulk-selection,
.bulk-buttons {
  display: flex;
  align-items: center;
  gap: 7px;
}

.bulk-selection {
  flex: 0 0 auto;
  color: var(--text);
  font-size: 12px;
}

.bulk-buttons {
  flex-wrap: wrap;
}

.bulk-clear {
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--text-sub);
  cursor: pointer;
}

.bulk-results {
  min-width: 220px;
  max-height: 74px;
  display: grid;
  gap: 2px;
  margin-left: auto;
  overflow-y: auto;
  color: var(--red);
  font-size: 10px;
}

.bulk-limit-note {
  max-width: 180px;
  color: var(--text-sub);
  font-size: 10px;
}

.bulk-results span {
  white-space: nowrap;
}

@media (max-width: 860px) {
  .bulk-actions {
    align-items: flex-start;
    flex-direction: column;
  }

  .bulk-results {
    width: 100%;
    margin-left: 0;
  }
}
</style>
