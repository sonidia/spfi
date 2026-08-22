<script setup lang="ts">
import { Languages, RefreshCw, Save } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { useCollectionStore } from "~/stores/collection";
import type { ShopifyCollectionDetail } from "~~/types/shopify-collection";

const props = defineProps<{
  detail: ShopifyCollectionDetail;
  storeId: string;
  token: string;
  disabled?: boolean;
}>();
const collectionStore = useCollectionStore();
const feedback = useStoreFeedback();
const { t } = useLocalization();
const locale = ref("");
const values = ref<Record<string, string>>({});
const localeOptions = computed(() =>
  (collectionStore.managementContext?.locales || [])
    .filter((item) => !item.primary)
    .map((item) => ({
      value: item.locale,
      label: `${item.name} · ${item.locale}`,
      description: item.published
        ? t("collection.localePublished")
        : t("collection.localeUnpublished"),
    })),
);
const resource = computed(
  () => collectionStore.translations[props.detail.id]?.[locale.value] || null,
);

watch(
  localeOptions,
  (options) => {
    if (!locale.value && options[0]) locale.value = String(options[0].value);
  },
  { immediate: true },
);

watch(locale, () => void load(), { immediate: true });
watch(
  resource,
  (translationResource) => {
    values.value = Object.fromEntries(
      (translationResource?.fields || []).map((field) => [
        field.key,
        field.value || "",
      ]),
    );
  },
  { immediate: true },
);

async function load(force = false) {
  if (!locale.value) return;
  await collectionStore.fetchTranslations(
    props.storeId,
    props.token,
    props.detail.id,
    locale.value,
    force,
  );
}

async function save() {
  if (!resource.value) return;
  const saved = await collectionStore.saveTranslations(
    props.storeId,
    props.token,
    props.detail.id,
    locale.value,
    resource.value.fields.map((field) => ({
      key: field.key,
      digest: field.digest,
      value: values.value[field.key] || "",
    })),
  );
  if (!saved) {
    feedback.error(collectionStore.mutationError, t("collection.translationsFailed"));
    return;
  }
  feedback.success(t("collection.translationsUpdated"));
}
</script>

<template>
  <section class="collection-localization-panel">
    <header>
      <span class="localization-icon"><Languages aria-hidden="true" /></span>
      <span>
        <h3>{{ t("collection.localization") }}</h3>
        <p>{{ t("collection.localizationHint") }}</p>
      </span>
    </header>

    <p
      v-if="collectionStore.managementContext?.warnings.includes('locales_unavailable')"
      class="localization-warning"
      role="alert"
    >
      {{ t("collection.localesUnavailable") }}
    </p>

    <div v-if="localeOptions.length" class="localization-toolbar">
      <BaseSelect
        :model-value="locale"
        :options="localeOptions"
        :aria-label="t('collection.locale')"
        @update:model-value="locale = String($event || '')"
      />
      <BaseButton
        :loading="collectionStore.isLoadingTranslations"
        :disabled="disabled || !locale"
        @click="load(true)"
      >
        <template #icon><RefreshCw aria-hidden="true" /></template>
        {{ t("common.refresh") }}
      </BaseButton>
    </div>
    <p v-if="localeOptions.length" class="localization-empty-hint">
      {{ t("collection.emptyTranslationRemoves") }}
    </p>

    <p v-if="collectionStore.translationError" class="localization-error" role="alert">
      {{ collectionStore.translationError }}
    </p>

    <div v-if="resource" class="translation-fields">
      <article
        v-for="field in resource.fields"
        :key="field.key"
        :class="{ outdated: field.outdated }"
      >
        <header>
          <strong>{{ field.key }}</strong>
          <span v-if="field.outdated">{{ t("collection.translationOutdated") }}</span>
        </header>
        <div>
          <span>{{ t("collection.sourceContent") }}</span>
          <p>{{ field.sourceValue || "—" }}</p>
        </div>
        <label class="translation-value">
          <span>{{ t("collection.translatedContent") }}</span>
          <BaseTextField
            v-model="values[field.key]"
            multiline
            :rows="3"
            :disabled="disabled"
          />
        </label>
      </article>
      <footer>
        <BaseButton
          variant="primary"
          :loading="collectionStore.isMutating"
          :disabled="disabled || !resource.fields.length"
          @click="save"
        >
          <template #icon><Save aria-hidden="true" /></template>
          {{ t("collection.saveTranslations") }}
        </BaseButton>
      </footer>
    </div>
    <p v-else-if="!collectionStore.isLoadingTranslations" class="localization-empty">
      {{ t("collection.noTranslationLocales") }}
    </p>
  </section>
</template>

<style scoped>
.collection-localization-panel,
.translation-fields {
  display: grid;
  gap: 12px;
}

.collection-localization-panel > header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.collection-localization-panel h3,
.collection-localization-panel p {
  margin: 0;
}

.collection-localization-panel h3 {
  font-size: 14px;
}

.collection-localization-panel > header p,
.localization-empty,
.localization-empty-hint {
  color: var(--text-muted);
  font-size: 11px;
}

.localization-icon {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: 9px;
  background: var(--green-soft);
  color: var(--green);
}

.localization-icon svg {
  width: 17px;
}

.localization-toolbar {
  max-width: 560px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 9px;
}

.localization-warning,
.localization-error {
  padding: 10px;
  border-radius: 8px;
  font-size: 12px;
}

.localization-warning {
  background: var(--amber-soft);
  color: var(--amber);
}

.localization-error {
  background: var(--red-soft);
  color: var(--red);
}

.translation-fields article {
  display: grid;
  grid-template-columns: minmax(160px, 0.8fr) minmax(260px, 1.2fr);
  gap: 10px 14px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--surface-raised);
}

.translation-fields article.outdated {
  border-color: color-mix(in srgb, var(--amber) 35%, var(--border));
}

.translation-fields article > header {
  grid-column: 1 / -1;
  display: flex;
  justify-content: space-between;
  color: var(--text-secondary);
  font-size: 11px;
}

.translation-fields article > header span {
  color: var(--amber);
}

.translation-fields article > div,
.translation-value {
  display: grid;
  align-content: start;
  gap: 5px;
  color: var(--text-muted);
  font-size: 10px;
}

.translation-fields article > div p {
  min-height: var(--control-height-md);
  padding: 9px 10px;
  border-radius: 7px;
  background: var(--surface-soft);
  color: var(--text-secondary);
  white-space: pre-wrap;
}

.translation-fields footer {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 700px) {
  .translation-fields article {
    grid-template-columns: 1fr;
  }

  .translation-fields article > header {
    grid-column: 1;
  }
}
</style>
