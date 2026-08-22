<script setup lang="ts">
import { MapPin, X } from "@lucide/vue";
import { computed, onMounted, ref, useId } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useCommerceOpsApi } from "~/composables/useCommerceOpsApi";
import { useCommerceOpsStore } from "~/stores/commerceOps";
import type {
  FulfillmentMoveLocation,
  FulfillmentOrderSummary,
} from "~~/types/shopify-operations";
import { getAppErrorMessage } from "~~/utils/error";

const props = defineProps<{ item: FulfillmentOrderSummary }>();
const emit = defineEmits<{ close: []; succeeded: [] }>();
const api = useCommerceOpsApi();
const store = useCommerceOpsStore();
const { storeId, token } = useActiveShopAuth();
const { t } = useLocalization();
const feedback = useStoreFeedback();
const modalRef = ref<HTMLFormElement | null>(null);
const titleId = `move-fulfillment-title-${useId()}`;
const { handleKeydown } = useFocusTrap(modalRef, {
  initialFocus: () => modalRef.value?.querySelector("button[role='combobox']") || null,
  onEscape: () => emit("close"),
});
const locations = ref<FulfillmentMoveLocation[]>([]);
const selectedLocationId = ref<string | null>(null);
const isLoading = ref(true);
const truncated = ref(false);
const localError = ref("");
const locationOptions = computed(() =>
  locations.value.map((location) => ({
    label: location.name,
    value: location.id,
    description: location.message || undefined,
    disabled: !location.movable,
  })),
);
const canSubmit = computed(() =>
  locations.value.some(
    (location) => location.id === selectedLocationId.value && location.movable,
  ),
);

onMounted(loadLocations);

async function loadLocations() {
  isLoading.value = true;
  localError.value = "";
  try {
    const response = await api.listFulfillmentMoveLocations(
      { storeId: storeId.value, token: token.value },
      props.item.id,
    );
    locations.value = response.items;
    truncated.value = response.truncated;
    selectedLocationId.value =
      response.items.find((location) => location.movable)?.id || null;
  } catch (error) {
    localError.value = getAppErrorMessage(
      error,
      t("operations.fulfillment.actionFailed"),
    );
  } finally {
    isLoading.value = false;
  }
}

async function submit() {
  localError.value = "";
  if (!canSubmit.value || !selectedLocationId.value) return;
  const result = await store.actOnFulfillmentOrder(
    storeId.value,
    token.value,
    props.item.id,
    "move",
    { locationId: selectedLocationId.value },
  );
  if (!result) {
    localError.value = store.mutationError || t("operations.fulfillment.actionFailed");
    return;
  }
  feedback.success(t("operations.fulfillment.moved"));
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
              {{ t("operations.fulfillment.moveTitle", { name: item.orderName }) }}
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
          <p class="ops-form-wide fulfillment-move-hint">
            {{ t("operations.fulfillment.moveHint") }}
          </p>
          <div
            v-if="isLoading"
            class="ops-form-wide fulfillment-move-state"
            role="status"
          >
            {{ t("operations.fulfillment.loadingLocations") }}
          </div>
          <label v-else-if="locations.length" class="ops-form-wide">
            <span>{{ t("operations.fulfillment.moveLocation") }}</span>
            <BaseSelect
              :model-value="selectedLocationId"
              :options="locationOptions"
              :disabled="store.isMutating"
              :aria-label="t('operations.fulfillment.moveLocation')"
              @update:model-value="selectedLocationId = String($event || '') || null"
            />
          </label>
          <div v-else class="ops-form-wide fulfillment-move-state">
            {{ t("operations.fulfillment.noMoveLocation") }}
          </div>
          <small v-if="truncated" class="ops-form-wide">
            {{ t("operations.fulfillment.locationsTruncated") }}
          </small>
        </div>
        <p v-if="localError" class="ops-form-error" role="alert">{{ localError }}</p>
        <footer>
          <BaseButton :disabled="store.isMutating" @click="emit('close')">
            {{ t("common.cancel") }}
          </BaseButton>
          <BaseButton
            type="submit"
            variant="primary"
            :disabled="!canSubmit"
            :loading="store.isMutating"
          >
            <template #icon><MapPin /></template>
            {{ t("operations.fulfillment.move") }}
          </BaseButton>
        </footer>
      </form>
    </div>
  </Teleport>
</template>

<style scoped>
.fulfillment-move-hint {
  margin: 0;
  color: var(--text-sub);
  font-size: 12px;
}

.fulfillment-move-state {
  padding: 22px 12px;
  border: 1px dashed var(--border);
  border-radius: var(--control-radius);
  color: var(--text-sub);
  text-align: center;
  font-size: 12px;
}
</style>
