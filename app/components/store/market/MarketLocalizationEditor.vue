<script setup lang="ts">
import { Languages, RefreshCw, Save } from "@lucide/vue";
import { computed, ref, watch } from "vue";
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
const resourceType = ref("METAFIELD");
const values = ref<Record<string, string>>({});
const error = ref("");
const publishedLocales = computed(() =>
  props.context.locales.filter((item) => item.published),
);
const localeOptions = computed(() => [
  { label: t("markets.editor.marketSpecificContent"), value: "" },
  ...publishedLocales.value.map((item) => ({
    label: `${item.name} · ${item.locale}`,
    value: item.locale,
  })),
]);
const resourceTypeOptions = computed(() =>
  (locale.value
    ? [
        "PRODUCT",
        "COLLECTION",
        "PAGE",
        "ARTICLE",
        "BLOG",
        "MENU",
        "METAOBJECT",
        "METAFIELD",
        "SELLING_PLAN_GROUP",
        "SELLING_PLAN",
        "SHOP",
      ]
    : ["METAFIELD", "METAOBJECT"]
  ).map((value) => ({
    label: t(`markets.editor.resourceType${value}` as never),
    value,
  })),
);

watch(locale, (nextLocale) => {
  if (!nextLocale && !["METAFIELD", "METAOBJECT"].includes(resourceType.value)) {
    resourceType.value = "METAFIELD";
  }
});

async function discoverResources() {
  error.value = "";
  const overview = await marketStore.loadLocalizationOverview(
    storeId.value,
    token.value,
    props.market.id,
    resourceType.value,
    locale.value,
  );
  if (!overview) {
    error.value =
      marketStore.managerError || t("markets.editor.localizationLoadFailed");
  }
}

async function selectResource(id: string) {
  resourceId.value = id;
  await load();
}

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
    <form class="market-localization-browser" @submit.prevent="discoverResources">
      <label class="market-field">
        <span>{{ t("markets.editor.resourceType") }}</span>
        <BaseSelect
          :model-value="resourceType"
          :options="resourceTypeOptions"
          :aria-label="t('markets.editor.resourceType')"
          @update:model-value="resourceType = String($event || 'METAFIELD')"
        />
      </label>
      <BaseButton type="submit" :loading="marketStore.isManaging">
        <template #icon><RefreshCw /></template
        >{{ t("markets.editor.discoverResources") }}
      </BaseButton>
    </form>
    <div
      v-if="marketStore.localizationOverview"
      class="market-localization-browser-results"
    >
      <div class="market-resource-summary">
        <span>{{
          t("markets.editor.resourcesFound", {
            count: marketStore.localizationOverview.items.length,
          })
        }}</span>
        <small v-if="marketStore.localizationOverview.truncated">
          {{ t("markets.editor.resourcesTruncated") }}
        </small>
      </div>
      <button
        v-for="item in marketStore.localizationOverview.items"
        :key="item.resourceId"
        type="button"
        :class="{ 'is-selected': item.resourceId === resourceId }"
        @click="selectResource(item.resourceId)"
      >
        <span>
          <strong>{{ item.preview || item.resourceId }}</strong>
          <code>{{ item.resourceId }}</code>
        </span>
        <small>{{
          t("markets.editor.localizationProgress", {
            localized: item.localizedCount,
            total: item.fieldCount,
            outdated: item.outdatedCount,
          })
        }}</small>
      </button>
      <div
        v-if="!marketStore.localizationOverview.items.length"
        class="market-empty-small"
      >
        {{ t("markets.editor.noLocalizableResources") }}
      </div>
    </div>
    <form class="market-localization-loader" @submit.prevent="load">
      <label class="market-field">
        <span>{{ t("markets.editor.resourceGid") }}</span>
        <input v-model="resourceId" required placeholder="gid://shopify/Product/123" />
      </label>
      <label class="market-field">
        <span>{{ t("markets.editor.localeOptional") }}</span>
        <BaseSelect
          :model-value="locale"
          :options="localeOptions"
          :aria-label="t('markets.editor.localeOptional')"
          @update:model-value="locale = String($event || '')"
        />
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
