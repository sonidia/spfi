<script setup lang="ts">
import { Plus } from "@lucide/vue";
import { computed, reactive, ref, watch } from "vue";
import type {
  ShopifyMarketEditorContext,
  ShopifyMarketShippingOptionInput,
  ShopifyMarketShippingOptionType,
} from "~~/types/shopify-market";

const props = defineProps<{
  context: ShopifyMarketEditorContext;
  defaultCurrency: string;
}>();
const emit = defineEmits<{
  add: [option: ShopifyMarketShippingOptionInput];
  cancel: [];
}>();
const { t } = useLocalization();
const error = ref("");
const draft = reactive({
  type: "FLAT_RATE" as ShopifyMarketShippingOptionType,
  name: "",
  description: "",
  currency: props.defaultCurrency || "USD",
  active: true,
  freeDeliveryMinimumValue: "",
  price: "",
  minimum: "0",
  maximum: "",
  weightUnit: "KILOGRAMS" as "GRAMS" | "KILOGRAMS" | "OUNCES" | "POUNDS",
  carrierServiceId: "",
  percentageAdjustment: "",
});
const requiresName = computed(() => draft.type !== "CARRIER_CALCULATED");
const requiresPrice = computed(() => draft.type !== "CARRIER_CALCULATED");
const shippingTypeOptions = computed(() => [
  { label: t("markets.editor.shippingTypeFlatRate"), value: "FLAT_RATE" },
  { label: t("markets.editor.shippingTypeValueBased"), value: "VALUE_BASED" },
  { label: t("markets.editor.shippingTypeWeightBased"), value: "WEIGHT_BASED" },
  {
    label: t("markets.editor.shippingTypeCarrierCalculated"),
    value: "CARRIER_CALCULATED",
  },
]);
const weightUnitOptions = [
  { label: "g", value: "GRAMS" },
  { label: "kg", value: "KILOGRAMS" },
  { label: "oz", value: "OUNCES" },
  { label: "lb", value: "POUNDS" },
];
const carrierOptions = computed(() => [
  { label: t("markets.editor.chooseCarrier"), value: "" },
  ...props.context.carrierServices.map((carrier) => ({
    label: carrier.name,
    value: carrier.id,
    disabled: !carrier.active,
  })),
]);

watch(
  () => props.defaultCurrency,
  (currency) => {
    if (/^[A-Za-z]{3}$/.test(currency)) draft.currency = currency.toUpperCase();
  },
);

function add() {
  error.value = "";
  if (!/^[A-Za-z]{3}$/.test(draft.currency.trim())) {
    error.value = t("markets.editor.shippingCurrencyValidation");
    return;
  }
  if (requiresName.value && !draft.name.trim()) {
    error.value = t("markets.editor.shippingNameValidation");
    return;
  }
  if (requiresPrice.value && !draft.price.trim()) {
    error.value = t("markets.editor.shippingPriceValidation");
    return;
  }
  if (draft.type === "CARRIER_CALCULATED" && !draft.carrierServiceId) {
    error.value = t("markets.editor.carrierValidation");
    return;
  }
  if (
    (draft.type === "VALUE_BASED" || draft.type === "WEIGHT_BASED") &&
    draft.maximum.trim() &&
    Number(draft.maximum) < Number(draft.minimum || 0)
  ) {
    error.value = t("markets.editor.shippingRangeValidation");
    return;
  }
  emit("add", {
    type: draft.type,
    name: draft.name.trim() || undefined,
    description: draft.description.trim() || undefined,
    currency: draft.currency.trim().toUpperCase(),
    active: draft.active,
    freeDeliveryMinimumValue: draft.freeDeliveryMinimumValue.trim() || null,
    price: draft.price.trim() || undefined,
    minimum: draft.minimum.trim() || undefined,
    maximum: draft.maximum.trim() || null,
    weightUnit: draft.weightUnit,
    carrierServiceId: draft.carrierServiceId || undefined,
    percentageAdjustment: draft.percentageAdjustment.trim()
      ? Number(draft.percentageAdjustment)
      : null,
  });
}
</script>

<template>
  <fieldset class="market-fieldset market-option-builder">
    <legend>{{ t("markets.editor.newShippingOption") }}</legend>
    <div class="market-form-grid">
      <label class="market-field">
        <span>{{ t("markets.editor.optionType") }}</span>
        <BaseSelect
          :model-value="draft.type"
          :options="shippingTypeOptions"
          :aria-label="t('markets.editor.optionType')"
          @update:model-value="
            draft.type = String($event) as ShopifyMarketShippingOptionType
          "
        />
      </label>
      <label v-if="requiresName" class="market-field">
        <span>{{ t("markets.editor.optionName") }}</span>
        <input v-model="draft.name" required placeholder="Standard" />
      </label>
      <label class="market-field">
        <span>{{ t("markets.editor.currency") }}</span>
        <input v-model="draft.currency" required maxlength="3" placeholder="USD" />
      </label>
      <label v-if="requiresPrice" class="market-field">
        <span>{{ t("markets.editor.price") }}</span>
        <input v-model="draft.price" type="number" min="0" step="0.01" required />
      </label>
      <label
        v-if="draft.type === 'VALUE_BASED' || draft.type === 'WEIGHT_BASED'"
        class="market-field"
      >
        <span>{{ t("markets.editor.minimum") }}</span>
        <input v-model="draft.minimum" type="number" min="0" step="any" required />
      </label>
      <label
        v-if="draft.type === 'VALUE_BASED' || draft.type === 'WEIGHT_BASED'"
        class="market-field"
      >
        <span>{{ t("markets.editor.maximumOptional") }}</span>
        <input v-model="draft.maximum" type="number" min="0" step="any" />
      </label>
      <label v-if="draft.type === 'WEIGHT_BASED'" class="market-field">
        <span>{{ t("markets.editor.weightUnit") }}</span>
        <BaseSelect
          :model-value="draft.weightUnit"
          :options="weightUnitOptions"
          :aria-label="t('markets.editor.weightUnit')"
          @update:model-value="
            draft.weightUnit = String($event) as typeof draft.weightUnit
          "
        />
      </label>
      <label v-if="draft.type === 'CARRIER_CALCULATED'" class="market-field">
        <span>{{ t("markets.editor.carrierService") }}</span>
        <BaseSelect
          :model-value="draft.carrierServiceId"
          :options="carrierOptions"
          :aria-label="t('markets.editor.carrierService')"
          @update:model-value="draft.carrierServiceId = String($event || '')"
        />
      </label>
      <label v-if="draft.type === 'CARRIER_CALCULATED'" class="market-field">
        <span>{{ t("markets.editor.percentageAdjustment") }}</span>
        <input
          v-model="draft.percentageAdjustment"
          type="number"
          min="-100"
          max="1000"
          step="1"
          placeholder="0"
        />
      </label>
      <label class="market-field">
        <span>{{ t("markets.editor.freeShippingMinimum") }}</span>
        <input
          v-model="draft.freeDeliveryMinimumValue"
          type="number"
          min="0"
          step="0.01"
        />
      </label>
      <label class="market-field is-wide">
        <span>{{ t("markets.editor.descriptionOptional") }}</span>
        <input v-model="draft.description" maxlength="255" />
      </label>
    </div>
    <BaseCheckbox v-model="draft.active" :label="t('markets.editor.optionActive')" />
    <p v-if="error" class="market-form-error" role="alert">{{ error }}</p>
    <div class="market-section-actions">
      <BaseButton @click="emit('cancel')">{{ t("common.cancel") }}</BaseButton>
      <BaseButton variant="primary" @click="add">
        <template #icon><Plus /></template>{{ t("markets.editor.queueOption") }}
      </BaseButton>
    </div>
  </fieldset>
</template>
