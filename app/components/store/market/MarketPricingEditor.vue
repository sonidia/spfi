<script setup lang="ts">
import { Save } from "@lucide/vue";
import { computed, reactive, ref, watch } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useMarketStore } from "~/stores/market";
import type {
  ShopifyMarketDutyStrategy,
  ShopifyMarketSummary,
  ShopifyMarketTaxStrategy,
} from "~~/types/shopify-market";

const props = defineProps<{ market: ShopifyMarketSummary }>();
const marketStore = useMarketStore();
const { storeId, token } = useActiveShopAuth();
const { requestConfirmation } = useConfirmDialog();
const { t } = useLocalization();
const feedback = useStoreFeedback();
const error = ref("");
const form = reactive({
  hasCurrency: true,
  baseCurrency: "",
  manualRate: "",
  localCurrencies: false,
  roundingEnabled: false,
  hasPriceInclusions: true,
  adaptivePricingEnabled: false,
  taxStrategy: "ADD_TAXES_AT_CHECKOUT" as ShopifyMarketTaxStrategy,
  dutyStrategy: "ADD_DUTIES_AT_CHECKOUT" as ShopifyMarketDutyStrategy,
});

watch(
  () => props.market,
  (market) => {
    Object.assign(form, {
      hasCurrency: Boolean(market.currencySettings),
      baseCurrency: market.currencySettings?.baseCurrencyCode || "",
      manualRate: market.currencySettings?.manualRate || "",
      localCurrencies: market.currencySettings?.localCurrencies || false,
      roundingEnabled: market.currencySettings?.roundingEnabled || false,
      hasPriceInclusions: Boolean(market.priceInclusions),
      adaptivePricingEnabled: market.priceInclusions?.adaptivePricingEnabled || false,
      taxStrategy:
        (market.priceInclusions?.taxesStrategy as ShopifyMarketTaxStrategy) ||
        "ADD_TAXES_AT_CHECKOUT",
      dutyStrategy:
        (market.priceInclusions?.dutiesStrategy as ShopifyMarketDutyStrategy) ||
        "ADD_DUTIES_AT_CHECKOUT",
    });
    error.value = "";
  },
  { immediate: true },
);

const manualRateDisabled = computed(() => form.localCurrencies);

async function save() {
  error.value = "";
  if (form.hasCurrency && !/^[A-Za-z]{3}$/.test(form.baseCurrency.trim())) {
    error.value = t("markets.editor.pricingValidation");
    return;
  }
  if (form.localCurrencies && form.manualRate.trim()) {
    error.value = t("markets.editor.manualRateConflict");
    return;
  }
  if (!form.hasCurrency || !form.hasPriceInclusions) {
    const confirmed = await requestConfirmation({
      title: t("markets.editor.removePricingTitle"),
      message: t("markets.editor.removePricingMessage"),
      confirmLabel: t("common.save"),
    });
    if (!confirmed) return;
  }
  const market = await marketStore.updateMarket(
    storeId.value,
    token.value,
    "/api/market/pricing",
    props.market.id,
    {
      input: {
        currency: form.hasCurrency
          ? {
              baseCurrency: form.baseCurrency.trim().toUpperCase(),
              manualRate: form.manualRate.trim() || null,
              localCurrencies: form.localCurrencies,
              roundingEnabled: form.roundingEnabled,
            }
          : null,
        priceInclusions: form.hasPriceInclusions
          ? {
              adaptivePricingEnabled: form.adaptivePricingEnabled,
              taxPricingStrategy: form.taxStrategy,
              dutiesPricingStrategy: form.dutyStrategy,
            }
          : null,
      },
    },
  );
  if (!market) {
    error.value = marketStore.managerError || t("markets.editor.saveFailed");
    return;
  }
  feedback.success(t("markets.editor.pricingSaved"));
}
</script>

<template>
  <form class="market-editor-section" @submit.prevent="save">
    <div class="market-section-heading">
      <div>
        <h3>{{ t("markets.editor.pricingTitle") }}</h3>
        <p>{{ t("markets.editor.pricingDescription") }}</p>
      </div>
    </div>

    <fieldset class="market-fieldset">
      <legend>{{ t("markets.editor.currencySettings") }}</legend>
      <BaseCheckbox
        v-model="form.hasCurrency"
        :label="t('markets.editor.overrideCurrency')"
        :description="t('markets.editor.overrideCurrencyDescription')"
      />
      <div v-if="form.hasCurrency" class="market-form-grid">
        <label class="market-field">
          <span>{{ t("markets.baseCurrency") }}</span>
          <input v-model="form.baseCurrency" required maxlength="3" placeholder="USD" />
        </label>
        <label class="market-field">
          <span>{{ t("markets.editor.manualRate") }}</span>
          <input
            v-model="form.manualRate"
            type="number"
            min="0.00000001"
            step="any"
            :disabled="manualRateDisabled"
            :placeholder="t('markets.editor.automaticRate')"
          />
          <small>{{ t("markets.editor.manualRateHint") }}</small>
        </label>
      </div>
      <div v-if="form.hasCurrency" class="market-choice-grid">
        <BaseCheckbox
          v-model="form.localCurrencies"
          :label="t('markets.editor.localCurrenciesLabel')"
          :description="t('markets.editor.localCurrenciesDescription')"
          @change="form.manualRate = ''"
        />
        <BaseCheckbox
          v-model="form.roundingEnabled"
          :label="t('markets.editor.roundingLabel')"
          :description="t('markets.editor.roundingDescription')"
        />
      </div>
    </fieldset>

    <fieldset class="market-fieldset">
      <legend>{{ t("markets.editor.priceInclusions") }}</legend>
      <BaseCheckbox
        v-model="form.hasPriceInclusions"
        :label="t('markets.editor.overrideInclusions')"
        :description="t('markets.editor.overrideInclusionsDescription')"
      />
      <template v-if="form.hasPriceInclusions">
        <div class="market-form-grid">
          <label class="market-field">
            <span>{{ t("markets.taxStrategy") }}</span>
            <select v-model="form.taxStrategy">
              <option value="ADD_TAXES_AT_CHECKOUT">
                {{ t("markets.editor.taxCheckout") }}
              </option>
              <option value="INCLUDES_TAXES_IN_PRICE">
                {{ t("markets.editor.taxIncluded") }}
              </option>
              <option value="INCLUDES_TAXES_IN_PRICE_BASED_ON_COUNTRY">
                {{ t("markets.editor.taxCountry") }}
              </option>
            </select>
          </label>
          <label class="market-field">
            <span>{{ t("markets.dutyStrategy") }}</span>
            <select v-model="form.dutyStrategy">
              <option value="ADD_DUTIES_AT_CHECKOUT">
                {{ t("markets.editor.dutyCheckout") }}
              </option>
              <option value="INCLUDE_DUTIES_IN_PRICE">
                {{ t("markets.editor.dutyIncluded") }}
              </option>
            </select>
          </label>
        </div>
        <BaseCheckbox
          v-model="form.adaptivePricingEnabled"
          :label="t('markets.editor.adaptivePricing')"
          :description="t('markets.editor.adaptivePricingDescription')"
        />
        <div v-if="form.adaptivePricingEnabled" class="market-callout is-warning">
          <strong>{{ t("markets.editor.managedMarketsOnly") }}</strong>
          <span>{{ t("markets.editor.adaptivePricingWarning") }}</span>
        </div>
      </template>
    </fieldset>

    <p v-if="error" class="market-form-error" role="alert">{{ error }}</p>
    <div class="market-section-actions">
      <BaseButton type="submit" variant="primary" :loading="marketStore.isManaging">
        <template #icon><Save /></template>{{ t("common.save") }}
      </BaseButton>
    </div>
  </form>
</template>
