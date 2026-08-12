<script setup lang="ts">
import { Save } from "@lucide/vue";
import { reactive, ref, watch } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useMarketStore } from "~/stores/market";
import type { ShopifyMarketSummary } from "~~/types/shopify-market";

const props = defineProps<{ market: ShopifyMarketSummary }>();
const marketStore = useMarketStore();
const { storeId, token } = useActiveShopAuth();
const { t } = useLocalization();
const feedback = useStoreFeedback();
const error = ref("");
const form = reactive({ name: "", handle: "" });

watch(
  () => props.market,
  (market) => Object.assign(form, { name: market.name, handle: market.handle }),
  { immediate: true },
);

async function save() {
  error.value = "";
  if (!form.name.trim() || !/^[A-Za-z0-9-]+$/.test(form.handle.trim())) {
    error.value = t("markets.editor.detailsValidation");
    return;
  }
  const market = await marketStore.updateMarket(
    storeId.value,
    token.value,
    "/api/market/identity",
    props.market.id,
    { input: { name: form.name.trim(), handle: form.handle.trim() } },
  );
  if (!market) {
    error.value = marketStore.managerError || t("markets.editor.saveFailed");
    return;
  }
  feedback.success(t("markets.editor.detailsSaved"));
}
</script>

<template>
  <form class="market-editor-section" @submit.prevent="save">
    <div class="market-section-heading">
      <div>
        <h3>{{ t("markets.editor.detailsTitle") }}</h3>
        <p>{{ t("markets.editor.detailsDescription") }}</p>
      </div>
    </div>
    <div class="market-form-grid">
      <label class="market-field">
        <span>{{ t("markets.editor.name") }}</span>
        <input v-model="form.name" required maxlength="255" />
      </label>
      <label class="market-field">
        <span>{{ t("markets.editor.handle") }}</span>
        <input v-model="form.handle" required maxlength="255" pattern="[A-Za-z0-9-]+" />
        <small>{{ t("markets.editor.handleHint") }}</small>
      </label>
    </div>
    <div class="market-readonly-grid">
      <div>
        <span>{{ t("markets.editor.marketType") }}</span
        ><strong>{{ market.type }}</strong>
      </div>
      <div>
        <span>{{ t("markets.editor.marketId") }}</span
        ><code>{{ market.id }}</code>
      </div>
    </div>
    <p v-if="error" class="market-form-error" role="alert">{{ error }}</p>
    <div class="market-section-actions">
      <BaseButton type="submit" variant="primary" :loading="marketStore.isManaging">
        <template #icon><Save /></template>
        {{ t("common.save") }}
      </BaseButton>
    </div>
  </form>
</template>
