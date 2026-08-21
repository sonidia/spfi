<script setup lang="ts">
import { Edit3, Plus, Save, Trash2, X } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useMarketStore } from "~/stores/market";
import MarketShippingOptionBuilder from "./MarketShippingOptionBuilder.vue";
import type {
  ShopifyMarketEditorContext,
  ShopifyMarketShippingOptionInput,
  ShopifyMarketShippingOptionSummary,
  ShopifyMarketShippingOptionType,
  ShopifyMarketShippingOptionUpdateInput,
  ShopifyMarketSummary,
} from "~~/types/shopify-market";

const props = defineProps<{
  market: ShopifyMarketSummary;
  context: ShopifyMarketEditorContext;
}>();
const marketStore = useMarketStore();
const { storeId, token } = useActiveShopAuth();
const { requestConfirmation } = useConfirmDialog();
const { t } = useLocalization();
const feedback = useStoreFeedback();
const mode = ref<"INHERIT" | "DISABLED" | "ENABLED">("INHERIT");
const deleteOptionIds = ref<string[]>([]);
const updateOptions = ref<ShopifyMarketShippingOptionUpdateInput[]>([]);
const createOptions = ref<ShopifyMarketShippingOptionInput[]>([]);
const showBuilder = ref(false);
const editingOptionId = ref<string | null>(null);
const error = ref("");
const editingOption = computed(
  () => updateOptions.value.find((item) => item.id === editingOptionId.value) || null,
);
const carrierOptions = computed(() =>
  props.context.carrierServices.map((carrier) => ({
    label: carrier.name,
    value: carrier.id,
    disabled: !carrier.active,
  })),
);
const weightUnitOptions = [
  { label: "g", value: "GRAMS" },
  { label: "kg", value: "KILOGRAMS" },
  { label: "oz", value: "OUNCES" },
  { label: "lb", value: "POUNDS" },
];

watch(
  () => props.market,
  (market) => {
    mode.value = market.shipping.inherits
      ? "INHERIT"
      : market.shipping.enabled
        ? "ENABLED"
        : "DISABLED";
    deleteOptionIds.value = [];
    updateOptions.value = [];
    createOptions.value = [];
    editingOptionId.value = null;
    error.value = "";
  },
  { immediate: true },
);

function typeLabel(type: ShopifyMarketShippingOptionType) {
  if (type === "FLAT_RATE") return t("markets.editor.shippingTypeFlatRate");
  if (type === "VALUE_BASED") return t("markets.editor.shippingTypeValueBased");
  if (type === "WEIGHT_BASED") return t("markets.editor.shippingTypeWeightBased");
  return t("markets.editor.shippingTypeCarrierCalculated");
}

function toggleDelete(id: string) {
  const index = deleteOptionIds.value.indexOf(id);
  if (index >= 0) deleteOptionIds.value.splice(index, 1);
  else {
    deleteOptionIds.value.push(id);
    updateOptions.value = updateOptions.value.filter((item) => item.id !== id);
  }
}

function activeValue(id: string, fallback: boolean) {
  return updateOptions.value.find((item) => item.id === id)?.active ?? fallback;
}

function toggleActive(option: ShopifyMarketShippingOptionSummary) {
  const draft = ensureOptionDraft(option);
  draft.active = !draft.active;
  deleteOptionIds.value = deleteOptionIds.value.filter((item) => item !== option.id);
}

function ensureOptionDraft(option: ShopifyMarketShippingOptionSummary) {
  const existing = updateOptions.value.find((item) => item.id === option.id);
  if (existing) return existing;
  const draft: ShopifyMarketShippingOptionUpdateInput = {
    id: option.id,
    type: option.type,
    name: option.name || undefined,
    description: option.description || "",
    currency: option.currency,
    active: option.active,
    freeDeliveryMinimumValue: option.freeDeliveryMinimumValue,
    rateGroupId: option.rateGroupId,
    rates: option.rates.map((rate) => ({ ...rate })),
    carrierServiceId: option.carrierService?.id,
    percentageAdjustment: option.percentageAdjustment,
  };
  updateOptions.value.push(draft);
  return draft;
}

function editOption(option: ShopifyMarketShippingOptionSummary) {
  ensureOptionDraft(option);
  editingOptionId.value = option.id;
  deleteOptionIds.value = deleteOptionIds.value.filter((item) => item !== option.id);
}

function cancelOptionEdit(id: string) {
  updateOptions.value = updateOptions.value.filter((item) => item.id !== id);
  editingOptionId.value = null;
}

function queueOption(option: ShopifyMarketShippingOptionInput) {
  createOptions.value.push(option);
  showBuilder.value = false;
}

async function save() {
  error.value = "";
  const invalidUpdate = updateOptions.value.some((option) => {
    if (!/^[A-Za-z]{3}$/.test(option.currency.trim())) return true;
    if (option.type !== "CARRIER_CALCULATED" && !option.name?.trim()) return true;
    if (
      option.type === "CARRIER_CALCULATED" &&
      option.percentageAdjustment !== null &&
      option.percentageAdjustment !== undefined &&
      (!Number.isInteger(Number(option.percentageAdjustment)) ||
        Number(option.percentageAdjustment) < -100 ||
        Number(option.percentageAdjustment) > 1000)
    ) {
      return true;
    }
    return (option.rates || []).some(
      (rate) =>
        !String(rate.price ?? "").trim() ||
        Number(rate.price) < 0 ||
        (rate.maximum !== null &&
          String(rate.maximum).trim() !== "" &&
          Number(rate.maximum) < Number(rate.minimum || 0)),
    );
  });
  if (invalidUpdate) {
    error.value = t("markets.editor.shippingUpdateValidation");
    return;
  }
  const confirmed = await requestConfirmation({
    title: t("markets.editor.shippingConfirmTitle"),
    message: t("markets.editor.shippingConfirmMessage", { name: props.market.name }),
    confirmLabel: t("markets.editor.applyShipping"),
    danger: mode.value === "DISABLED",
  });
  if (!confirmed) return;
  const market = await marketStore.updateMarket(
    storeId.value,
    token.value,
    "/api/market/shipping",
    props.market.id,
    {
      input: {
        mode: mode.value,
        createOptions: createOptions.value,
        deleteOptionIds: deleteOptionIds.value,
        updateOptions: updateOptions.value,
      },
    },
  );
  if (!market) {
    error.value = marketStore.managerError || t("markets.editor.saveFailed");
    return;
  }
  feedback.success(t("markets.editor.shippingSaved"));
}
</script>

<template>
  <form class="market-editor-section" @submit.prevent="save">
    <div class="market-section-heading">
      <div>
        <h3>{{ t("markets.editor.shippingTitle") }}</h3>
        <p>{{ t("markets.editor.shippingDescription") }}</p>
      </div>
    </div>
    <div class="market-mode-grid">
      <button
        type="button"
        :class="{ 'is-selected': mode === 'INHERIT' }"
        @click="mode = 'INHERIT'"
      >
        <strong>{{ t("markets.editor.shippingInherit") }}</strong
        ><span>{{ t("markets.editor.shippingInheritDescription") }}</span>
      </button>
      <button
        type="button"
        :class="{ 'is-selected': mode === 'ENABLED' }"
        @click="mode = 'ENABLED'"
      >
        <strong>{{ t("markets.editor.shippingCustom") }}</strong
        ><span>{{ t("markets.editor.shippingCustomDescription") }}</span>
      </button>
      <button
        type="button"
        class="is-danger"
        :class="{ 'is-selected': mode === 'DISABLED' }"
        @click="mode = 'DISABLED'"
      >
        <strong>{{ t("markets.editor.shippingOff") }}</strong
        ><span>{{ t("markets.editor.shippingOffDescription") }}</span>
      </button>
    </div>

    <div v-if="mode === 'INHERIT'" class="market-callout is-info">
      <strong>{{ t("markets.editor.inheritanceTitle") }}</strong
      ><span>{{ t("markets.editor.inheritanceDescription") }}</span>
    </div>
    <div v-else-if="mode === 'DISABLED'" class="market-callout is-danger">
      <strong>{{ t("markets.editor.noShippingTitle") }}</strong
      ><span>{{ t("markets.editor.noShippingDescription") }}</span>
    </div>
    <template v-else>
      <fieldset class="market-fieldset">
        <div class="market-legend-row">
          <div>
            <legend>{{ t("markets.editor.currentShippingOptions") }}</legend>
            <p>{{ t("markets.editor.deleteShippingHint") }}</p>
          </div>
          <BaseButton @click="showBuilder = !showBuilder"
            ><template #icon><Plus /></template
            >{{ t("markets.editor.addShippingOption") }}</BaseButton
          >
        </div>
        <div v-if="!market.shipping.options.length" class="market-empty-small">
          {{ t("markets.editor.noShippingOptions") }}
        </div>
        <div v-else class="market-assignment-cards">
          <article v-for="option in market.shipping.options" :key="option.id">
            <div class="market-option-summary">
              <strong>
                {{
                  option.name || option.carrierService?.name || typeLabel(option.type)
                }}
              </strong>
              <span>
                {{ typeLabel(option.type) }} · {{ option.currency }} ·
                {{
                  activeValue(option.id, option.active)
                    ? t("markets.active")
                    : t("markets.editor.optionInactive")
                }}
              </span>
            </div>
            <BaseButton
              :disabled="deleteOptionIds.includes(option.id)"
              @click="toggleActive(option)"
            >
              {{
                activeValue(option.id, option.active)
                  ? t("markets.editor.disableOption")
                  : t("markets.editor.enableOption")
              }}
            </BaseButton>
            <BaseButton
              variant="ghost"
              icon-only
              :disabled="deleteOptionIds.includes(option.id)"
              :aria-label="t('markets.editor.editShippingOption')"
              @click="editOption(option)"
            >
              <template #icon><Edit3 /></template>
            </BaseButton>
            <BaseButton
              :variant="deleteOptionIds.includes(option.id) ? 'danger' : 'danger-ghost'"
              icon-only
              :aria-label="
                deleteOptionIds.includes(option.id)
                  ? t('markets.editor.undoDelete')
                  : t('common.remove')
              "
              @click="toggleDelete(option.id)"
            >
              <template #icon><Trash2 /></template>
            </BaseButton>
          </article>
        </div>
        <small v-if="market.shipping.optionsTruncated" class="market-warning">{{
          t("markets.editor.shippingOptionsTruncated")
        }}</small>
        <div v-if="editingOption" class="market-inline-editor">
          <div class="market-section-heading is-compact">
            <div>
              <h4>{{ t("markets.editor.editShippingOption") }}</h4>
              <p>{{ t("markets.editor.editShippingOptionHint") }}</p>
            </div>
            <BaseButton
              variant="ghost"
              icon-only
              :aria-label="t('common.close')"
              @click="cancelOptionEdit(editingOption.id)"
            >
              <template #icon><X /></template>
            </BaseButton>
          </div>
          <div class="market-form-grid">
            <label
              v-if="editingOption.type !== 'CARRIER_CALCULATED'"
              class="market-field"
            >
              <span>{{ t("markets.editor.optionName") }}</span>
              <input v-model="editingOption.name" required maxlength="255" />
            </label>
            <label class="market-field">
              <span>{{ t("markets.editor.currency") }}</span>
              <input v-model="editingOption.currency" required maxlength="3" />
            </label>
            <label class="market-field">
              <span>{{ t("markets.editor.freeShippingMinimum") }}</span>
              <input
                v-model="editingOption.freeDeliveryMinimumValue"
                type="number"
                min="0"
                step="0.01"
              />
            </label>
            <label class="market-field is-wide">
              <span>{{ t("markets.editor.descriptionOptional") }}</span>
              <input v-model="editingOption.description" maxlength="255" />
            </label>
            <label
              v-if="editingOption.type === 'CARRIER_CALCULATED'"
              class="market-field"
            >
              <span>{{ t("markets.editor.carrierService") }}</span>
              <BaseSelect
                :model-value="editingOption.carrierServiceId || null"
                :options="carrierOptions"
                :aria-label="t('markets.editor.carrierService')"
                @update:model-value="
                  editingOption.carrierServiceId = String($event || '') || undefined
                "
              />
            </label>
            <label
              v-if="editingOption.type === 'CARRIER_CALCULATED'"
              class="market-field"
            >
              <span>{{ t("markets.editor.percentageAdjustment") }}</span>
              <input
                v-model="editingOption.percentageAdjustment"
                type="number"
                min="-100"
                max="1000"
                step="1"
              />
            </label>
          </div>
          <fieldset
            v-if="editingOption.type !== 'CARRIER_CALCULATED'"
            class="market-fieldset"
          >
            <legend>{{ t("markets.editor.shippingRates") }}</legend>
            <div v-if="!editingOption.rates?.length" class="market-empty-small">
              {{ t("markets.editor.shippingRatesUnavailable") }}
            </div>
            <div v-else class="market-rate-editor-list">
              <div v-for="rate in editingOption.rates" :key="rate.id">
                <label v-if="editingOption.type !== 'FLAT_RATE'" class="market-field">
                  <span>{{ t("markets.editor.minimum") }}</span>
                  <input v-model="rate.minimum" type="number" min="0" step="any" />
                </label>
                <label v-if="editingOption.type !== 'FLAT_RATE'" class="market-field">
                  <span>{{ t("markets.editor.maximumOptional") }}</span>
                  <input v-model="rate.maximum" type="number" min="0" step="any" />
                </label>
                <label class="market-field">
                  <span>{{ t("markets.editor.price") }}</span>
                  <input v-model="rate.price" type="number" min="0" step="0.01" />
                </label>
                <label
                  v-if="editingOption.type === 'WEIGHT_BASED'"
                  class="market-field"
                >
                  <span>{{ t("markets.editor.weightUnit") }}</span>
                  <BaseSelect
                    :model-value="rate.weightUnit || 'KILOGRAMS'"
                    :options="weightUnitOptions"
                    :aria-label="t('markets.editor.weightUnit')"
                    @update:model-value="
                      rate.weightUnit = String($event) as typeof rate.weightUnit
                    "
                  />
                </label>
              </div>
            </div>
            <small
              v-if="
                market.shipping.options.find((item) => item.id === editingOption?.id)
                  ?.ratesTruncated
              "
              class="market-warning"
            >
              {{ t("markets.editor.shippingRatesTruncated") }}
            </small>
          </fieldset>
          <BaseCheckbox
            v-model="editingOption.active"
            :label="t('markets.editor.optionActive')"
          />
          <div class="market-section-actions">
            <BaseButton @click="cancelOptionEdit(editingOption.id)">
              {{ t("common.cancel") }}
            </BaseButton>
            <BaseButton variant="primary" @click="editingOptionId = null">
              {{ t("markets.editor.queueUpdate") }}
            </BaseButton>
          </div>
        </div>
        <div v-if="createOptions.length" class="market-queued-list">
          <strong>{{ t("markets.editor.queuedShippingOptions") }}</strong>
          <div v-for="(option, index) in createOptions" :key="index">
            <span
              >{{ option.name || typeLabel(option.type) }} · {{ option.currency }}</span
            >
            <BaseButton
              variant="danger-ghost"
              icon-only
              :aria-label="t('common.remove')"
              @click="createOptions.splice(index, 1)"
              ><template #icon><Trash2 /></template
            ></BaseButton>
          </div>
        </div>
      </fieldset>

      <MarketShippingOptionBuilder
        v-if="showBuilder"
        :context="context"
        :default-currency="market.currencySettings?.baseCurrencyCode || 'USD'"
        @cancel="showBuilder = false"
        @add="queueOption"
      />
    </template>

    <p v-if="error" class="market-form-error" role="alert">{{ error }}</p>
    <div class="market-section-actions">
      <BaseButton type="submit" variant="primary" :loading="marketStore.isManaging"
        ><template #icon><Save /></template
        >{{ t("markets.editor.applyShipping") }}</BaseButton
      >
    </div>
  </form>
</template>
