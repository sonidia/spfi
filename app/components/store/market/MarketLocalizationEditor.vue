<script setup lang="ts">
import { Languages, RefreshCw, Save } from "@lucide/vue";
import { computed, ref } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useMarketStore } from "~/stores/market";
import type {
  ShopifyMarketEditorContext,
  ShopifyMarketSummary,
} from "~~/types/shopify-market";

const props = defineProps<{
  market: ShopifyMarketSummary;
  context: ShopifyMarketEditorContext;
}>();
const marketStore = useMarketStore();
const { storeId, token } = useActiveShopAuth();
const { t } = useLocalization();
const feedback = useStoreFeedback();
const resourceId = ref("");
const locale = ref("");
const values = ref<Record<string, string>>({});
const error = ref("");
const publishedLocales = computed(() =>
  props.context.locales.filter((item) => item.published),
);

async function load() {
  error.value = "";
  values.value = {};
  if (!resourceId.value.startsWith("gid://shopify/")) {
    error.value = t("markets.editor.resourceValidation");
    return;
  }
  const resource = await marketStore.loadLocalization(
    storeId.value,
    token.value,
    props.market.id,
    resourceId.value.trim(),
    locale.value,
  );
  if (!resource) {
    error.value =
      marketStore.managerError || t("markets.editor.localizationLoadFailed");
    return;
  }
  values.value = Object.fromEntries(
    resource.fields.map((field) => [field.key, field.value ?? ""]),
  );
}

async function save() {
  error.value = "";
  const resource = marketStore.localization;
  if (!resource) return;
  const fields = resource.fields
    .filter((field): field is typeof field & { digest: string } =>
      Boolean(field.digest),
    )
    .map((field) => ({
      key: field.key,
      digest: field.digest,
      value: values.value[field.key] ?? "",
    }));
  if (!fields.length) {
    error.value = t("markets.editor.noDigestFields");
    return;
  }
  const succeeded = await marketStore.saveLocalization(
    storeId.value,
    token.value,
    props.market.id,
    resource.resourceId,
    fields,
    locale.value,
  );
  if (!succeeded) {
    error.value = marketStore.managerError || t("markets.editor.saveFailed");
    return;
  }
  feedback.success(t("markets.editor.localizationSaved"));
  await load();
}
</script>

<template>
  <div class="market-editor-section">
    <div class="market-section-heading">
      <div>
        <h3>{{ t("markets.editor.localizationTitle") }}</h3>
        <p>{{ t("markets.editor.localizationDescription") }}</p>
      </div>
    </div>
    <div class="market-callout is-info">
      <strong>{{ t("markets.editor.localizationModesTitle") }}</strong>
      <span>{{ t("markets.editor.localizationModesDescription") }}</span>
    </div>
    <form class="market-localization-loader" @submit.prevent="load">
      <label class="market-field">
        <span>{{ t("markets.editor.resourceGid") }}</span>
        <input v-model="resourceId" required placeholder="gid://shopify/Product/123" />
      </label>
      <label class="market-field">
        <span>{{ t("markets.editor.localeOptional") }}</span>
        <select v-model="locale">
          <option value="">{{ t("markets.editor.marketSpecificContent") }}</option>
          <option
            v-for="item in publishedLocales"
            :key="item.locale"
            :value="item.locale"
          >
            {{ item.name }} · {{ item.locale }}
          </option>
        </select>
      </label>
      <BaseButton type="submit" variant="primary" :loading="marketStore.isManaging"
        ><template #icon><Languages /></template
        >{{ t("markets.editor.loadFields") }}</BaseButton
      >
    </form>

    <p v-if="error" class="market-form-error" role="alert">{{ error }}</p>
    <div v-if="marketStore.localization" class="market-localization-fields">
      <div class="market-resource-summary">
        <span>{{
          marketStore.localization.mode === "TRANSLATION"
            ? t("markets.editor.translationMode")
            : t("markets.editor.marketLocalizationMode")
        }}</span>
        <code>{{ marketStore.localization.resourceId }}</code>
      </div>
      <article
        v-for="field in marketStore.localization.fields"
        :key="field.key"
        :class="{ 'is-outdated': field.outdated }"
      >
        <header>
          <strong>{{ field.key }}</strong>
          <span v-if="field.outdated">{{ t("markets.editor.outdated") }}</span>
          <span v-if="!field.digest">{{ t("markets.editor.readOnly") }}</span>
        </header>
        <div class="market-localization-grid">
          <div>
            <span>{{ t("markets.editor.sourceContent") }}</span>
            <p>{{ field.sourceValue || "—" }}</p>
          </div>
          <label class="market-field"
            ><span>{{ t("markets.editor.marketValue") }}</span
            ><textarea v-model="values[field.key]" rows="3" :disabled="!field.digest" />
          </label>
        </div>
      </article>
      <div class="market-section-actions">
        <BaseButton :disabled="marketStore.isManaging" @click="load"
          ><template #icon><RefreshCw /></template>{{ t("common.refresh") }}</BaseButton
        >
        <BaseButton variant="primary" :loading="marketStore.isManaging" @click="save"
          ><template #icon><Save /></template
          >{{ t("markets.editor.saveLocalization") }}</BaseButton
        >
      </div>
    </div>
  </div>
</template>
