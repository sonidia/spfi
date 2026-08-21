<script setup lang="ts">
import { ChevronDown, Filter } from "@lucide/vue";
import { computed, ref, useId } from "vue";
import { useLocalization } from "~/composables/useLocalization";

const props = withDefaults(
  defineProps<{
    title?: string;
    activeCount?: number;
    modelValue?: boolean;
    hideSummary?: boolean;
    panelId?: string;
  }>(),
  {
    title: "",
    activeCount: 0,
    modelValue: undefined,
    hideSummary: false,
    panelId: "",
  },
);

const emit = defineEmits<{
  submit: [];
  "update:modelValue": [value: boolean];
}>();

const localIsOpen = ref(false);
const isOpen = computed({
  get: () => props.modelValue ?? localIsOpen.value,
  set: (value: boolean) => {
    localIsOpen.value = value;
    emit("update:modelValue", value);
  },
});
const generatedPanelId = useId();
const resolvedPanelId = computed(() => props.panelId || generatedPanelId);
const { t } = useLocalization();
const visibleTitle = computed(() => props.title || t("filter.filters"));
const activeLabel = computed(() => t("filter.active", { count: props.activeCount }));
</script>

<template>
  <section
    v-show="isOpen || !hideSummary"
    class="payment-filter-panel"
    :class="{ 'has-external-summary': hideSummary }"
  >
    <div v-if="!hideSummary" class="payment-filter-summary">
      <BaseButton
        class="payment-filter-toggle"
        size="medium"
        type="button"
        :aria-expanded="isOpen"
        :aria-controls="resolvedPanelId"
        :aria-label="`${visibleTitle}. ${activeLabel}`"
        @click="isOpen = !isOpen"
      >
        <template #icon><Filter aria-hidden="true" /></template>
        <span>{{ isOpen ? t("filter.hide") : t("filter.show") }}</span>
        <span v-if="activeCount" class="payment-filter-count">
          {{ activeCount }}
        </span>
        <ChevronDown class="payment-filter-chevron" :class="{ 'is-open': isOpen }" />
      </BaseButton>

      <div class="payment-filter-title">{{ visibleTitle }}</div>

      <div v-if="$slots.toolbar" class="payment-filter-toolbar">
        <slot name="toolbar" />
      </div>
    </div>

    <form
      v-show="isOpen"
      :id="resolvedPanelId"
      class="payment-filter-form"
      @submit.prevent="$emit('submit')"
    >
      <div class="payment-filter-fields">
        <slot />
      </div>
      <div class="payment-filter-actions">
        <slot name="actions" />
      </div>
    </form>
  </section>
</template>

<style>
.payment-filter-panel {
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.payment-filter-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 54px;
  padding: 10px 14px;
}

.payment-filter-toggle {
  gap: 7px;
}

.payment-filter-toggle:hover {
  border-color: color-mix(in srgb, var(--green) 36%, var(--border));
  background: var(--surface-raised);
}

.payment-filter-toggle:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--green) 42%, transparent);
  outline-offset: 2px;
}

.payment-filter-toggle svg {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
}

.payment-filter-toggle .button-label {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.payment-filter-count {
  display: inline-grid;
  min-width: 18px;
  height: 18px;
  place-items: center;
  border-radius: 999px;
  background: var(--green);
  color: var(--on-accent);
  font-size: 10px;
  line-height: 1;
}

.payment-filter-chevron {
  color: var(--muted);
  transition: transform 0.16s ease;
}

.payment-filter-chevron.is-open {
  transform: rotate(180deg);
}

.payment-filter-title {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 1px;
}

.payment-filter-title strong {
  color: var(--text);
  font-size: 12px;
  line-height: 1.2;
}

.payment-filter-title span {
  color: var(--muted);
  font-size: 11px;
}

.payment-filter-toolbar {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
}

.payment-filter-form {
  display: grid;
  gap: 12px;
  padding: 2px 14px 14px;
}

.payment-filter-panel.has-external-summary .payment-filter-form {
  padding-top: 14px;
}

.payment-filter-fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
  align-items: end;
}

.payment-filter-field {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.payment-filter-field > span:first-child {
  color: var(--text-sub);
  font-size: 11px;
  font-weight: 600;
}

.payment-filter-input {
  width: 100%;
  min-width: 0;
  height: var(--control-height-md);
  border: 1px solid var(--border);
  border-radius: var(--control-radius-sm);
  padding: 0 9px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-size: 12px;
}

.payment-filter-input:focus {
  border-color: var(--green);
  box-shadow: var(--focus-ring);
  outline: none;
}

.payment-filter-checkbox {
  min-height: 58px;
  align-content: end;
}

.payment-filter-checkbox .base-checkbox {
  min-height: var(--control-height-md);
}

.payment-filter-panel .custom-select,
.payment-filter-panel .filter-select {
  width: 100%;
}

.payment-filter-panel .select-trigger {
  width: 100%;
  min-height: var(--control-height-md);
  padding: 0 9px;
  background: var(--surface);
  font-size: 12px;
}

.payment-filter-panel .selected-label {
  font-size: 12px;
  font-weight: 600;
}

.payment-filter-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  justify-content: flex-end;
}

@media (max-width: 620px) {
  .payment-filter-summary {
    align-items: stretch;
    flex-wrap: wrap;
  }

  .payment-filter-title {
    order: 3;
    flex-basis: 100%;
  }

  .payment-filter-toolbar {
    margin-left: auto;
  }

  .payment-filter-fields {
    grid-template-columns: 1fr;
  }

  .payment-filter-actions,
  .payment-filter-actions .base-button {
    width: 100%;
  }
}
</style>
