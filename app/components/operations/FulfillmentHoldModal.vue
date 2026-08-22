<script setup lang="ts">
import { PauseCircle, X } from "@lucide/vue";
import { ref, useId } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useCommerceOpsStore } from "~/stores/commerceOps";
import type {
  FulfillmentHoldReason,
  FulfillmentOrderSummary,
} from "~~/types/shopify-operations";

const props = defineProps<{ item: FulfillmentOrderSummary }>();
const emit = defineEmits<{ close: []; succeeded: [] }>();
const store = useCommerceOpsStore();
const { storeId, token } = useActiveShopAuth();
const { t } = useLocalization();
const feedback = useStoreFeedback();
const modalRef = ref<HTMLFormElement | null>(null);
const titleId = `hold-fulfillment-title-${useId()}`;
const { handleKeydown } = useFocusTrap(modalRef, {
  initialFocus: () => modalRef.value?.querySelector("button[role='combobox']") || null,
  onEscape: () => emit("close"),
});
const reason = ref<FulfillmentHoldReason>("INVENTORY_OUT_OF_STOCK");
const reasonNotes = ref("");
const localError = ref("");
const reasonOptions = [
  {
    label: t("operations.fulfillment.reasonOutOfStock"),
    value: "INVENTORY_OUT_OF_STOCK",
  },
  {
    label: t("operations.fulfillment.reasonFraud"),
    value: "HIGH_RISK_OF_FRAUD",
  },
  {
    label: t("operations.fulfillment.reasonPayment"),
    value: "AWAITING_PAYMENT",
  },
  {
    label: t("operations.fulfillment.reasonAddress"),
    value: "INCORRECT_ADDRESS",
  },
  {
    label: t("operations.fulfillment.reasonDeliveryDate"),
    value: "UNKNOWN_DELIVERY_DATE",
  },
  {
    label: t("operations.fulfillment.reasonReturnItems"),
    value: "AWAITING_RETURN_ITEMS",
  },
  { label: t("operations.fulfillment.reasonOther"), value: "OTHER" },
];

async function submit() {
  localError.value = "";
  const result = await store.actOnFulfillmentOrder(
    storeId.value,
    token.value,
    props.item.id,
    "hold",
    { reason: reason.value, reasonNotes: reasonNotes.value.trim() },
  );
  if (!result) {
    localError.value = store.mutationError || t("operations.fulfillment.actionFailed");
    return;
  }
  feedback.success(t("operations.fulfillment.held"));
  emit("succeeded");
}
</script>

<template>
  <Teleport to="body">
    <div class="ops-modal-backdrop" @click.self="emit('close')">
      <form
        ref="modalRef"
        class="ops-modal"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        tabindex="-1"
        @keydown="handleKeydown"
        @submit.prevent="submit"
      >
        <header>
          <div>
            <p class="ops-eyebrow">{{ t("operations.fulfillments") }}</p>
            <h2 :id="titleId">
              {{ t("operations.fulfillment.holdTitle", { name: item.orderName }) }}
            </h2>
          </div>
          <BaseButton
            class="ops-modal-close"
            variant="ghost"
            icon-only
            :aria-label="t('common.close')"
            @click="emit('close')"
          >
            <template #icon><X /></template>
          </BaseButton>
        </header>
        <div class="ops-form-grid">
          <label class="ops-form-wide">
            <span>{{ t("operations.fulfillment.holdReason") }}</span>
            <BaseSelect
              :model-value="reason"
              :options="reasonOptions"
              :disabled="store.isMutating"
              :aria-label="t('operations.fulfillment.holdReason')"
              @update:model-value="reason = String($event) as FulfillmentHoldReason"
            />
          </label>
          <label class="ops-form-wide">
            <span>{{ t("operations.fulfillment.holdNotes") }}</span>
            <textarea
              v-model="reasonNotes"
              rows="4"
              maxlength="500"
              :placeholder="t('operations.fulfillment.holdNotesPlaceholder')"
            />
          </label>
        </div>
        <p v-if="localError" class="ops-form-error" role="alert">{{ localError }}</p>
        <footer>
          <BaseButton :disabled="store.isMutating" @click="emit('close')">
            {{ t("common.cancel") }}
          </BaseButton>
          <BaseButton type="submit" variant="primary" :loading="store.isMutating">
            <template #icon><PauseCircle /></template>
            {{ t("operations.fulfillment.hold") }}
          </BaseButton>
        </footer>
      </form>
    </div>
  </Teleport>
</template>
