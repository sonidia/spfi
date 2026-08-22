<script setup lang="ts">
import { Route, X } from "@lucide/vue";
import { computed, ref, useId, watch } from "vue";
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
const titleId = `tracking-fulfillment-title-${useId()}`;
const { handleKeydown } = useFocusTrap(modalRef, {
  initialFocus: () => modalRef.value?.querySelector("button[role='combobox']") || null,
  onEscape: () => emit("close"),
});
const selectedFulfillmentId = ref(props.item.fulfillments[0]?.id || "");
const trackingNumber = ref("");
const trackingCompany = ref("");
const trackingUrl = ref("");
const notifyCustomer = ref(false);
const localError = ref("");
const selectedFulfillment = computed(() =>
  props.item.fulfillments.find(
    (fulfillment) => fulfillment.id === selectedFulfillmentId.value,
  ),
);
const hasMultiplePackages = computed(
  () => (selectedFulfillment.value?.tracking.length || 0) > 1,
);
const fulfillmentOptions = computed(() =>
  props.item.fulfillments.map((fulfillment) => ({
    label: fulfillment.name,
    value: fulfillment.id,
    description: fulfillment.displayStatus || fulfillment.status,
  })),
);
const hasValidTracking = computed(() => {
  if (trackingNumber.value.trim()) return true;
  try {
    const url = new URL(trackingUrl.value.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
});

watch(
  selectedFulfillment,
  (fulfillment) => {
    const tracking = fulfillment?.tracking[0];
    trackingNumber.value = tracking?.number || "";
    trackingCompany.value = tracking?.company || "";
    trackingUrl.value = tracking?.url || "";
  },
  { immediate: true },
);

async function submit() {
  localError.value = "";
  if (!hasValidTracking.value) {
    localError.value = t("operations.fulfillment.trackingRequired");
    return;
  }
  if (hasMultiplePackages.value || !selectedFulfillmentId.value) return;
  const result = await store.actOnFulfillmentOrder(
    storeId.value,
    token.value,
    selectedFulfillmentId.value,
    "updateTracking",
    {
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
  feedback.success(t("operations.fulfillment.trackingUpdated"));
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
            <p class="ops-eyebrow">{{ item.orderName }}</p>
            <h2 :id="titleId">{{ t("operations.fulfillment.trackingTitle") }}</h2>
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
            <span>{{ t("operations.fulfillment.chooseFulfillment") }}</span>
            <BaseSelect
              :model-value="selectedFulfillmentId"
              :options="fulfillmentOptions"
              :disabled="store.isMutating"
              :aria-label="t('operations.fulfillment.chooseFulfillment')"
              @update:model-value="selectedFulfillmentId = String($event || '')"
            />
          </label>
          <p
            v-if="hasMultiplePackages"
            class="ops-form-wide fulfillment-tracking-warning"
            role="alert"
          >
            {{ t("operations.fulfillment.multiTrackingHint") }}
          </p>
          <FulfillmentTrackingFields
            v-model:number="trackingNumber"
            v-model:company="trackingCompany"
            v-model:url="trackingUrl"
            v-model:notify-customer="notifyCustomer"
            :disabled="store.isMutating || hasMultiplePackages"
          />
        </div>
        <p v-if="localError" class="ops-form-error" role="alert">{{ localError }}</p>
        <footer>
          <BaseButton :disabled="store.isMutating" @click="emit('close')">
            {{ t("common.cancel") }}
          </BaseButton>
          <BaseButton
            type="submit"
            variant="primary"
            :disabled="!hasValidTracking || hasMultiplePackages"
            :loading="store.isMutating"
          >
            <template #icon><Route /></template>
            {{ t("common.save") }}
          </BaseButton>
        </footer>
      </form>
    </div>
  </Teleport>
</template>

<style scoped>
.fulfillment-tracking-warning {
  margin: 0;
  padding: 10px 12px;
  border-radius: var(--control-radius);
  background: var(--surface-soft);
  color: var(--text-sub);
  font-size: 12px;
  line-height: 1.5;
}
</style>
