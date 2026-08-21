<script setup lang="ts">
import { Boxes, X } from "@lucide/vue";
import { computed, reactive, ref } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useMarketStore } from "~/stores/market";
import type {
  ShopifyMarketCatalogCreateResult,
  ShopifyMarketSummary,
} from "~~/types/shopify-market";

const props = defineProps<{ market: ShopifyMarketSummary }>();
const emit = defineEmits<{
  cancel: [];
  created: [result: ShopifyMarketCatalogCreateResult];
}>();
const marketStore = useMarketStore();
const { storeId, token } = useActiveShopAuth();
const { t } = useLocalization();
const feedback = useStoreFeedback();
const form = reactive({
  title: "",
  status: "DRAFT" as "ACTIVE" | "DRAFT",
  createPriceList: true,
  priceListName: "",
  currency: props.market.currencySettings?.baseCurrencyCode || "USD",
  adjustmentValue: 0,
});
const error = ref("");
const statusOptions = computed(() => [
  { label: t("markets.active"), value: "ACTIVE" },
  { label: t("markets.draft"), value: "DRAFT" },
]);

async function submit() {
  error.value = "";
  const title = form.title.trim();
  const priceListName = form.priceListName.trim() || `${title} pricing`;
  if (!title || (form.createPriceList && !priceListName)) {
    error.value = t("markets.editor.catalogCreateValidation");
    return;
  }
  const result = await marketStore.createCatalog(
    storeId.value,
    token.value,
    props.market.id,
    {
      title,
      status: form.status,
      createPriceList: form.createPriceList,
      ...(form.createPriceList
        ? {
            priceListName,
            currency: form.currency.trim().toUpperCase(),
            adjustmentValue: form.adjustmentValue,
          }
        : {}),
    },
  );
  if (!result) {
    error.value = marketStore.managerError || t("markets.editor.catalogCreateFailed");
    return;
  }
  if (result.warnings.includes("price_list_create_failed")) {
    feedback.warning(t("markets.editor.catalogCreatedPriceListFailed"));
  } else {
    feedback.success(t("markets.editor.catalogCreated"));
  }
  emit("created", result);
}
</script>

<template>
  <form class="market-inline-editor" @submit.prevent="submit">
    <div class="market-section-heading is-compact">
      <div>
        <h4>{{ t("markets.editor.createCatalog") }}</h4>
        <p>{{ t("markets.editor.createCatalogDescription") }}</p>
      </div>
      <BaseButton
        variant="ghost"
        icon-only
        :aria-label="t('common.close')"
        @click="emit('cancel')"
      >
        <template #icon><X /></template>
      </BaseButton>
    </div>

    <div class="market-form-grid">
      <label class="market-field">
        <span>{{ t("markets.editor.catalogTitle") }}</span>
        <input v-model="form.title" required maxlength="255" />
      </label>
      <label class="market-field">
        <span>{{ t("markets.editor.catalogStatus") }}</span>
        <BaseSelect
          :model-value="form.status"
          :options="statusOptions"
          @update:model-value="form.status = $event === 'ACTIVE' ? 'ACTIVE' : 'DRAFT'"
        />
      </label>
    </div>

    <BaseCheckbox
      v-model="form.createPriceList"
      :label="t('markets.editor.createPriceList')"
      :description="t('markets.editor.createPriceListDescription')"
    />
    <div v-if="form.createPriceList" class="market-form-grid">
      <label class="market-field">
        <span>{{ t("markets.editor.priceListName") }}</span>
        <input
          v-model="form.priceListName"
          maxlength="255"
          :placeholder="form.title ? `${form.title} pricing` : ''"
        />
      </label>
      <label class="market-field">
        <span>{{ t("markets.editor.currencyCode") }}</span>
        <input v-model="form.currency" required maxlength="3" placeholder="USD" />
      </label>
      <label class="market-field is-wide">
        <span>{{ t("markets.editor.parentPriceAdjustment") }}</span>
        <input
          v-model.number="form.adjustmentValue"
          type="number"
          min="-100"
          step="0.01"
        />
        <small>{{ t("markets.editor.parentPriceAdjustmentHint") }}</small>
      </label>
    </div>

    <p v-if="error" class="market-form-error" role="alert">{{ error }}</p>
    <div class="market-section-actions">
      <BaseButton @click="emit('cancel')">{{ t("common.cancel") }}</BaseButton>
      <BaseButton type="submit" variant="primary" :loading="marketStore.isManaging">
        <template #icon><Boxes /></template>{{ t("markets.editor.createCatalog") }}
      </BaseButton>
    </div>
  </form>
</template>
