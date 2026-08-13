<script setup lang="ts">
import { Search } from "@lucide/vue";
import { computed, ref, useId } from "vue";
import type {
  ShopifyMarketConditionApplicationLevel,
  ShopifyMarketConditionResourceSummary,
} from "~~/types/shopify-market";

type PickerMode = "NONE" | ShopifyMarketConditionApplicationLevel;

const props = defineProps<{
  title: string;
  description: string;
  options: ShopifyMarketConditionResourceSummary[];
  mode: PickerMode;
  selected: string[];
  allowAll?: boolean;
  disabled?: boolean;
}>();
const emit = defineEmits<{
  "update:mode": [value: PickerMode];
  "update:selected": [value: string[]];
}>();
const { t } = useLocalization();
const groupName = `market-condition-${useId()}`;
const search = ref("");
const visibleOptions = computed(() => {
  const query = search.value.trim().toLowerCase();
  if (!query) return props.options;
  return props.options.filter((item) =>
    [item.name, item.description || ""].some((value) =>
      value.toLowerCase().includes(query),
    ),
  );
});

function toggle(id: string) {
  emit(
    "update:selected",
    props.selected.includes(id)
      ? props.selected.filter((item) => item !== id)
      : [...props.selected, id],
  );
}
</script>

<template>
  <fieldset class="market-fieldset market-condition-picker" :disabled="disabled">
    <legend>{{ title }}</legend>
    <p>{{ description }}</p>
    <div class="market-condition-mode" role="radiogroup" :aria-label="title">
      <label>
        <input
          type="radio"
          :name="groupName"
          :checked="mode === 'NONE'"
          @change="emit('update:mode', 'NONE')"
        />
        <span>{{ t("markets.editor.conditionNone") }}</span>
      </label>
      <label v-if="allowAll">
        <input
          type="radio"
          :name="groupName"
          :checked="mode === 'ALL'"
          @change="emit('update:mode', 'ALL')"
        />
        <span>{{ t("markets.editor.conditionAll") }}</span>
      </label>
      <label>
        <input
          type="radio"
          :name="groupName"
          :checked="mode === 'SPECIFIED'"
          @change="emit('update:mode', 'SPECIFIED')"
        />
        <span>{{ t("markets.editor.conditionSpecified") }}</span>
      </label>
    </div>
    <template v-if="mode === 'SPECIFIED'">
      <label class="markets-search market-condition-search">
        <Search aria-hidden="true" />
        <input
          v-model="search"
          type="search"
          :placeholder="t('markets.editor.searchConditions')"
          :aria-label="t('markets.editor.searchConditions')"
        />
      </label>
      <div v-if="!options.length" class="market-empty-small">
        {{ t("markets.editor.noConditionOptions") }}
      </div>
      <div v-else-if="!visibleOptions.length" class="market-empty-small">
        {{ t("markets.noFilterResults") }}
      </div>
      <div v-else class="market-selection-list market-condition-options">
        <BaseCheckbox
          v-for="item in visibleOptions"
          :key="item.id"
          :model-value="selected.includes(item.id)"
          :label="item.name"
          :description="
            item.description ||
            (item.active === false ? t('markets.editor.conditionInactive') : '')
          "
          @change="toggle(item.id)"
        />
      </div>
    </template>
  </fieldset>
</template>
