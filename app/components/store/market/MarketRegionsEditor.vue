<script setup lang="ts">
import { Plus, Save, Trash2 } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useMarketStore } from "~/stores/market";
import MarketConditionResourcePicker from "./MarketConditionResourcePicker.vue";
import type {
  ShopifyMarketConditionApplicationLevel,
  ShopifyMarketConditionResourceSummary,
  ShopifyMarketConditionsInput,
  ShopifyMarketEditorContext,
  ShopifyMarketRegionInput,
  ShopifyMarketSummary,
} from "~~/types/shopify-market";

type ConditionMode = "NONE" | ShopifyMarketConditionApplicationLevel;

const props = defineProps<{
  market: ShopifyMarketSummary;
  context: ShopifyMarketEditorContext;
}>();
const marketStore = useMarketStore();
const { storeId, token } = useActiveShopAuth();
const { requestConfirmation } = useConfirmDialog();
const { t } = useLocalization();
const feedback = useStoreFeedback();
const rows = ref<ShopifyMarketRegionInput[]>([]);
const companyMode = ref<ConditionMode>("NONE");
const companyIds = ref<string[]>([]);
const locationMode = ref<ConditionMode>("NONE");
const locationIds = ref<string[]>([]);
const channelMode = ref<ConditionMode>("NONE");
const channelIds = ref<string[]>([]);
const duplicateDraft = ref(true);
const error = ref("");

const isTruncated = computed(
  () =>
    props.market.regionsTruncated ||
    props.market.conditions.companyLocations?.truncated ||
    props.market.conditions.locations?.truncated ||
    props.market.conditions.channels?.truncated,
);

const currentConditions = computed<ShopifyMarketConditionsInput>(() => {
  const conditions: ShopifyMarketConditionsInput = {};
  if (props.market.conditions.regions) {
    conditions.regions = props.market.regions.map((region) => ({
      countryCode: region.countryCode || region.code,
      subdivision: region.kind === "subdivision" ? region.code : undefined,
    }));
  }
  const companyLocations = props.market.conditions.companyLocations;
  if (companyLocations) {
    conditions.companyLocations = {
      applicationLevel: companyLocations.applicationLevel || "SPECIFIED",
      ids: companyLocations.items.map((item) => item.id),
    };
  }
  const locations = props.market.conditions.locations;
  if (locations) {
    conditions.locations = {
      applicationLevel: locations.applicationLevel || "SPECIFIED",
      ids: locations.items.map((item) => item.id),
    };
  }
  const channels = props.market.conditions.channels;
  if (channels) {
    conditions.channels = { ids: channels.items.map((item) => item.id) };
  }
  return conditions;
});

const companyOptions = computed(() =>
  mergeOptions(
    props.context.conditionOptions.companyLocations,
    props.market.conditions.companyLocations?.items || [],
  ),
);
const locationOptions = computed(() =>
  mergeOptions(
    props.context.conditionOptions.locations,
    props.market.conditions.locations?.items || [],
  ),
);
const channelOptions = computed(() =>
  mergeOptions(
    props.context.conditionOptions.channels,
    props.market.conditions.channels?.items || [],
  ),
);

watch(
  () => props.market,
  () => {
    rows.value = (currentConditions.value.regions || []).map((region) => ({
      ...region,
    }));
    companyMode.value = currentConditions.value.companyLocations
      ? currentConditions.value.companyLocations.applicationLevel
      : "NONE";
    companyIds.value = [...(currentConditions.value.companyLocations?.ids || [])];
    locationMode.value = currentConditions.value.locations
      ? currentConditions.value.locations.applicationLevel
      : "NONE";
    locationIds.value = [...(currentConditions.value.locations?.ids || [])];
    channelMode.value = currentConditions.value.channels ? "SPECIFIED" : "NONE";
    channelIds.value = [...(currentConditions.value.channels?.ids || [])];
    error.value = "";
  },
  { immediate: true },
);

function mergeOptions(
  available: ShopifyMarketConditionResourceSummary[],
  selected: ShopifyMarketConditionResourceSummary[],
) {
  return Array.from(
    new Map([...selected, ...available].map((item) => [item.id, item])).values(),
  );
}

function addRegion() {
  rows.value.push({ countryCode: "", subdivision: "" });
}

function removeRegion(index: number) {
  rows.value.splice(index, 1);
}

function buildNextConditions(): ShopifyMarketConditionsInput | null {
  const conditions: ShopifyMarketConditionsInput = {};
  if (rows.value.length) {
    const regions = rows.value.map((row) => ({
      countryCode: row.countryCode.trim().toUpperCase(),
      subdivision: row.subdivision?.trim().toUpperCase() || undefined,
    }));
    if (regions.some((row) => !/^[A-Z]{2}$/.test(row.countryCode))) {
      error.value = t("markets.editor.regionsValidationOptional");
      return null;
    }
    conditions.regions = regions;
  }
  if (companyMode.value !== "NONE") {
    if (companyMode.value === "SPECIFIED" && !companyIds.value.length) {
      error.value = t("markets.editor.conditionSelectionRequired");
      return null;
    }
    conditions.companyLocations = {
      applicationLevel: companyMode.value,
      ids: companyMode.value === "SPECIFIED" ? companyIds.value : [],
    };
  }
  if (locationMode.value !== "NONE") {
    if (locationMode.value === "SPECIFIED" && !locationIds.value.length) {
      error.value = t("markets.editor.conditionSelectionRequired");
      return null;
    }
    conditions.locations = {
      applicationLevel: locationMode.value,
      ids: locationMode.value === "SPECIFIED" ? locationIds.value : [],
    };
  }
  if (channelMode.value !== "NONE") {
    if (!channelIds.value.length) {
      error.value = t("markets.editor.conditionSelectionRequired");
      return null;
    }
    conditions.channels = { ids: channelIds.value };
  }
  return conditions;
}

async function save() {
  error.value = "";
  const next = buildNextConditions();
  if (!next) return;
  const confirmed = await requestConfirmation({
    title: t("markets.editor.conditionsConfirmTitle"),
    message: t("markets.editor.conditionsConfirmMessage", {
      name: props.market.name,
    }),
    confirmLabel: t("markets.editor.applyConditions"),
  });
  if (!confirmed) return;
  const market = await marketStore.updateMarket(
    storeId.value,
    token.value,
    "/api/market/conditions",
    props.market.id,
    {
      current: currentConditions.value,
      next,
      makeDuplicateUniqueMarketsDraft: duplicateDraft.value,
    },
  );
  if (!market) {
    error.value = marketStore.managerError || t("markets.editor.saveFailed");
    return;
  }
  feedback.success(t("markets.editor.conditionsSaved"));
}
</script>

<template>
  <form class="market-editor-section" @submit.prevent="save">
    <div class="market-section-heading">
      <div>
        <h3>{{ t("markets.editor.conditionsTitle") }}</h3>
        <p>{{ t("markets.editor.conditionsDescription") }}</p>
      </div>
      <span class="market-count-pill">{{ market.conditionTypes.length }}</span>
    </div>
    <div v-if="isTruncated" class="market-callout is-warning">
      <strong>{{ t("markets.editor.conditionsTruncatedTitle") }}</strong>
      <span>{{ t("markets.editor.conditionsTruncatedDescription") }}</span>
    </div>
    <template v-else>
      <div class="market-callout is-info">
        <strong>{{ t("markets.editor.conditionRulesTitle") }}</strong>
        <span>{{ t("markets.editor.conditionRulesDescription") }}</span>
      </div>

      <fieldset class="market-fieldset">
        <div class="market-legend-row">
          <div>
            <legend>{{ t("markets.editor.buyerRegions") }}</legend>
            <p>{{ t("markets.editor.regionFormatHintOptional") }}</p>
          </div>
          <BaseButton @click="addRegion">
            <template #icon><Plus /></template>{{ t("markets.editor.addRegion") }}
          </BaseButton>
        </div>
        <div v-if="!rows.length" class="market-empty-small">
          {{ t("markets.editor.noRegionCondition") }}
        </div>
        <div v-else class="market-region-list">
          <div v-for="(row, index) in rows" :key="index" class="market-region-row">
            <label class="market-field">
              <span>{{ t("markets.editor.countryCode") }}</span>
              <input
                v-model="row.countryCode"
                required
                maxlength="2"
                placeholder="US"
              />
            </label>
            <label class="market-field">
              <span>{{ t("markets.editor.subdivisionOptional") }}</span>
              <input v-model="row.subdivision" maxlength="32" placeholder="CA" />
            </label>
            <BaseButton
              variant="danger-ghost"
              icon-only
              :aria-label="t('markets.editor.removeRegion')"
              @click="removeRegion(index)"
            >
              <template #icon><Trash2 /></template>
            </BaseButton>
          </div>
        </div>
      </fieldset>

      <MarketConditionResourcePicker
        :title="t('markets.editor.companyLocationsCondition')"
        :description="t('markets.editor.companyLocationsConditionHint')"
        :options="companyOptions"
        :mode="companyMode"
        :selected="companyIds"
        allow-all
        @update:mode="companyMode = $event"
        @update:selected="companyIds = $event"
      />
      <MarketConditionResourcePicker
        :title="t('markets.editor.locationsCondition')"
        :description="t('markets.editor.locationsConditionHint')"
        :options="locationOptions"
        :mode="locationMode"
        :selected="locationIds"
        allow-all
        @update:mode="locationMode = $event"
        @update:selected="locationIds = $event"
      />
      <MarketConditionResourcePicker
        :title="t('markets.editor.channelsCondition')"
        :description="t('markets.editor.channelsConditionHint')"
        :options="channelOptions"
        :mode="channelMode"
        :selected="channelIds"
        @update:mode="channelMode = $event"
        @update:selected="channelIds = $event"
      />

      <BaseCheckbox
        v-model="duplicateDraft"
        :label="t('markets.editor.duplicateDraftLabel')"
        :description="t('markets.editor.duplicateDraftDescription')"
      />
      <p v-if="error" class="market-form-error" role="alert">{{ error }}</p>
      <div class="market-section-actions">
        <BaseButton type="submit" variant="primary" :loading="marketStore.isManaging">
          <template #icon><Save /></template>{{ t("markets.editor.applyConditions") }}
        </BaseButton>
      </div>
    </template>
  </form>
</template>
