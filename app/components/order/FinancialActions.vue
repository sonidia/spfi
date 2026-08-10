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
import { fmtMoney, formatMoneyInput } from "~~/utils/order";

const props = defineProps<{ order: ShopifyOrder }>();
const orderApi = useOrderApi();
const orderStore = useOrderStore();
const toast = useToastStore();
const { storeId, token, isReady } = useActiveShopAuth();
const { t } = useLocalization();
const { requestConfirmation } = useConfirmDialog();

const mode = ref<"idle" | "capture" | "void" | "manual" | "refund">("idle");
const transactions = ref<ShopifyOrderTransaction[]>([]);
const transactionCount = ref(0);
const isLoadingTransactions = ref(false);
const transactionError = ref("");
const showShopCurrency = ref(false);
const expandedTransactionId = ref("");
const transactionDetails = ref<Record<string, ShopifyOrderTransaction>>({});
const formattedExtendedAuthorizationAttributes = computed(() =>
  Object.fromEntries(
    Object.entries(transactionDetails.value).map(([id, transaction]) => [
      id,
      JSON.stringify(transaction.extended_authorization_attributes, null, 2),
    ]),
  ),
);
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
      t("financial.loadTransactionsFailed"),
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
    captureAmount.value = formatMoneyInput(
      capture.remaining,
      capture.transaction.currency || props.order.currency,
    );
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
    manualPaymentAmount.value = formatMoneyInput(
      outstandingAmount.value,
      props.order.currency,
    );
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
  captureAmount.value = selected
    ? formatMoneyInput(
        selected.remaining,
        selected.transaction.currency || props.order.currency,
      )
    : "";
}

async function markAsPaid() {
  if (!isReady.value) return;
  if (
    !(await requestConfirmation({
      title: t("confirm.actionTitle"),
      message: t("order.markPaidConfirm"),
      confirmLabel: t("order.markAsPaid"),
      danger: false,
    }))
  ) {
    return;
  }
  const updated = await orderStore.markOrderAsPaid(
    storeId.value,
    token.value,
    props.order.id,
  );
  if (updated) {
    toast.success(t("order.markedAsPaid"));
    await loadTransactions();
  }
}

async function voidAuthorization() {
  if (!isReady.value || !selectedVoidTransactionId.value) return;
  if (
    !(await requestConfirmation({
      title: t("confirm.actionTitle"),
      message: t("order.voidAuthorizationConfirm"),
      confirmLabel: t("order.voidAuthorization"),
    }))
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
    toast.success(t("financial.authorizationVoided"));
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
    toast.success(t("financial.manualPaymentRecorded"));
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
    toast.success(t("financial.paymentCaptured"));
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
    toast.success(t("financial.partialRefundCreated"));
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
      t("financial.loadTransactionDetailsFailed"),
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
        <div class="panel-title"><CreditCard aria-hidden="true" /><h2 id="financial-actions-title">{{ t("financial.title") }}</h2></div>
        <p>{{ t("financial.description") }}</p>
      </div>
      <div class="action-row">
        <BaseButton
          v-if="captureOptions.length"
          :disabled="orderStore.isMutating"
          @click="setMode('capture')"
        >
          <template #icon><X v-if="mode === 'capture'" /><CreditCard v-else /></template>
          {{ mode === "capture" ? t("common.close") : t("financial.capture") }}
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
          {{ mode === "void" ? t("common.close") : t("financial.void") }}
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
          {{ mode === "manual" ? t("common.close") : t("financial.manualPayment") }}
        </BaseButton>
        <BaseButton
          v-if="canMarkAsPaid"
          :loading="orderStore.isMutating && mode === 'idle'"
          :disabled="mode !== 'idle'"
          @click="markAsPaid"
        >
          <template #icon><Banknote /></template>
          {{ t("order.markAsPaid") }}
        </BaseButton>
        <BaseButton
          v-if="refundOptions.length && refundableLines.length"
          :disabled="orderStore.isMutating"
          @click="setMode('refund')"
        >
          <template #icon><X v-if="mode === 'refund'" /><RotateCcw v-else /></template>
          {{ mode === "refund" ? t("common.close") : t("financial.refund") }}
        </BaseButton>
      </div>
    </header>

    <div v-if="isLoadingTransactions" class="panel-note" role="status">
      {{ t("financial.loadingTransactions") }}
    </div>
    <div v-else-if="transactionError" class="panel-error" role="alert">
      {{ transactionError }}
    </div>

    <form v-if="mode === 'capture'" class="form-grid" @submit.prevent="capturePayment">
      <label>
        <span>{{ t("financial.authorization") }}</span>
        <select v-model="selectedAuthorizationId" @change="syncCaptureAmount">
          <option
            v-for="option in captureOptions"
            :key="option.transaction.id"
            :value="String(option.transaction.id)"
          >
            {{ option.transaction.gateway || t("financial.payment") }} ·
            {{ t("financial.remaining", { amount: fmtMoney(option.remaining, option.transaction.currency) }) }}
          </option>
        </select>
      </label>
      <label>
        <span>Amount ({{ order.currency }})</span>
        <input v-model="captureAmount" type="number" min="0.01" step="0.01" required />
      </label>
      <label class="check-row">
        <input v-model="finalCapture" type="checkbox" />
        <span>{{ t("financial.finalCapture") }}</span>
      </label>
      <div class="form-actions">
        <BaseButton
          variant="primary"
          :loading="orderStore.isMutating"
          :disabled="!selectedAuthorizationId || Number(captureAmount) <= 0"
          @click="capturePayment"
        >
          {{ t("financial.capturePayment") }}
        </BaseButton>
      </div>
    </form>

    <form
      v-else-if="mode === 'void'"
      class="form-grid"
      @submit.prevent="voidAuthorization"
    >
      <label>
        <span>{{ t("financial.uncapturedAuthorization") }}</span>
        <select v-model="selectedVoidTransactionId">
          <option
            v-for="option in voidOptions"
            :key="option.transaction.id"
            :value="String(option.transaction.id)"
          >
            {{ option.transaction.gateway || t("financial.payment") }} ·
            {{
              fmtMoney(
                option.remaining,
                option.transaction.currency,
              )
            }}
            {{ t("financial.uncaptured") }}
          </option>
        </select>
      </label>
      <p class="void-warning">
        {{ t("financial.voidWarning") }}
      </p>
      <div class="form-actions">
        <BaseButton
          variant="danger"
          :loading="orderStore.isMutating"
          :disabled="!selectedVoidTransactionId"
          @click="voidAuthorization"
        >
          {{ t("order.voidAuthorization") }}
        </BaseButton>
      </div>
    </form>

    <form
      v-else-if="mode === 'manual'"
      class="form-grid"
      @submit.prevent="createManualPayment"
    >
      <label>
        <span>{{ t("financial.amount", { currency: order.currency }) }}</span>
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
        <span>{{ t("financial.paymentMethod") }}</span>
        <input
          v-model.trim="manualPaymentMethod"
          :placeholder="t('financial.paymentMethodPlaceholder')"
        />
      </label>
      <label>
        <span>{{ t("financial.processedAtOptional") }}</span>
        <input v-model="manualPaymentProcessedAt" type="datetime-local" />
      </label>
      <p class="manual-help">
        {{ t("financial.manualPaymentHelp") }}
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
          {{ t("financial.recordManualPayment") }}
        </BaseButton>
      </div>
    </form>

    <form
      v-else-if="mode === 'refund'"
      class="refund-form"
      @submit.prevent="createRefund"
    >
      <label>
        <span>{{ t("financial.refundFromTransaction") }}</span>
        <select v-model="selectedRefundTransactionId">
          <option
            v-for="option in refundOptions"
            :key="option.transaction.id"
            :value="String(option.transaction.id)"
          >
            {{ option.transaction.gateway || t("financial.payment") }} ·
            {{ t("financial.refundable", { amount: fmtMoney(option.remaining, option.transaction.currency) }) }}
          </option>
        </select>
      </label>

      <div class="refund-lines">
        <div class="field-label">{{ t("financial.refundLineItems") }}</div>
        <div v-for="entry in refundableLines" :key="entry.lineItem.id" class="refund-line">
          <div>
            <strong>{{ entry.lineItem.name || entry.lineItem.title || t("financial.item") }}</strong>
            <small>{{ t("financial.available", { count: entry.remaining }) }}</small>
          </div>
          <input
            v-model.number="refundQuantities[String(entry.lineItem.id)]"
            type="number"
            min="0"
            :max="entry.remaining"
            step="1"
            :aria-label="t('financial.refundQuantity')"
          />
          <select
            v-model="refundRestockTypes[String(entry.lineItem.id)]"
            :aria-label="t('financial.refundRestockAction')"
          >
            <option value="NO_RESTOCK">{{ t("financial.doNotRestock") }}</option>
            <option value="CANCEL">{{ t("financial.restockUnfulfilled") }}</option>
            <option value="RETURN">{{ t("financial.restockReturned") }}</option>
          </select>
        </div>
      </div>

      <div class="form-grid compact">
        <label>
          <span>{{ t("financial.refundAmount", { currency: order.currency }) }}</span>
          <input v-model="refundAmount" type="number" min="0.01" step="0.01" required />
        </label>
        <label>
          <span>{{ t("financial.internalNote") }}</span>
          <input v-model="refundNote" :placeholder="t('financial.refundReasonPlaceholder')" />
        </label>
        <label>
          <span>{{ t("financial.adjustmentReason") }}</span>
          <select v-model="refundDiscrepancyReason">
            <option value="OTHER">{{ t("financial.reasonOther") }}</option>
            <option value="CUSTOMER">{{ t("financial.reasonCustomer") }}</option>
            <option value="DAMAGE">{{ t("financial.reasonDamage") }}</option>
            <option value="RESTOCK">{{ t("financial.reasonRestock") }}</option>
          </select>
        </label>
        <label class="check-row">
          <input v-model="notifyCustomer" type="checkbox" />
          <span>{{ t("order.notifyCustomer") }}</span>
        </label>
      </div>
      <p class="amount-help">
        {{ t("financial.amountHelp") }}
      </p>
      <div class="form-actions">
        <BaseButton
          variant="danger"
          :loading="orderStore.isMutating"
          :disabled="!selectedRefundLines.length || Number(refundAmount) <= 0"
          @click="createRefund"
        >
          {{ t("financial.issuePartialRefund") }}
        </BaseButton>
      </div>
    </form>

    <div v-if="orderStore.mutationError" class="panel-error" role="alert">
      {{ orderStore.mutationError }}
    </div>

    <section class="transaction-history" aria-labelledby="transaction-history-title">
      <div class="transaction-history-head">
        <div>
          <strong id="transaction-history-title">{{ t("financial.transactionHistory") }}</strong>
          <span>{{ t("financial.totalCount", { count: transactionCount || transactions.length }) }}</span>
        </div>
        <label class="currency-toggle">
          <input v-model="showShopCurrency" type="checkbox" />
          <span>{{ t("financial.showShopCurrency") }}</span>
        </label>
      </div>
      <div v-if="transactions.length" class="transaction-table-wrap">
        <table class="transaction-table">
          <thead>
            <tr>
              <th>{{ t("financial.kind") }}</th>
              <th>{{ t("financial.status") }}</th>
              <th>{{ t("financial.gateway") }}</th>
              <th>{{ t("financial.processed") }}</th>
              <th class="right">{{ t("financial.amountColumn") }}</th>
              <th :aria-label="t('financial.actions')" />
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
                        ? t("common.loading")
                        : expandedTransactionId === String(transaction.id)
                          ? t("financial.hide")
                          : t("financial.details")
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
                        <dt>{{ t("financial.transactionId") }}</dt>
                        <dd>
                          {{ transactionDetails[String(transaction.id)]?.id }}
                        </dd>
                      </div>
                      <div>
                        <dt>{{ t("financial.parentId") }}</dt>
                        <dd>
                          {{
                            transactionDetails[String(transaction.id)]?.parent_id ||
                            "—"
                          }}
                        </dd>
                      </div>
                      <div>
                        <dt>{{ t("financial.authorizationExpires") }}</dt>
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
                        <dt>{{ t("financial.manualGateway") }}</dt>
                        <dd>
                          {{
                            transactionDetails[String(transaction.id)]
                              ?.manual_payment_gateway
                              ? t("financial.yes")
                              : t("financial.no")
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
                      <strong>{{ t("financial.extendedAuthorization") }}</strong>
                      <pre>{{
                        formattedExtendedAuthorizationAttributes[
                          String(transaction.id)
                        ]
                      }}</pre>
                    </div>
                  </div>
                  <div v-else class="detail-loading">
                    {{ t("financial.loadingTransactionDetails") }}
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
      <div v-else-if="!isLoadingTransactions" class="panel-note">
        {{ t("financial.noTransactions") }}
      </div>
    </section>
  </section>
</template>

<style scoped src="../../assets/styles/components/order-financial-actions.css"></style>
