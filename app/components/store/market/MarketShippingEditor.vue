<script setup lang="ts">
import { Plus, Save, Trash2 } from "@lucide/vue";
import { computed, reactive, ref, watch } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useMarketStore } from "~/stores/market";
import type {
  ShopifyMarketEditorContext,
  ShopifyMarketShippingOptionInput,
  ShopifyMarketShippingOptionType,
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
const updateOptions = ref<
  Array<{ id: string; type: ShopifyMarketShippingOptionType; active: boolean }>
>([]);
const createOptions = ref<ShopifyMarketShippingOptionInput[]>([]);
const showBuilder = ref(false);
const error = ref("");
const draft = reactive({
  type: "FLAT_RATE" as ShopifyMarketShippingOptionType,
  name: "",
  description: "",
  currency: "",
  active: true,
  freeDeliveryMinimumValue: "",
  price: "",
  minimum: "0",
  maximum: "",
  weightUnit: "KILOGRAMS" as "GRAMS" | "KILOGRAMS" | "OUNCES" | "POUNDS",
  carrierServiceId: "",
  percentageAdjustment: "",
});

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
    draft.currency = market.currencySettings?.baseCurrencyCode || "USD";
    error.value = "";
  },
  { immediate: true },
);

const requiresName = computed(() => draft.type !== "CARRIER_CALCULATED");
const requiresPrice = computed(() => draft.type !== "CARRIER_CALCULATED");

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

function toggleActive(
  id: string,
  type: ShopifyMarketShippingOptionType,
  current: boolean,
) {
  updateOptions.value = [
    ...updateOptions.value.filter((item) => item.id !== id),
    { id, type, active: !activeValue(id, current) },
  ];
  deleteOptionIds.value = deleteOptionIds.value.filter((item) => item !== id);
}

function resetDraft() {
  Object.assign(draft, {
    type: "FLAT_RATE",
    name: "",
    description: "",
    currency: props.market.currencySettings?.baseCurrencyCode || "USD",
    active: true,
    freeDeliveryMinimumValue: "",
    price: "",
    minimum: "0",
    maximum: "",
    weightUnit: "KILOGRAMS",
    carrierServiceId: "",
    percentageAdjustment: "",
  });
}

function queueOption() {
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
  createOptions.value.push({
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
  resetDraft();
  showBuilder.value = false;
}

async function save() {
  error.value = "";
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
              @click="toggleActive(option.id, option.type, option.active)"
            >
              {{
                activeValue(option.id, option.active)
                  ? t("markets.editor.disableOption")
                  : t("markets.editor.enableOption")
              }}
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

      <fieldset v-if="showBuilder" class="market-fieldset market-option-builder">
        <legend>{{ t("markets.editor.newShippingOption") }}</legend>
        <div class="market-form-grid">
          <label class="market-field">
            <span>{{ t("markets.editor.optionType") }}</span>
            <select v-model="draft.type">
              <option value="FLAT_RATE">
                {{ t("markets.editor.shippingTypeFlatRate") }}
              </option>
              <option value="VALUE_BASED">
                {{ t("markets.editor.shippingTypeValueBased") }}
              </option>
              <option value="WEIGHT_BASED">
                {{ t("markets.editor.shippingTypeWeightBased") }}
              </option>
              <option value="CARRIER_CALCULATED">
                {{ t("markets.editor.shippingTypeCarrierCalculated") }}
              </option>
            </select>
          </label>
          <label v-if="requiresName" class="market-field"
            ><span>{{ t("markets.editor.optionName") }}</span
            ><input v-model="draft.name" required placeholder="Standard"
          /></label>
          <label class="market-field"
            ><span>{{ t("markets.editor.currency") }}</span
            ><input v-model="draft.currency" required maxlength="3" placeholder="USD"
          /></label>
          <label v-if="requiresPrice" class="market-field"
            ><span>{{ t("markets.editor.price") }}</span
            ><input v-model="draft.price" type="number" min="0" step="0.01" required
          /></label>
          <label
            v-if="draft.type === 'VALUE_BASED' || draft.type === 'WEIGHT_BASED'"
            class="market-field"
            ><span>{{ t("markets.editor.minimum") }}</span
            ><input v-model="draft.minimum" type="number" min="0" step="any" required
          /></label>
          <label
            v-if="draft.type === 'VALUE_BASED' || draft.type === 'WEIGHT_BASED'"
            class="market-field"
            ><span>{{ t("markets.editor.maximumOptional") }}</span
            ><input v-model="draft.maximum" type="number" min="0" step="any"
          /></label>
          <label v-if="draft.type === 'WEIGHT_BASED'" class="market-field"
            ><span>{{ t("markets.editor.weightUnit") }}</span
            ><select v-model="draft.weightUnit">
              <option value="GRAMS">g</option>
              <option value="KILOGRAMS">kg</option>
              <option value="OUNCES">oz</option>
              <option value="POUNDS">lb</option>
            </select></label
          >
          <label v-if="draft.type === 'CARRIER_CALCULATED'" class="market-field"
            ><span>{{ t("markets.editor.carrierService") }}</span
            ><select v-model="draft.carrierServiceId" required>
              <option value="">{{ t("markets.editor.chooseCarrier") }}</option>
              <option
                v-for="carrier in context.carrierServices"
                :key="carrier.id"
                :value="carrier.id"
                :disabled="!carrier.active"
              >
                {{ carrier.name }}
              </option>
            </select></label
          >
          <label v-if="draft.type === 'CARRIER_CALCULATED'" class="market-field"
            ><span>{{ t("markets.editor.percentageAdjustment") }}</span
            ><input
              v-model="draft.percentageAdjustment"
              type="number"
              min="-100"
              max="1000"
              step="1"
              placeholder="0"
          /></label>
          <label class="market-field"
            ><span>{{ t("markets.editor.freeShippingMinimum") }}</span
            ><input
              v-model="draft.freeDeliveryMinimumValue"
              type="number"
              min="0"
              step="0.01"
          /></label>
          <label class="market-field is-wide"
            ><span>{{ t("markets.editor.descriptionOptional") }}</span
            ><input v-model="draft.description" maxlength="255"
          /></label>
        </div>
        <BaseCheckbox
          v-model="draft.active"
          :label="t('markets.editor.optionActive')"
        />
        <div class="market-section-actions">
          <BaseButton @click="showBuilder = false">{{ t("common.cancel") }}</BaseButton
          ><BaseButton variant="primary" @click="queueOption"
            ><template #icon><Plus /></template
            >{{ t("markets.editor.queueOption") }}</BaseButton
          >
        </div>
      </fieldset>
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
