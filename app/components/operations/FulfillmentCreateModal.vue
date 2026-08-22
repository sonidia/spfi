<script setup lang="ts">
import { PackageCheck, X } from "@lucide/vue";
import { computed, reactive, ref, useId } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useCommerceOpsStore } from "~/stores/commerceOps";
import type { FulfillmentOrderSummary } from "~~/types/shopify-operations";

const props = defineProps<{ item: FulfillmentOrderSummary }>();
const emit = defineEmits<{ close: []; succeeded: [] }>();
const store = useCommerceOpsStore();
const { storeId, token } = useActiveShopAuth();
const { t } = useLocalization();
const feedback = useStoreFeedback();
const modalRef = ref<HTMLFormElement | null>(null);
const titleId = `fulfill-order-title-${useId()}`;
const { handleKeydown } = useFocusTrap(modalRef, {
  initialFocus: () => modalRef.value?.querySelector("input") || null,
  onEscape: () => emit("close"),
});
const quantities = reactive(
  Object.fromEntries(
    props.item.lineItems.map((lineItem) => [lineItem.id, 0]),
  ) as Record<string, number>,
);
const trackingNumber = ref("");
const trackingCompany = ref("");
const trackingUrl = ref("");
const notifyCustomer = ref(true);
const localError = ref("");

const selectedLineItems = computed(() =>
  props.item.lineItems
    .map((lineItem) => ({
      id: lineItem.id,
      quantity: normalizedQuantity(lineItem.id, lineItem.remainingQuantity),
    }))
    .filter((lineItem) => lineItem.quantity > 0),
);
const selectedQuantity = computed(() =>
  selectedLineItems.value.reduce((total, item) => total + item.quantity, 0),
);

function normalizedQuantity(id: string, maximum: number) {
  return Math.min(maximum, Math.max(0, Math.floor(Number(quantities[id]) || 0)));
}

function normalizeQuantity(id: string, maximum: number) {
  quantities[id] = normalizedQuantity(id, maximum);
}

async function submit() {
  localError.value = "";
  if (!selectedLineItems.value.length) {
    localError.value = t("operations.fulfillment.selectAtLeastOne");
    return;
  }
  const result = await store.actOnFulfillmentOrder(
    storeId.value,
    token.value,
    props.item.id,
    "fulfill",
    {
      lineItems: selectedLineItems.value,
      number: trackingNumber.value.trim(),
      company: trackingCompany.value.trim(),
      url: trackingUrl.value.trim(),
      notifyCustomer: notifyCustomer.value,
    },
  );
  if (!result) {
    localError.value = store.mutationError || t("operations.fulfillment.actionFailed");
    return;
  }
  feedback.success(t("operations.fulfillment.created"));
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
              {{ t("operations.fulfillment.fulfillTitle", { name: item.orderName }) }}
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
          <p class="ops-form-wide fulfillment-modal-hint">
            {{ t("operations.fulfillment.fulfillHint") }}
          </p>
          <div class="ops-form-wide fulfillment-modal-items">
            <label v-for="lineItem in item.lineItems" :key="lineItem.id">
              <span class="fulfillment-item-copy">
                <strong>{{ lineItem.title }}</strong>
                <small>
                  {{
                    t("operations.fulfillment.available", {
                      count: lineItem.remainingQuantity,
                    })
                  }}
                  <template v-if="lineItem.sku"> · {{ lineItem.sku }}</template>
                </small>
              </span>
              <span class="fulfillment-quantity-field">
                <span>{{ t("operations.fulfillment.quantity") }}</span>
                <input
                  v-model.number="quantities[lineItem.id]"
                  type="number"
                  min="0"
                  :max="lineItem.remainingQuantity"
                  step="1"
                  @change="normalizeQuantity(lineItem.id, lineItem.remainingQuantity)"
                />
              </span>
            </label>
          </div>
          <small v-if="item.lineItemsTruncated" class="ops-form-wide">
            {{ t("operations.fulfillment.moreItems") }}
          </small>
          <FulfillmentTrackingFields
            v-model:number="trackingNumber"
            v-model:company="trackingCompany"
            v-model:url="trackingUrl"
            v-model:notify-customer="notifyCustomer"
            :disabled="store.isMutating"
          />
        </div>
        <p v-if="localError" class="ops-form-error" role="alert">{{ localError }}</p>
        <footer>
          <BaseButton type="button" :disabled="store.isMutating" @click="emit('close')">
            {{ t("common.cancel") }}
          </BaseButton>
          <BaseButton
            type="submit"
            variant="primary"
            :disabled="!selectedLineItems.length"
            :loading="store.isMutating"
          >
            <template #icon><PackageCheck /></template>
            {{ t("operations.fulfillment.fulfill") }} ({{ selectedQuantity }})
          </BaseButton>
        </footer>
      </form>
    </div>
  </Teleport>
</template>

<style scoped>
.fulfillment-modal-hint {
  margin: 0;
  color: var(--text-sub);
  font-size: 12px;
}

.fulfillment-modal-items {
  display: grid;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--control-radius);
}

.fulfillment-modal-items > label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
}

.fulfillment-modal-items > label:last-child {
  border-bottom: 0;
}

.fulfillment-item-copy,
.fulfillment-quantity-field {
  display: grid;
  gap: 3px;
}

.fulfillment-item-copy {
  min-width: 0;
}

.fulfillment-item-copy strong {
  overflow: hidden;
  color: var(--text);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fulfillment-item-copy small,
.fulfillment-quantity-field > span {
  color: var(--text-sub);
  font-size: 10px;
}

.fulfillment-quantity-field {
  flex: 0 0 90px;
}

.fulfillment-quantity-field input {
  min-height: var(--control-height-sm);
}
</style>
