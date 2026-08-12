<script setup lang="ts">
import { Plus, Save, Trash2 } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useMarketStore } from "~/stores/market";
import type {
  ShopifyMarketRegionInput,
  ShopifyMarketSummary,
} from "~~/types/shopify-market";

const props = defineProps<{ market: ShopifyMarketSummary }>();
const marketStore = useMarketStore();
const { storeId, token } = useActiveShopAuth();
const { requestConfirmation } = useConfirmDialog();
const { t } = useLocalization();
const feedback = useStoreFeedback();
const rows = ref<ShopifyMarketRegionInput[]>([]);
const duplicateDraft = ref(true);
const error = ref("");
const editable = computed(
  () => props.market.type === "REGION" && !props.market.regionsTruncated,
);
const currentRegions = computed(() =>
  props.market.regions.map((region) => ({
    countryCode: region.countryCode || region.code,
    subdivision: region.kind === "subdivision" ? region.code : undefined,
  })),
);

watch(
  () => props.market,
  () => {
    rows.value = currentRegions.value.map((region) => ({ ...region }));
    error.value = "";
  },
  { immediate: true },
);

function add() {
  rows.value.push({ countryCode: "", subdivision: "" });
}

function remove(index: number) {
  if (rows.value.length > 1) rows.value.splice(index, 1);
}

async function save() {
  error.value = "";
  const normalized = rows.value.map((row) => ({
    countryCode: row.countryCode.trim().toUpperCase(),
    subdivision: row.subdivision?.trim().toUpperCase() || undefined,
  }));
  if (
    !normalized.length ||
    normalized.some((row) => !/^[A-Z]{2}$/.test(row.countryCode))
  ) {
    error.value = t("markets.editor.regionsValidation");
    return;
  }
  const confirmed = await requestConfirmation({
    title: t("markets.editor.regionsConfirmTitle"),
    message: t("markets.editor.regionsConfirmMessage", { name: props.market.name }),
    confirmLabel: t("markets.editor.applyRegions"),
  });
  if (!confirmed) return;
  const market = await marketStore.updateMarket(
    storeId.value,
    token.value,
    "/api/market/regions",
    props.market.id,
    {
      current: currentRegions.value,
      next: normalized,
      makeDuplicateUniqueMarketsDraft: duplicateDraft.value,
    },
  );
  if (!market) {
    error.value = marketStore.managerError || t("markets.editor.saveFailed");
    return;
  }
  feedback.success(t("markets.editor.regionsSaved"));
}
</script>

<template>
  <form class="market-editor-section" @submit.prevent="save">
    <div class="market-section-heading">
      <div>
        <h3>{{ t("markets.editor.regionsTitle") }}</h3>
        <p>{{ t("markets.editor.regionsDescription") }}</p>
      </div>
      <span class="market-count-pill">{{ rows.length }}</span>
    </div>
    <div v-if="props.market.regionsTruncated" class="market-callout is-warning">
      <strong>{{ t("markets.editor.regionsTruncatedTitle") }}</strong>
      <span>{{ t("markets.editor.regionsTruncatedDescription") }}</span>
    </div>
    <div v-else-if="!editable" class="market-callout is-warning">
      <strong>{{ t("markets.editor.regionsUnavailableTitle") }}</strong>
      <span>{{ t("markets.editor.regionsUnavailableDescription") }}</span>
    </div>
    <template v-else>
      <div class="market-callout is-info">
        <strong>{{ t("markets.editor.regionRulesTitle") }}</strong>
        <span>{{ t("markets.editor.regionRulesDescription") }}</span>
      </div>
      <div class="market-region-list">
        <div v-for="(row, index) in rows" :key="index" class="market-region-row">
          <label class="market-field">
            <span>{{ t("markets.editor.countryCode") }}</span>
            <input v-model="row.countryCode" required maxlength="2" placeholder="US" />
          </label>
          <label class="market-field">
            <span>{{ t("markets.editor.subdivisionOptional") }}</span>
            <input v-model="row.subdivision" maxlength="32" placeholder="CA" />
          </label>
          <BaseButton
            variant="danger-ghost"
            icon-only
            :disabled="rows.length === 1"
            :aria-label="t('markets.editor.removeRegion')"
            @click="remove(index)"
          >
            <template #icon><Trash2 /></template>
          </BaseButton>
        </div>
      </div>
      <BaseButton @click="add"
        ><template #icon><Plus /></template
        >{{ t("markets.editor.addRegion") }}</BaseButton
      >
      <BaseCheckbox
        v-model="duplicateDraft"
        :label="t('markets.editor.duplicateDraftLabel')"
        :description="t('markets.editor.duplicateDraftDescription')"
      />
      <p v-if="error" class="market-form-error" role="alert">{{ error }}</p>
      <div class="market-section-actions">
        <BaseButton type="submit" variant="primary" :loading="marketStore.isManaging">
          <template #icon><Save /></template>{{ t("markets.editor.applyRegions") }}
        </BaseButton>
      </div>
    </template>
  </form>
</template>
