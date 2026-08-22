<script setup lang="ts">
withDefaults(
  defineProps<{
    disabled?: boolean;
    showNotify?: boolean;
    bordered?: boolean;
  }>(),
  {
    disabled: false,
    showNotify: true,
    bordered: false,
  },
);

const number = defineModel<string>("number", { default: "" });
const company = defineModel<string>("company", { default: "" });
const url = defineModel<string>("url", { default: "" });
const notifyCustomer = defineModel<boolean>("notifyCustomer", { default: false });
const { t } = useLocalization();
</script>

<template>
  <div class="fulfillment-tracking-fields" :class="{ 'is-bordered': bordered }">
    <label>
      <span>{{ t("operations.fulfillment.trackingNumber") }}</span>
      <input v-model="number" :disabled="disabled" autocomplete="off" />
    </label>
    <label>
      <span>{{ t("operations.fulfillment.carrier") }}</span>
      <input v-model="company" :disabled="disabled" autocomplete="organization" />
    </label>
    <label class="is-wide">
      <span>{{ t("operations.fulfillment.trackingUrl") }}</span>
      <input
        v-model="url"
        :disabled="disabled"
        type="url"
        inputmode="url"
        autocomplete="url"
      />
    </label>
    <BaseCheckbox
      v-if="showNotify"
      v-model="notifyCustomer"
      class="is-wide"
      :disabled="disabled"
      :label="t('operations.fulfillment.notifyCustomer')"
    />
  </div>
</template>

<style scoped>
.fulfillment-tracking-fields {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 12px;
}

.fulfillment-tracking-fields.is-bordered {
  padding: 14px 16px;
  border-top: 1px solid var(--border);
}

label {
  display: grid;
  gap: 5px;
}

label > span {
  color: var(--text-sub);
  font-size: 11px;
  font-weight: 600;
}

input {
  width: 100%;
  box-sizing: border-box;
  min-height: var(--control-height-sm);
  border: 1px solid var(--border);
  border-radius: var(--control-radius-sm);
  padding: 7px 9px;
  background: var(--surface-raised);
  color: var(--text);
  font: inherit;
}

input:focus {
  outline: none;
  border-color: var(--green);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--green) 20%, transparent);
}

input:disabled {
  opacity: 0.55;
}

.is-wide {
  grid-column: 1 / -1;
}

@media (max-width: 720px) {
  .fulfillment-tracking-fields {
    grid-template-columns: 1fr;
  }

  .is-wide {
    grid-column: auto;
  }
}
</style>
