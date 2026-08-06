<script setup lang="ts">
import {
  Banknote,
  CircleOff,
  CreditCard,
  ReceiptText,
  RotateCcw,
  X,
} from "@lucide/vue";
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

const mode = ref<"idle" | "capture" | "void" | "manual" | "refund">("idle");
const transactions = ref<ShopifyOrderTransaction[]>([]);
const transactionCount = ref(0);
const isLoadingTransactions = ref(false);
const transactionError = ref("");
const showShopCurrency = ref(false);
const expandedTransactionId = ref("");
const transactionDetails = ref<Record<string, ShopifyOrderTransaction>>({});
const loadingTransactionId = ref("");
const selectedAuthorizationId = ref("");
const captureAmount = ref("");
const finalCapture = ref(true);
const selectedVoidTransactionId = ref("");
const manualPaymentAmount = ref("");
const manualPaymentMethod = ref("Cash");
const manualPaymentProcessedAt = ref("");
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
const outstandingAmount = computed(() =>
  Math.max(
    0,
    Number(
      props.order.total_outstanding ??
        props.order.current_total_price ??
        props.order.total_price ??
        0,
    ),
  ),
);
const canCreateManualPayment = computed(
  () => !props.order.cancelled_at && outstandingAmount.value > 0,
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
const voidOptions = computed(() =>
  captureOptions.value.filter(
    ({ transaction }) =>
      !successfulTransactions.value.some(
        (candidate) =>
          candidate.kind.toLowerCase() === "void" &&
          String(candidate.parent_id || "") === String(transaction.id),
      ),
  ),
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
watch(showShopCurrency, () => {
  expandedTransactionId.value = "";
  transactionDetails.value = {};
  void loadTransactions();
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
    const auth = { storeId: storeId.value, token: token.value };
    const [response, countResponse] = await Promise.all([
      orderApi.getTransactions(auth, props.order.id, {
        in_shop_currency: showShopCurrency.value,
      }),
      orderApi.countTransactions(auth, props.order.id),
    ]);
    transactions.value = response.transactions || [];
    transactionCount.value = countResponse.count;
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

  const voidTransaction = voidOptions.value[0]?.transaction;
  if (
    voidTransaction &&
    !voidOptions.value.some(
      (option) =>
        String(option.transaction.id) === selectedVoidTransactionId.value,
    )
  ) {
    selectedVoidTransactionId.value = String(voidTransaction.id);
  }

  if (!manualPaymentAmount.value && outstandingAmount.value > 0) {
    manualPaymentAmount.value = outstandingAmount.value.toFixed(2);
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

function setMode(nextMode: "capture" | "void" | "manual" | "refund") {
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
  if (
    !window.confirm(
      "Mark the full outstanding balance as paid? Shopify will create a sale or capture transaction.",
    )
  ) {
    return;
  }
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

async function voidAuthorization() {
  if (!isReady.value || !selectedVoidTransactionId.value) return;
  if (
    !window.confirm(
      "Void this uncaptured authorization? The reserved funds will be released and cannot be captured afterward.",
    )
  ) {
    return;
  }

  const updated = await orderStore.voidOrderTransaction(
    storeId.value,
    token.value,
    props.order.id,
    { parentTransactionId: selectedVoidTransactionId.value },
  );
  if (updated) {
    toast.success("Authorization voided.");
    mode.value = "idle";
    await loadTransactions();
  }
}

async function createManualPayment() {
  if (!isReady.value || Number(manualPaymentAmount.value) <= 0) return;
  const processedAt = manualPaymentProcessedAt.value
    ? new Date(manualPaymentProcessedAt.value).toISOString()
    : undefined;
  const updated = await orderStore.createManualPayment(
    storeId.value,
    token.value,
    props.order.id,
    {
      amount: manualPaymentAmount.value,
      currency: props.order.currency,
      paymentMethodName: manualPaymentMethod.value,
      ...(processedAt ? { processedAt } : {}),
    },
  );
  if (updated) {
    toast.success("Manual payment recorded.");
    manualPaymentAmount.value = "";
    manualPaymentProcessedAt.value = "";
    mode.value = "idle";
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

async function toggleTransactionDetails(transactionId: string | number) {
  const key = String(transactionId);
  if (expandedTransactionId.value === key) {
    expandedTransactionId.value = "";
    return;
  }

  expandedTransactionId.value = key;
  if (transactionDetails.value[key] || !isReady.value) return;

  loadingTransactionId.value = key;
  try {
    const response = await orderApi.getTransaction(
      { storeId: storeId.value, token: token.value },
      props.order.id,
      transactionId,
      { in_shop_currency: showShopCurrency.value },
    );
    transactionDetails.value[key] = response.transaction;
  } catch (error) {
    expandedTransactionId.value = "";
    transactionError.value = getAppErrorMessage(
      error,
      "Failed to load transaction details.",
    );
  } finally {
    loadingTransactionId.value = "";
  }
}

function formatTransactionTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
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
          v-if="voidOptions.length"
          :disabled="orderStore.isMutating"
          @click="setMode('void')"
        >
          <template #icon>
            <X v-if="mode === 'void'" />
            <CircleOff v-else />
          </template>
          {{ mode === "void" ? "Close" : "Void" }}
        </BaseButton>
        <BaseButton
          v-if="canCreateManualPayment"
          :disabled="orderStore.isMutating"
          @click="setMode('manual')"
        >
          <template #icon>
            <X v-if="mode === 'manual'" />
            <ReceiptText v-else />
          </template>
          {{ mode === "manual" ? "Close" : "Manual payment" }}
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

    <form
      v-else-if="mode === 'void'"
      class="form-grid"
      @submit.prevent="voidAuthorization"
    >
      <label>
        <span>Uncaptured authorization</span>
        <select v-model="selectedVoidTransactionId">
          <option
            v-for="option in voidOptions"
            :key="option.transaction.id"
            :value="String(option.transaction.id)"
          >
            {{ option.transaction.gateway || "Payment" }} ·
            {{
              fmtMoney(
                option.remaining.toFixed(2),
                option.transaction.currency,
              )
            }}
            uncaptured
          </option>
        </select>
      </label>
      <p class="void-warning">
        Voiding releases the authorization and permanently prevents further
        capture from it.
      </p>
      <div class="form-actions">
        <BaseButton
          variant="danger"
          :loading="orderStore.isMutating"
          :disabled="!selectedVoidTransactionId"
          @click="voidAuthorization"
        >
          Void authorization
        </BaseButton>
      </div>
    </form>

    <form
      v-else-if="mode === 'manual'"
      class="form-grid"
      @submit.prevent="createManualPayment"
    >
      <label>
        <span>Amount ({{ order.currency }})</span>
        <input
          v-model="manualPaymentAmount"
          type="number"
          min="0.01"
          :max="outstandingAmount"
          step="0.01"
          required
        />
      </label>
      <label>
        <span>Payment method</span>
        <input
          v-model.trim="manualPaymentMethod"
          placeholder="Cash, check, bank transfer…"
        />
      </label>
      <label>
        <span>Processed at (optional)</span>
        <input v-model="manualPaymentProcessedAt" type="datetime-local" />
      </label>
      <p class="manual-help">
        Records a real manual payment transaction for cash, check, bank
        transfer, or another offline method.
      </p>
      <div class="form-actions">
        <BaseButton
          variant="primary"
          :loading="orderStore.isMutating"
          :disabled="
            Number(manualPaymentAmount) <= 0 ||
            Number(manualPaymentAmount) > outstandingAmount
          "
          @click="createManualPayment"
        >
          Record manual payment
        </BaseButton>
      </div>
    </form>

    <form
      v-else-if="mode === 'refund'"
      class="refund-form"
      @submit.prevent="createRefund"
    >
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

    <section class="transaction-history" aria-labelledby="transaction-history-title">
      <div class="transaction-history-head">
        <div>
          <strong id="transaction-history-title">Transaction history</strong>
          <span>{{ transactionCount || transactions.length }} total</span>
        </div>
        <label class="currency-toggle">
          <input v-model="showShopCurrency" type="checkbox" />
          <span>Show shop currency</span>
        </label>
      </div>
      <div v-if="transactions.length" class="transaction-table-wrap">
        <table class="transaction-table">
          <thead>
            <tr>
              <th>Kind</th>
              <th>Status</th>
              <th>Gateway</th>
              <th>Processed</th>
              <th class="right">Amount</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            <template v-for="transaction in transactions" :key="transaction.id">
              <tr>
                <td class="transaction-kind">{{ transaction.kind }}</td>
                <td>
                  <span
                    class="transaction-status"
                    :class="{ success: transaction.status.toLowerCase() === 'success' }"
                  >
                    {{ transaction.status }}
                  </span>
                </td>
                <td>{{ transaction.gateway || "—" }}</td>
                <td>
                  {{
                    formatTransactionTime(
                      transaction.processed_at || transaction.created_at,
                    )
                  }}
                </td>
                <td class="right">
                  {{ fmtMoney(transaction.amount, transaction.currency) }}
                </td>
                <td class="right">
                  <button
                    type="button"
                    class="details-button"
                    :disabled="loadingTransactionId === String(transaction.id)"
                    @click="toggleTransactionDetails(transaction.id)"
                  >
                    {{
                      loadingTransactionId === String(transaction.id)
                        ? "Loading…"
                        : expandedTransactionId === String(transaction.id)
                          ? "Hide"
                          : "Details"
                    }}
                  </button>
                </td>
              </tr>
              <tr
                v-if="expandedTransactionId === String(transaction.id)"
                class="detail-row"
              >
                <td colspan="6">
                  <div
                    v-if="transactionDetails[String(transaction.id)]"
                    class="transaction-detail"
                  >
                    <dl>
                      <div>
                        <dt>Transaction ID</dt>
                        <dd>
                          {{ transactionDetails[String(transaction.id)]?.id }}
                        </dd>
                      </div>
                      <div>
                        <dt>Parent ID</dt>
                        <dd>
                          {{
                            transactionDetails[String(transaction.id)]?.parent_id ||
                            "—"
                          }}
                        </dd>
                      </div>
                      <div>
                        <dt>Authorization expires</dt>
                        <dd>
                          {{
                            formatTransactionTime(
                              transactionDetails[String(transaction.id)]
                                ?.authorization_expires_at,
                            )
                          }}
                        </dd>
                      </div>
                      <div>
                        <dt>Manual gateway</dt>
                        <dd>
                          {{
                            transactionDetails[String(transaction.id)]
                              ?.manual_payment_gateway
                              ? "Yes"
                              : "No"
                          }}
                        </dd>
                      </div>
                    </dl>
                    <div
                      v-if="
                        transactionDetails[String(transaction.id)]
                          ?.extended_authorization_attributes &&
                        Object.keys(
                          transactionDetails[String(transaction.id)]
                            ?.extended_authorization_attributes || {},
                        ).length
                      "
                      class="extended-authorization"
                    >
                      <strong>Extended authorization attributes</strong>
                      <pre>{{
                        JSON.stringify(
                          transactionDetails[String(transaction.id)]
                            ?.extended_authorization_attributes,
                          null,
                          2,
                        )
                      }}</pre>
                    </div>
                  </div>
                  <div v-else class="detail-loading">
                    Loading transaction details…
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
      <div v-else-if="!isLoadingTransactions" class="panel-note">
        No transactions recorded for this order.
      </div>
    </section>
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
.amount-help, .manual-help, .void-warning { margin: -6px 0 0; color: var(--text-sub); font-size: 11px; line-height: 1.5; }
.manual-help, .void-warning { align-self: end; margin: 0; }
.void-warning { color: var(--red); }
.panel-note, .panel-error { padding: 10px 16px; border-top: 1px solid var(--border); font-size: 12px; }
.panel-note { color: var(--text-sub); }
.panel-error { border-top-color: rgba(180, 49, 43, 0.2); background: var(--red-soft); color: var(--red); }
.transaction-history { border-top: 1px solid var(--border); }
.transaction-history-head { min-height: 46px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 16px; background: var(--surface); }
.transaction-history-head > div { display: flex; align-items: baseline; gap: 7px; }
.transaction-history-head strong { color: var(--text); font-size: 13px; }
.transaction-history-head span { color: var(--text-sub); font-size: 11px; }
.currency-toggle { display: flex; grid-template-columns: auto 1fr; align-items: center; gap: 7px; }
.currency-toggle input { width: 16px; min-height: 16px; }
.transaction-table-wrap { overflow-x: auto; }
.transaction-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.transaction-table th, .transaction-table td { padding: 9px 12px; border-top: 1px solid var(--border); text-align: left; white-space: nowrap; }
.transaction-table th { background: var(--surface-soft); color: var(--text-sub); font-size: 11px; font-weight: 700; }
.transaction-table .right { text-align: right; }
.transaction-kind { font-weight: 700; text-transform: capitalize; }
.transaction-status { display: inline-flex; border-radius: 20px; padding: 2px 8px; background: var(--surface-soft); color: var(--text-sub); font-size: 10px; font-weight: 700; text-transform: capitalize; }
.transaction-status.success { background: var(--green-soft); color: var(--green); }
.details-button { border: 1px solid var(--border); border-radius: 5px; padding: 4px 8px; background: var(--surface); color: var(--text-sub); font: inherit; font-size: 11px; font-weight: 700; cursor: pointer; }
.details-button:hover:not(:disabled) { border-color: var(--green); color: var(--green); }
.details-button:disabled { opacity: 0.55; cursor: wait; }
.detail-row td { padding: 0; background: var(--surface-soft); white-space: normal; }
.transaction-detail { display: grid; gap: 10px; padding: 12px 16px; }
.transaction-detail dl { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 0; }
.transaction-detail dl div { min-width: 0; }
.transaction-detail dt { color: var(--text-sub); font-size: 10px; font-weight: 700; }
.transaction-detail dd { overflow-wrap: anywhere; margin: 3px 0 0; color: var(--text); font-size: 11px; }
.extended-authorization { display: grid; gap: 6px; }
.extended-authorization strong { color: var(--text); font-size: 11px; }
.extended-authorization pre { overflow: auto; max-height: 220px; margin: 0; border: 1px solid var(--border); border-radius: 6px; padding: 9px; background: var(--surface); color: var(--text); font-size: 10px; white-space: pre-wrap; }
.detail-loading { padding: 12px 16px; color: var(--text-sub); font-size: 11px; }

@media (max-width: 760px) {
  header { align-items: flex-start; flex-direction: column; }
  .form-grid { grid-template-columns: 1fr; }
  .action-row { justify-content: flex-start; }
  .transaction-detail dl { grid-template-columns: 1fr 1fr; }
}
</style>
