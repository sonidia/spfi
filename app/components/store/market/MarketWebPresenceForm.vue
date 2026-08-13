<script setup lang="ts">
import { Globe2, X } from "@lucide/vue";
import { computed, reactive, ref, watch } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useMarketStore } from "~/stores/market";
import type {
  ShopifyMarketEditorContext,
  ShopifyMarketWebPresenceSummary,
} from "~~/types/shopify-market";

const props = defineProps<{
  context: ShopifyMarketEditorContext;
  presence?: ShopifyMarketWebPresenceSummary | null;
}>();
const emit = defineEmits<{
  cancel: [];
  saved: [presence: ShopifyMarketWebPresenceSummary];
}>();
const marketStore = useMarketStore();
const { storeId, token } = useActiveShopAuth();
const { t } = useLocalization();
const feedback = useStoreFeedback();
const error = ref("");
const form = reactive({
  defaultLocale: "",
  alternateLocales: [] as string[],
  routing: "SUBFOLDER" as "SUBFOLDER" | "DOMAIN",
  subfolderSuffix: "",
  domainId: "",
  customDomainId: "",
});
const publishedLocales = computed(() =>
  props.context.locales.filter((locale) => locale.published),
);
const canChooseRouting = computed(() => !props.presence);
const localeOptions = computed(() =>
  publishedLocales.value.map((locale) => ({
    label: `${locale.name} · ${locale.locale}`,
    value: locale.locale,
  })),
);
const routingOptions = computed(() => [
  { label: t("markets.editor.subfolder"), value: "SUBFOLDER" },
  { label: t("markets.editor.domainBinding"), value: "DOMAIN" },
]);
const domainOptions = computed(() => [
  ...props.context.domains.map((domain) => ({
    label: domain.primary
      ? `${domain.host} · ${t("markets.editor.primaryDomain")}`
      : domain.host,
    value: domain.id,
    description: domain.assigned
      ? t("markets.editor.domainAlreadyAssigned")
      : domain.url,
    disabled: domain.assigned,
  })),
  { label: t("markets.editor.customDomainGid"), value: "CUSTOM" },
]);

watch(
  () => props.presence,
  (presence) => {
    form.defaultLocale =
      presence?.defaultLocale ||
      publishedLocales.value.find((item) => item.primary)?.locale ||
      publishedLocales.value[0]?.locale ||
      "en";
    form.alternateLocales = [...(presence?.alternateLocales || [])];
    form.routing = presence?.domain ? "DOMAIN" : "SUBFOLDER";
    form.subfolderSuffix = presence?.subfolderSuffix || "";
    form.domainId = presence?.domain?.id || "";
    form.customDomainId = "";
    error.value = "";
  },
  { immediate: true },
);

function toggleLocale(locale: string) {
  const index = form.alternateLocales.indexOf(locale);
  if (index >= 0) form.alternateLocales.splice(index, 1);
  else form.alternateLocales.push(locale);
}

async function save() {
  error.value = "";
  if (
    !form.defaultLocale ||
    (form.routing === "SUBFOLDER" && !form.subfolderSuffix.trim()) ||
    (form.routing === "DOMAIN" && !form.domainId && !form.customDomainId.trim())
  ) {
    error.value = t("markets.editor.webPresenceValidation");
    return;
  }
  const input = {
    defaultLocale: form.defaultLocale,
    alternateLocales: form.alternateLocales.filter(
      (locale) => locale !== form.defaultLocale,
    ),
    ...(props.presence
      ? props.presence.subfolderSuffix
        ? { subfolderSuffix: form.subfolderSuffix.trim().toLowerCase() }
        : {}
      : {
          domainId:
            form.routing === "DOMAIN"
              ? form.domainId === "CUSTOM"
                ? form.customDomainId.trim()
                : form.domainId
              : undefined,
          subfolderSuffix:
            form.routing === "SUBFOLDER"
              ? form.subfolderSuffix.trim().toLowerCase()
              : undefined,
        }),
  };
  const presence = props.presence
    ? await marketStore.updateWebPresence(
        storeId.value,
        token.value,
        props.presence.id,
        input,
      )
    : await marketStore.createWebPresence(storeId.value, token.value, input);
  if (!presence) {
    error.value = marketStore.managerError || t("markets.editor.saveFailed");
    return;
  }
  feedback.success(
    t(
      props.presence
        ? "markets.editor.webPresenceUpdated"
        : "markets.editor.webPresenceCreated",
    ),
  );
  emit("saved", presence);
}
</script>

<template>
  <form class="market-inline-editor" @submit.prevent="save">
    <div class="market-section-heading is-compact">
      <div>
        <h4>
          {{
            presence
              ? t("markets.editor.editWebPresence")
              : t("markets.editor.createWebPresence")
          }}
        </h4>
        <p>{{ t("markets.editor.webPresenceSharedHint") }}</p>
      </div>
      <BaseButton
        variant="ghost"
        icon-only
        :aria-label="t('common.close')"
        @click="emit('cancel')"
        ><template #icon><X /></template
      ></BaseButton>
    </div>
    <div class="market-form-grid">
      <label class="market-field">
        <span>{{ t("markets.editor.defaultLocale") }}</span>
        <BaseSelect
          :model-value="form.defaultLocale"
          :options="localeOptions"
          :aria-label="t('markets.editor.defaultLocale')"
          @update:model-value="form.defaultLocale = String($event || '')"
        />
      </label>
      <label class="market-field">
        <span>{{ t("markets.editor.urlStrategy") }}</span>
        <BaseSelect
          v-if="canChooseRouting"
          :model-value="form.routing"
          :options="routingOptions"
          :aria-label="t('markets.editor.urlStrategy')"
          @update:model-value="
            form.routing = $event === 'DOMAIN' ? 'DOMAIN' : 'SUBFOLDER'
          "
        />
        <div v-else class="market-readonly-field">
          <strong>
            {{
              presence?.domain ? presence.domain.host : t("markets.editor.subfolder")
            }}
          </strong>
        </div>
      </label>
      <label v-if="!presence && form.routing === 'DOMAIN'" class="market-field">
        <span>{{ t("markets.editor.domain") }}</span>
        <BaseSelect
          :model-value="form.domainId"
          :options="domainOptions"
          :placeholder="t('markets.editor.selectDomain')"
          :aria-label="t('markets.editor.domain')"
          @update:model-value="form.domainId = String($event || '')"
        />
        <small>{{ t("markets.editor.domainBindingHint") }}</small>
      </label>
      <label
        v-if="!presence && form.routing === 'DOMAIN' && form.domainId === 'CUSTOM'"
        class="market-field"
      >
        <span>{{ t("markets.editor.customDomainGid") }}</span>
        <input
          v-model.trim="form.customDomainId"
          placeholder="gid://shopify/Domain/123"
        />
        <small>{{ t("markets.editor.customDomainGidHint") }}</small>
      </label>
      <label
        v-if="form.routing === 'SUBFOLDER' && (!presence || presence.subfolderSuffix)"
        class="market-field"
      >
        <span>{{ t("markets.editor.subfolderSuffix") }}</span>
        <input
          v-model="form.subfolderSuffix"
          required
          pattern="[a-z0-9-]+"
          placeholder="ca"
        />
        <small>{{ t("markets.editor.asciiSuffixHint") }}</small>
      </label>
      <div v-else-if="presence?.domain" class="market-callout is-info">
        <strong>{{ t("markets.editor.domainBindingLockedTitle") }}</strong>
        <span>{{ t("markets.editor.domainBindingLockedDescription") }}</span>
      </div>
    </div>
    <fieldset class="market-fieldset">
      <legend>{{ t("markets.editor.alternateLocales") }}</legend>
      <div class="market-choice-grid">
        <BaseCheckbox
          v-for="locale in publishedLocales.filter(
            (item) => item.locale !== form.defaultLocale,
          )"
          :key="locale.locale"
          :model-value="form.alternateLocales.includes(locale.locale)"
          :label="`${locale.name} · ${locale.locale}`"
          @change="toggleLocale(locale.locale)"
        />
      </div>
    </fieldset>
    <p v-if="error" class="market-form-error" role="alert">{{ error }}</p>
    <div class="market-section-actions">
      <BaseButton @click="emit('cancel')">{{ t("common.cancel") }}</BaseButton>
      <BaseButton type="submit" variant="primary" :loading="marketStore.isManaging"
        ><template #icon><Globe2 /></template>{{ t("common.save") }}</BaseButton
      >
    </div>
  </form>
</template>
