<script setup lang="ts">
import { PackageSearch, Save } from "@lucide/vue";
import { reactive, watch } from "vue";
import { useInventoryItem } from "~/composables/useInventoryItem";
import { useToastStore } from "~/stores/toast";
import type { ShopifyNumericId } from "~~/types/shopify";
import type {
  ShopifyInventoryItemDetails,
  ShopifyWeightUnit,
} from "~~/types/shopify-inventory";

const props = defineProps<{ inventoryItemId: ShopifyNumericId | null }>();
const emit = defineEmits<{ saved: [] }>();
const inventoryItem = useInventoryItem();
const toast = useToastStore();
const { t } = useLocalization();
const form = reactive(emptyForm());
const weightUnitOptions = [
  { label: t("product.weightGrams"), value: "GRAMS" },
  { label: t("product.weightKilograms"), value: "KILOGRAMS" },
  { label: t("product.weightOunces"), value: "OUNCES" },
  { label: t("product.weightPounds"), value: "POUNDS" },
];

watch(
  () => props.inventoryItemId,
  async (id) => {
    Object.assign(form, emptyForm());
    if (!id) return;
    const item = await inventoryItem.load(id);
    if (item && String(props.inventoryItemId) === String(id)) fillForm(item);
  },
  { immediate: true },
);

async function save() {
  if (!props.inventoryItemId) return;
  const updated = await inventoryItem.update(props.inventoryItemId, {
    sku: form.sku.trim(),
    tracked: form.tracked,
    requires_shipping: form.requiresShipping,
    harmonized_system_code: form.harmonizedSystemCode.trim(),
    country_code_of_origin: form.countryCodeOfOrigin.trim().toUpperCase(),
    province_code_of_origin: form.provinceCodeOfOrigin.trim().toUpperCase(),
    weight_value: form.weightValue === "" ? null : Number(form.weightValue),
    weight_unit: form.weightUnit,
  });
  if (!updated) {
    toast.error(inventoryItem.error.value || t("product.inventoryItemUpdateFailed"));
    return;
  }
  fillForm(updated);
  toast.success(t("product.inventoryItemUpdated"));
  emit("saved");
}

function fillForm(item: ShopifyInventoryItemDetails) {
  Object.assign(form, {
    sku: item.sku,
    tracked: item.tracked,
    requiresShipping: item.requiresShipping,
    harmonizedSystemCode: item.harmonizedSystemCode,
    countryCodeOfOrigin: item.countryCodeOfOrigin,
    provinceCodeOfOrigin: item.provinceCodeOfOrigin,
    weightValue: item.weight ? String(item.weight.value) : "",
    weightUnit: item.weight?.unit || "GRAMS",
  });
}

function emptyForm() {
  return {
    sku: "",
    tracked: false,
    requiresShipping: true,
    harmonizedSystemCode: "",
    countryCodeOfOrigin: "",
    provinceCodeOfOrigin: "",
    weightValue: "",
    weightUnit: "GRAMS" as ShopifyWeightUnit,
  };
}
</script>

<template>
  <div v-if="inventoryItemId" class="inventory-item-editor">
    <header>
      <PackageSearch />
      <div>
        <strong>{{ t("product.inventoryItemDetails") }}</strong>
        <small>{{ t("product.inventoryItemDetailsDescription") }}</small>
      </div>
    </header>
    <p v-if="inventoryItem.error.value" class="editor-error" role="alert">
      {{ inventoryItem.error.value }}
    </p>
    <div class="editor-grid" :aria-busy="inventoryItem.isLoading.value">
      <label>
        <span>{{ t("product.sku") }}</span>
        <input v-model="form.sku" type="text" maxlength="255" />
      </label>
      <label>
        <span>{{ t("product.hsCode") }}</span>
        <input
          v-model="form.harmonizedSystemCode"
          type="text"
          inputmode="numeric"
          maxlength="13"
        />
      </label>
      <label>
        <span>{{ t("product.countryOfOrigin") }}</span>
        <input v-model="form.countryCodeOfOrigin" type="text" maxlength="2" />
      </label>
      <label>
        <span>{{ t("product.provinceOfOrigin") }}</span>
        <input v-model="form.provinceCodeOfOrigin" type="text" maxlength="12" />
      </label>
      <label>
        <span>{{ t("product.weight") }}</span>
        <input v-model="form.weightValue" type="number" min="0" step="any" />
      </label>
      <label>
        <span>{{ t("product.weightUnit") }}</span>
        <BaseSelect
          :model-value="form.weightUnit"
          :options="weightUnitOptions"
          :aria-label="t('product.weightUnit')"
          @update:model-value="form.weightUnit = $event as ShopifyWeightUnit"
        />
      </label>
      <BaseCheckbox v-model="form.tracked" :label="t('product.trackInventory')" />
      <BaseCheckbox
        v-model="form.requiresShipping"
        :label="t('product.requiresShipping')"
      />
    </div>
    <BaseButton
      variant="primary"
      size="medium"
      :loading="inventoryItem.isLoading.value"
      @click="save"
    >
      <template #icon><Save /></template>
      {{ t("common.save") }}
    </BaseButton>
  </div>
</template>

<style scoped>
.inventory-item-editor {
  display: grid;
  gap: 12px;
  margin-top: 14px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--surface-soft);
}

header {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

header svg {
  width: 18px;
  color: var(--green);
}

header div {
  display: grid;
  gap: 2px;
}

header strong,
label span {
  font-size: 11px;
}

header small {
  color: var(--muted);
  font-size: 10px;
}

.editor-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

label {
  display: grid;
  gap: 5px;
}

input[type="text"],
input[type="number"] {
  width: 100%;
  height: 36px;
  min-height: 36px;
  padding: 0 9px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--surface);
  color: var(--text);
}

.inventory-item-editor :deep(.select-trigger) {
  height: 36px;
  min-height: 36px;
  padding-block: 0;
}

.inventory-item-editor :deep(.base-checkbox) {
  min-height: 36px;
}

.editor-error {
  margin: 0;
  color: var(--red);
  font-size: 11px;
}

.inventory-item-editor > :deep(.base-button) {
  justify-self: end;
}

@media (max-width: 720px) {
  .editor-grid {
    grid-template-columns: 1fr;
  }
}
</style>
