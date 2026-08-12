<script setup lang="ts">
import { BadgePlus, Plus, Trash2, X } from "@lucide/vue";
import { computed, reactive, ref, useId } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useMarketStore } from "~/stores/market";
import type { ShopifyMarketRegionInput } from "~~/types/shopify-market";

const emit = defineEmits<{ close: []; created: [id: string] }>();
const marketStore = useMarketStore();
const { storeId, token } = useActiveShopAuth();
const { t } = useLocalization();
const feedback = useStoreFeedback();
const modalRef = ref<HTMLFormElement | null>(null);
const titleId = `market-create-title-${useId()}`;
const localError = ref("");
const form = reactive({
  name: "",
  handle: "",
  status: "DRAFT" as "ACTIVE" | "DRAFT",
  baseCurrency: "",
  localCurrencies: false,
  roundingEnabled: false,
  makeDuplicateUniqueMarketsDraft: true,
  regions: [{ countryCode: "", subdivision: "" }] as ShopifyMarketRegionInput[],
});
const { handleKeydown } = useFocusTrap(modalRef, {
  initialFocus: () => modalRef.value?.querySelector("input") || null,
  onEscape: () => !marketStore.isManaging && emit("close"),
});

const canSubmit = computed(
  () =>
    Boolean(form.name.trim()) &&
    form.regions.some((region) => /^[A-Za-z]{2}$/.test(region.countryCode.trim())),
);

function addRegion() {
  form.regions.push({ countryCode: "", subdivision: "" });
}

function removeRegion(index: number) {
  if (form.regions.length > 1) form.regions.splice(index, 1);
}

function generateHandle() {
  if (form.handle.trim()) return;
  form.handle = form.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 255);
}

async function submit() {
  localError.value = "";
  if (!canSubmit.value) {
    localError.value = t("markets.editor.createValidation");
    return;
  }
  const market = await marketStore.createMarket(storeId.value, token.value, {
    name: form.name.trim(),
    handle: form.handle.trim(),
    status: form.status,
    baseCurrency: form.baseCurrency.trim().toUpperCase() || undefined,
    localCurrencies: form.localCurrencies,
    roundingEnabled: form.roundingEnabled,
    makeDuplicateUniqueMarketsDraft: form.makeDuplicateUniqueMarketsDraft,
    regions: form.regions.map((region) => ({
      countryCode: region.countryCode.trim().toUpperCase(),
      subdivision: region.subdivision?.trim().toUpperCase() || undefined,
    })),
  });
  if (!market) {
    localError.value = marketStore.managerError || t("markets.editor.createFailed");
    return;
  }
  feedback.success(t("markets.editor.created"));
  emit("created", market.id);
}
</script>

<template>
  <Teleport to="body">
    <div
      class="market-modal-backdrop"
      @click.self="!marketStore.isManaging && emit('close')"
    >
      <form
        ref="modalRef"
        class="market-modal market-create-modal"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        tabindex="-1"
        @keydown="handleKeydown"
        @submit.prevent="submit"
      >
        <header class="market-modal-header">
          <div>
            <p>{{ t("markets.editor.workspace") }}</p>
            <h2 :id="titleId">{{ t("markets.editor.createTitle") }}</h2>
          </div>
          <BaseButton
            variant="ghost"
            icon-only
            :aria-label="t('common.close')"
            :disabled="marketStore.isManaging"
            @click="emit('close')"
          >
            <template #icon><X /></template>
          </BaseButton>
        </header>

        <div class="market-modal-scroll">
          <div class="market-callout is-info">
            <strong>{{ t("markets.editor.safeCreateTitle") }}</strong>
            <span>{{ t("markets.editor.safeCreateDescription") }}</span>
          </div>

          <div class="market-form-grid">
            <label class="market-field">
              <span>{{ t("markets.editor.name") }}</span>
              <input
                v-model="form.name"
                required
                maxlength="255"
                :placeholder="t('markets.editor.namePlaceholder')"
                @blur="generateHandle"
              />
            </label>
            <label class="market-field">
              <span>{{ t("markets.editor.handle") }}</span>
              <input
                v-model="form.handle"
                maxlength="255"
                pattern="[A-Za-z0-9-]+"
                :placeholder="t('markets.editor.handlePlaceholder')"
              />
            </label>
            <label class="market-field">
              <span>{{ t("markets.editor.initialStatus") }}</span>
              <select v-model="form.status">
                <option value="DRAFT">{{ t("markets.draft") }}</option>
                <option value="ACTIVE">{{ t("markets.active") }}</option>
              </select>
            </label>
            <label class="market-field">
              <span>{{ t("markets.editor.baseCurrencyOptional") }}</span>
              <input
                v-model="form.baseCurrency"
                maxlength="3"
                :placeholder="t('markets.editor.currencyPlaceholder')"
              />
            </label>
          </div>

          <fieldset class="market-fieldset">
            <legend>{{ t("markets.editor.buyerRegions") }}</legend>
            <p>{{ t("markets.editor.regionFormatHint") }}</p>
            <div
              v-for="(region, index) in form.regions"
              :key="index"
              class="market-region-row"
            >
              <label class="market-field">
                <span>{{ t("markets.editor.countryCode") }}</span>
                <input
                  v-model="region.countryCode"
                  required
                  maxlength="2"
                  placeholder="US"
                />
              </label>
              <label class="market-field">
                <span>{{ t("markets.editor.subdivisionOptional") }}</span>
                <input v-model="region.subdivision" maxlength="32" placeholder="CA" />
              </label>
              <BaseButton
                variant="danger-ghost"
                icon-only
                :aria-label="t('markets.editor.removeRegion')"
                :disabled="form.regions.length === 1"
                @click="removeRegion(index)"
              >
                <template #icon><Trash2 /></template>
              </BaseButton>
            </div>
            <BaseButton @click="addRegion">
              <template #icon><Plus /></template>
              {{ t("markets.editor.addRegion") }}
            </BaseButton>
          </fieldset>

          <div class="market-choice-grid">
            <BaseCheckbox
              v-model="form.makeDuplicateUniqueMarketsDraft"
              :label="t('markets.editor.duplicateDraftLabel')"
              :description="t('markets.editor.duplicateDraftDescription')"
            />
            <BaseCheckbox
              v-model="form.localCurrencies"
              :label="t('markets.editor.localCurrenciesLabel')"
              :description="t('markets.editor.localCurrenciesDescription')"
              :disabled="!form.baseCurrency.trim()"
            />
            <BaseCheckbox
              v-model="form.roundingEnabled"
              :label="t('markets.editor.roundingLabel')"
              :description="t('markets.editor.roundingDescription')"
              :disabled="!form.baseCurrency.trim()"
            />
          </div>

          <p v-if="localError" class="market-form-error" role="alert">
            {{ localError }}
          </p>
        </div>

        <footer class="market-modal-footer">
          <BaseButton :disabled="marketStore.isManaging" @click="emit('close')">
            {{ t("common.cancel") }}
          </BaseButton>
          <BaseButton
            type="submit"
            variant="primary"
            size="medium"
            :loading="marketStore.isManaging"
            :disabled="!canSubmit"
          >
            <template #icon><BadgePlus /></template>
            {{ t("markets.editor.create") }}
          </BaseButton>
        </footer>
      </form>
    </div>
  </Teleport>
</template>

<style src="../../assets/styles/components/market-editor.css"></style>
