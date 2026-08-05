<script setup lang="ts">
import { Banknote, CreditCard, RotateCcw, X } from "@lucide/vue";
import { computed, onMounted, ref, watch } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useOrderApi } from "~/composables/useOrderApi";
import { useOrderStore } from "~/stores/order";
import { useToastStore } from "~/stores/toast";
import type {
  ShopifyLineItem,
  ShopifyOrder,
  ShopifyOrderTransaction,
} from "~~/types/shopify";
import type { RefundLineItemRestockType } from "~~/types/shopify-order";
import { getAppErrorMessage } from "~~/utils/error";
import { fmtMoney } from "~~/utils/order";

const props = defineProps<{ order: ShopifyOrder }>();
const orderApi = useOrderApi();
const orderStore = useOrderStore();
const toast = useToastStore();
const { storeId, token, isReady } = useActiveShopAuth();

const mode = ref<"idle" | "capture" | "refund">("idle");
const transactions = ref<ShopifyOrderTransaction[]>([]);
const isLoadingTransactions = ref(false);
const transactionError = ref("");
const selectedAuthorizationId = ref("");
const captureAmount = ref("");
const finalCapture = ref(true);
const selectedRefundTransactionId = ref("");
const refundAmount = ref("");
const refundNote = ref("");
const refundQuantities = ref<Record<string, number>>({});
const refundRestockTypes = ref<Record<string, RefundLineItemRestockType>>({});
const refundDiscrepancyReason = ref<"CUSTOMER" | "DAMAGE" | "OTHER" | "RESTOCK">(
  "OTHER",
);
const notifyCustomer = ref(false);
const refundIdempotencyKey = ref("");

const financialStatus = computed(() =>
  String(props.order.financial_status || "").toLowerCase(),
);
const canMarkAsPaid = computed(
  () =>
    !props.order.cancelled_at &&
    ["pending", "authorized", "partially_paid"].includes(financialStatus.value) &&
    Number(props.order.total_outstanding ?? props.order.current_total_price ?? 0) > 0,
);

const successfulTransactions = computed(() =>
  transactions.value.filter(
    (transaction) => transaction.status.toLowerCase() === "success",
  ),
);

const captureOptions = computed(() =>
  successfulTransactions.value
    .filter((transaction) => transaction.kind.toLowerCase() === "authorization")
    .map((transaction) => ({
      transaction,
      remaining: remainingTransactionAmount(transaction, ["capture", "sale"]),
    }))
    .filter((option) => option.remaining > 0),
);

const refundOptions = computed(() =>
  successfulTransactions.value
    .filter((transaction) =>
      ["sale", "capture"].includes(transaction.kind.toLowerCase()),
    )
    .map((transaction) => ({
      transaction,
      remaining: remainingTransactionAmount(transaction, ["refund"]),
    }))
    .filter((option) => option.remaining > 0),
);

const refundableLines = computed(() =>
  (props.order.line_items || [])
    .map((lineItem) => ({
      lineItem,
      remaining: remainingRefundQuantity(lineItem),
    }))
    .filter((entry) => entry.remaining > 0),
);

const selectedRefundLines = computed(() =>
  refundableLines.value.filter(
    ({ lineItem }) => Number(refundQuantities.value[String(lineItem.id)] || 0) > 0,
  ),
);

onMounted(loadTransactions);
watch(
  () => [props.order.id, props.order.updated_at],
  () => loadTransactions(),
);
watch(isReady, (ready) => {
  if (ready) void loadTransactions();
});
watch(
  [
    refundAmount,
    refundNote,
    notifyCustomer,
    refundQuantities,
    refundRestockTypes,
    refundDiscrepancyReason,
  ],
  () => {
    refundIdempotencyKey.value = "";
  },
  { deep: true },
);

async function loadTransactions() {
  if (!isReady.value || isLoadingTransactions.value) return;
  isLoadingTransactions.value = true;
  transactionError.value = "";
  try {
    const response = await orderApi.getTransactions(
      { storeId: storeId.value, token: token.value },
      props.order.id,
    );
    transactions.value = response.transactions || [];
    selectDefaultTransactions();
  } catch (error) {
    transactionError.value = getAppErrorMessage(
      error,
      "Failed to load payment transactions.",
    );
  } finally {
    isLoadingTransactions.value = false;
  }
}

function selectDefaultTransactions() {
  const capture = captureOptions.value[0];
  if (capture && !captureOptions.value.some(
    (option) => String(option.transaction.id) === selectedAuthorizationId.value,
  )) {
    selectedAuthorizationId.value = String(capture.transaction.id);
    captureAmount.value = capture.remaining.toFixed(2);
  }

  const refund = refundOptions.value[0];
  if (refund && !refundOptions.value.some(
    (option) => String(option.transaction.id) === selectedRefundTransactionId.value,
  )) {
    selectedRefundTransactionId.value = String(refund.transaction.id);
    refundAmount.value = "";
  }
}

function remainingTransactionAmount(
  parent: ShopifyOrderTransaction,
  childKinds: string[],
) {
  const consumed = successfulTransactions.value
    .filter(
      (transaction) =>
        childKinds.includes(transaction.kind.toLowerCase()) &&
        String(transaction.parent_id || "") === String(parent.id),
    )
    .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  return Math.max(0, Number(parent.amount || 0) - consumed);
}

function remainingRefundQuantity(lineItem: ShopifyLineItem) {
  const refunded = (props.order.refunds || []).reduce(
    (sum, refund) =>
      sum +
      (refund.refund_line_items || [])
        .filter((item) => String(item.line_item_id) === String(lineItem.id))
        .reduce((quantity, item) => quantity + Number(item.quantity || 0), 0),
    0,
  );
  return Math.max(0, Number(lineItem.quantity || 0) - refunded);
}

function setMode(nextMode: "capture" | "refund") {
  mode.value = mode.value === nextMode ? "idle" : nextMode;
  if (!transactions.value.length) void loadTransactions();
}

function syncCaptureAmount() {
  const selected = captureOptions.value.find(
    (option) => String(option.transaction.id) === selectedAuthorizationId.value,
  );
  captureAmount.value = selected ? selected.remaining.toFixed(2) : "";
}

async function markAsPaid() {
  if (!isReady.value) return;
  if (!window.confirm("Record the full outstanding balance as paid?")) return;
  const updated = await orderStore.markOrderAsPaid(
    storeId.value,
    token.value,
    props.order.id,
  );
  if (updated) {
    toast.success("Order marked as paid.");
    await loadTransactions();
  }
}

async function capturePayment() {
  if (!isReady.value || !selectedAuthorizationId.value) return;
  const updated = await orderStore.capturePayment(
    storeId.value,
    token.value,
    props.order.id,
    {
      parentTransactionId: selectedAuthorizationId.value,
      amount: captureAmount.value,
      currency: props.order.currency,
      finalCapture: finalCapture.value,
    },
  );
  if (updated) {
    toast.success("Payment captured.");
    mode.value = "idle";
    await loadTransactions();
  }
}

async function createRefund() {
  if (!isReady.value || !selectedRefundTransactionId.value) return;
  const parent = refundOptions.value.find(
    (option) =>
      String(option.transaction.id) === selectedRefundTransactionId.value,
  )?.transaction;
  if (!parent) return;

  if (!refundIdempotencyKey.value) {
    refundIdempotencyKey.value =
      globalThis.crypto?.randomUUID?.() ||
      `refund-${props.order.id}-${Date.now()}`;
  }

  const updated = await orderStore.refundOrder(
    storeId.value,
    token.value,
    props.order.id,
    {
      amount: refundAmount.value,
      currency: props.order.currency,
      parentTransactionId: parent.id,
      gateway: parent.gateway || "manual",
      lineItems: selectedRefundLines.value.map(({ lineItem }) => ({
        lineItemId: lineItem.id,
        quantity: Number(refundQuantities.value[String(lineItem.id)]),
        restockType:
          refundRestockTypes.value[String(lineItem.id)] || "NO_RESTOCK",
      })),
      note: refundNote.value,
      notify: notifyCustomer.value,
      discrepancyReason: refundDiscrepancyReason.value,
      idempotencyKey: refundIdempotencyKey.value,
    },
  );
  if (updated) {
    toast.success("Partial refund created.");
    refundIdempotencyKey.value = "";
    mode.value = "idle";
    await loadTransactions();
  }
}
</script>

<template>
  <section class="financial-panel" aria-labelledby="financial-actions-title">
    <header>
      <div>
        <div class="panel-title"><CreditCard aria-hidden="true" /><h2 id="financial-actions-title">Payments</h2></div>
        <p>Capture authorized funds, record offline payment, or issue a partial refund.</p>
      </div>
      <div class="action-row">
        <BaseButton
          v-if="captureOptions.length"
          :disabled="orderStore.isMutating"
          @click="setMode('capture')"
        >
          <template #icon><X v-if="mode === 'capture'" /><CreditCard v-else /></template>
          {{ mode === "capture" ? "Close" : "Capture" }}
        </BaseButton>
        <BaseButton
          v-if="canMarkAsPaid"
          :loading="orderStore.isMutating && mode === 'idle'"
          :disabled="mode !== 'idle'"
          @click="markAsPaid"
        >
          <template #icon><Banknote /></template>
          Mark as paid
        </BaseButton>
        <BaseButton
          v-if="refundOptions.length && refundableLines.length"
          :disabled="orderStore.isMutating"
          @click="setMode('refund')"
        >
          <template #icon><X v-if="mode === 'refund'" /><RotateCcw v-else /></template>
          {{ mode === "refund" ? "Close" : "Refund" }}
        </BaseButton>
      </div>
    </header>

    <div v-if="isLoadingTransactions" class="panel-note">Loading payment transactions…</div>
    <div v-else-if="transactionError" class="panel-error" role="alert">
      {{ transactionError }}
    </div>

    <form v-if="mode === 'capture'" class="form-grid" @submit.prevent="capturePayment">
      <label>
        <span>Authorization</span>
        <select v-model="selectedAuthorizationId" @change="syncCaptureAmount">
          <option
            v-for="option in captureOptions"
            :key="option.transaction.id"
            :value="String(option.transaction.id)"
          >
            {{ option.transaction.gateway || "Payment" }} ·
            {{ fmtMoney(option.remaining.toFixed(2), option.transaction.currency) }} remaining
          </option>
        </select>
      </label>
      <label>
        <span>Amount ({{ order.currency }})</span>
        <input v-model="captureAmount" type="number" min="0.01" step="0.01" required />
      </label>
      <label class="check-row">
        <input v-model="finalCapture" type="checkbox" />
        <span>Final capture (close authorization)</span>
      </label>
      <div class="form-actions">
        <BaseButton
          variant="primary"
          :loading="orderStore.isMutating"
          :disabled="!selectedAuthorizationId || Number(captureAmount) <= 0"
          @click="capturePayment"
        >
          Capture payment
        </BaseButton>
      </div>
    </form>

    <form v-else-if="mode === 'refund'" class="refund-form" @submit.prevent="createRefund">
      <label>
        <span>Refund from transaction</span>
        <select v-model="selectedRefundTransactionId">
          <option
            v-for="option in refundOptions"
            :key="option.transaction.id"
            :value="String(option.transaction.id)"
          >
            {{ option.transaction.gateway || "Payment" }} ·
            {{ fmtMoney(option.remaining.toFixed(2), option.transaction.currency) }} refundable
          </option>
        </select>
      </label>

      <div class="refund-lines">
        <div class="field-label">Refund line items</div>
        <div v-for="entry in refundableLines" :key="entry.lineItem.id" class="refund-line">
          <div>
            <strong>{{ entry.lineItem.name || entry.lineItem.title || "Item" }}</strong>
            <small>{{ entry.remaining }} available</small>
          </div>
          <input
            v-model.number="refundQuantities[String(entry.lineItem.id)]"
            type="number"
            min="0"
            :max="entry.remaining"
            step="1"
            aria-label="Refund quantity"
          />
          <select
            v-model="refundRestockTypes[String(entry.lineItem.id)]"
            aria-label="Refund restock action"
          >
            <option value="NO_RESTOCK">Do not restock</option>
            <option value="CANCEL">Restock unfulfilled</option>
            <option value="RETURN">Restock returned</option>
          </select>
        </div>
      </div>

      <div class="form-grid compact">
        <label>
          <span>Refund amount ({{ order.currency }})</span>
          <input v-model="refundAmount" type="number" min="0.01" step="0.01" required />
        </label>
        <label>
          <span>Internal note</span>
          <input v-model="refundNote" placeholder="Reason for refund" />
        </label>
        <label>
          <span>Adjustment reason</span>
          <select v-model="refundDiscrepancyReason">
            <option value="OTHER">Other</option>
            <option value="CUSTOMER">Customer request</option>
            <option value="DAMAGE">Damage</option>
            <option value="RESTOCK">Restocking</option>
          </select>
        </label>
        <label class="check-row">
          <input v-model="notifyCustomer" type="checkbox" />
          <span>Notify customer</span>
        </label>
      </div>
      <p class="amount-help">
        Enter the exact financial amount to return; Shopify validates it against the selected payment.
      </p>
      <div class="form-actions">
        <BaseButton
          variant="danger"
          :loading="orderStore.isMutating"
          :disabled="!selectedRefundLines.length || Number(refundAmount) <= 0"
          @click="createRefund"
        >
          Issue partial refund
        </BaseButton>
      </div>
    </form>

    <div v-if="orderStore.mutationError" class="panel-error" role="alert">
      {{ orderStore.mutationError }}
    </div>
  </section>
</template>

<style scoped>
.financial-panel { margin-bottom: 16px; overflow: hidden; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); box-shadow: var(--shadow); }
header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 16px; }
.panel-title { min-width: 0; display: inline-flex; align-items: center; gap: 8px; }
.panel-title :deep(svg) { width: 16px; height: 16px; flex: 0 0 16px; color: var(--green); }
h2 { color: var(--text); font-size: 15px; }
header p { margin: 3px 0 0; color: var(--text-sub); font-size: 12px; }
.action-row, .form-actions { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; padding: 16px; border-top: 1px solid var(--border); background: var(--surface-soft); }
.refund-form { display: grid; gap: 14px; padding: 16px; border-top: 1px solid var(--border); background: var(--surface-soft); }
.form-grid.compact { padding: 0; border: 0; }
label { display: grid; gap: 5px; min-width: 0; }
label > span, .field-label { color: var(--text-sub); font-size: 11px; font-weight: 700; }
input, select { width: 100%; min-height: 36px; border: 1px solid var(--border); border-radius: 6px; padding: 7px 9px; background: var(--surface-raised); color: var(--text); font: inherit; }
input:focus, select:focus { outline: none; border-color: var(--green); box-shadow: 0 0 0 3px color-mix(in srgb, var(--green) 20%, transparent); }
.check-row { display: flex; align-items: center; align-self: end; gap: 8px; min-height: 36px; }
.check-row input { width: 16px; min-height: 16px; }
.form-actions { grid-column: 1 / -1; }
.refund-lines { display: grid; gap: 8px; }
.refund-line { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface-raised); }
.refund-line div { display: grid; min-width: 0; }
.refund-line strong { overflow: hidden; color: var(--text); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.refund-line small { color: var(--text-sub); font-size: 11px; }
.refund-line input { width: 76px; }
.refund-line select { width: 155px; }
.amount-help { margin: -6px 0 0; color: var(--text-sub); font-size: 11px; }
.panel-note, .panel-error { padding: 10px 16px; border-top: 1px solid var(--border); font-size: 12px; }
.panel-note { color: var(--text-sub); }
.panel-error { border-top-color: rgba(180, 49, 43, 0.2); background: var(--red-soft); color: var(--red); }

@media (max-width: 760px) {
  header { align-items: flex-start; flex-direction: column; }
  .form-grid { grid-template-columns: 1fr; }
  .action-row { justify-content: flex-start; }
}
</style>
