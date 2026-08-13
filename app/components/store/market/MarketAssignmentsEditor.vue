<script setup lang="ts">
import { Edit3, Plus, Save, Trash2 } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useMarketStore } from "~/stores/market";
import MarketWebPresenceForm from "./MarketWebPresenceForm.vue";
import type {
  ShopifyMarketEditorContext,
  ShopifyMarketSummary,
  ShopifyMarketWebPresenceSummary,
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
const selectedCatalogs = ref<string[]>([]);
const selectedDiscounts = ref<string[]>([]);
const selectedPresences = ref<string[]>([]);
const presenceEditor = ref<ShopifyMarketWebPresenceSummary | null | undefined>(
  undefined,
);
const error = ref("");
const originalCatalogs = computed(() => props.market.catalogs.map((item) => item.id));
const originalDiscounts = computed(() => props.market.discounts.map((item) => item.id));
const originalPresences = computed(() =>
  props.market.webPresences.map((item) => item.id),
);
const hasSubdivision = computed(() =>
  props.market.regions.some((region) => region.kind === "subdivision"),
);

watch(
  () => props.market,
  () => {
    selectedCatalogs.value = [...originalCatalogs.value];
    selectedDiscounts.value = [...originalDiscounts.value];
    selectedPresences.value = [...originalPresences.value];
    error.value = "";
  },
  { immediate: true },
);

function toggle(list: string[], id: string) {
  const index = list.indexOf(id);
  if (index >= 0) list.splice(index, 1);
  else list.push(id);
}

function editPresence(presence: ShopifyMarketWebPresenceSummary) {
  presenceEditor.value = presence;
}

function handlePresenceSaved(presence: ShopifyMarketWebPresenceSummary) {
  presenceEditor.value = undefined;
  if (!selectedPresences.value.includes(presence.id))
    selectedPresences.value.push(presence.id);
}

async function removePresence(presence: ShopifyMarketWebPresenceSummary) {
  const confirmed = await requestConfirmation({
    title: t("markets.editor.deleteWebPresenceTitle"),
    message: t("markets.editor.deleteWebPresenceMessage", {
      name: presence.domain?.host || `/${presence.subfolderSuffix || ""}`,
    }),
    confirmLabel: t("common.delete"),
    danger: true,
  });
  if (!confirmed) return;
  const deleted = await marketStore.deleteWebPresence(
    storeId.value,
    token.value,
    presence.id,
  );
  if (!deleted) {
    error.value =
      marketStore.managerError || t("markets.editor.deleteWebPresenceFailed");
    return;
  }
  selectedPresences.value = selectedPresences.value.filter((id) => id !== presence.id);
  if (presenceEditor.value?.id === presence.id) presenceEditor.value = undefined;
  feedback.success(t("markets.editor.webPresenceDeleted"));
}

async function save() {
  error.value = "";
  const payload = {
    catalogsToAdd: selectedCatalogs.value.filter(
      (id) => !originalCatalogs.value.includes(id),
    ),
    catalogsToDelete: originalCatalogs.value.filter(
      (id) => !selectedCatalogs.value.includes(id),
    ),
    discountsToAdd: selectedDiscounts.value.filter(
      (id) => !originalDiscounts.value.includes(id),
    ),
    discountsToDelete: originalDiscounts.value.filter(
      (id) => !selectedDiscounts.value.includes(id),
    ),
    webPresencesToAdd: selectedPresences.value.filter(
      (id) => !originalPresences.value.includes(id),
    ),
    webPresencesToDelete: originalPresences.value.filter(
      (id) => !selectedPresences.value.includes(id),
    ),
  };
  if (!Object.values(payload).some((items) => items.length)) {
    feedback.warning(t("markets.editor.noAssignmentChanges"));
    return;
  }
  const confirmed = await requestConfirmation({
    title: t("markets.editor.assignmentsConfirmTitle"),
    message: t("markets.editor.assignmentsConfirmMessage", { name: props.market.name }),
    confirmLabel: t("markets.editor.applyAssignments"),
  });
  if (!confirmed) return;
  const market = await marketStore.updateMarket(
    storeId.value,
    token.value,
    "/api/market/assignments",
    props.market.id,
    { input: payload },
  );
  if (!market) {
    error.value = marketStore.managerError || t("markets.editor.saveFailed");
    return;
  }
  feedback.success(t("markets.editor.assignmentsSaved"));
}
</script>

<template>
  <form class="market-editor-section" @submit.prevent="save">
    <div class="market-section-heading">
      <div>
        <h3>{{ t("markets.editor.assignmentsTitle") }}</h3>
        <p>{{ t("markets.editor.assignmentsDescription") }}</p>
      </div>
    </div>

    <fieldset class="market-fieldset">
      <legend>{{ t("markets.catalogs") }}</legend>
      <p>{{ t("markets.editor.catalogHint") }}</p>
      <div v-if="hasSubdivision" class="market-callout is-warning">
        <strong>{{ t("markets.editor.subdivisionCatalogTitle") }}</strong>
        <span>{{ t("markets.editor.subdivisionCatalogDescription") }}</span>
      </div>
      <div v-if="!context.catalogs.length" class="market-empty-small">
        {{ t("markets.editor.noAvailableCatalogs") }}
      </div>
      <div v-else class="market-selection-list">
        <BaseCheckbox
          v-for="catalog in context.catalogs"
          :key="catalog.id"
          :model-value="selectedCatalogs.includes(catalog.id)"
          :label="catalog.title"
          :description="
            catalog.priceList
              ? `${catalog.priceList.name} · ${catalog.priceList.currency}`
              : t('markets.editor.salesChannelAvailability')
          "
          :disabled="hasSubdivision"
          @change="toggle(selectedCatalogs, catalog.id)"
        />
      </div>
      <div class="market-callout is-info">
        <strong>{{ t("markets.editor.catalogPublishingTitle") }}</strong>
        <span>{{ t("markets.editor.catalogPublishingDescription") }}</span>
      </div>
    </fieldset>

    <fieldset class="market-fieldset">
      <legend>{{ t("markets.discounts") }}</legend>
      <p>{{ t("markets.editor.discountAssignmentHint") }}</p>
      <div v-if="!context.discounts.length" class="market-empty-small">
        {{ t("markets.editor.noAvailableDiscounts") }}
      </div>
      <div v-else class="market-selection-list">
        <BaseCheckbox
          v-for="discount in context.discounts"
          :key="discount.id"
          :model-value="selectedDiscounts.includes(discount.id)"
          :label="discount.title"
          :description="`${discount.code || discount.type} · ${discount.status}`"
          @change="toggle(selectedDiscounts, discount.id)"
        />
      </div>
    </fieldset>

    <fieldset class="market-fieldset">
      <div class="market-legend-row">
        <div>
          <legend>{{ t("markets.webPresence") }}</legend>
          <p>{{ t("markets.editor.webPresenceAssignmentHint") }}</p>
        </div>
        <BaseButton @click="presenceEditor = null"
          ><template #icon><Plus /></template
          >{{ t("markets.editor.createWebPresence") }}</BaseButton
        >
      </div>
      <MarketWebPresenceForm
        v-if="presenceEditor !== undefined"
        :context="context"
        :presence="presenceEditor"
        @cancel="presenceEditor = undefined"
        @saved="handlePresenceSaved"
      />
      <div v-if="!context.webPresences.length" class="market-empty-small">
        {{ t("markets.editor.noAvailableWebPresences") }}
      </div>
      <div v-else class="market-assignment-cards">
        <article v-for="presence in context.webPresences" :key="presence.id">
          <BaseCheckbox
            :model-value="selectedPresences.includes(presence.id)"
            :label="presence.domain?.host || `/${presence.subfolderSuffix}`"
            :description="`${presence.defaultLocale} · ${presence.rootUrls.length} URL(s)`"
            @change="toggle(selectedPresences, presence.id)"
          />
          <BaseButton
            variant="ghost"
            icon-only
            :aria-label="t('markets.editor.editWebPresence')"
            @click="editPresence(presence)"
            ><template #icon><Edit3 /></template
          ></BaseButton>
          <BaseButton
            variant="danger-ghost"
            icon-only
            :aria-label="t('markets.editor.deleteWebPresence')"
            @click="removePresence(presence)"
            ><template #icon><Trash2 /></template
          ></BaseButton>
        </article>
      </div>
      <div class="market-callout is-warning">
        <strong>{{ t("markets.editor.sharedWebPresenceTitle") }}</strong>
        <span>{{ t("markets.editor.sharedWebPresenceDescription") }}</span>
      </div>
    </fieldset>

    <p v-if="error" class="market-form-error" role="alert">{{ error }}</p>
    <div class="market-section-actions">
      <BaseButton type="submit" variant="primary" :loading="marketStore.isManaging"
        ><template #icon><Save /></template
        >{{ t("markets.editor.applyAssignments") }}</BaseButton
      >
    </div>
  </form>
</template>
