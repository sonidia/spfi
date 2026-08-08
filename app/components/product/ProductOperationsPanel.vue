<script setup lang="ts">
import {
  Boxes,
  ImagePlus,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { useLocations } from "~/composables/useLocations";
import { useProductOperations } from "~/composables/useProductOperations";
import { useToastStore } from "~/stores/toast";
import type {
  ShopifyProduct,
  ShopifyProductImage,
  ShopifyVariant,
} from "~~/types/shopify";
import type {
  ShopifyProductImageInput,
  ShopifyVariantInput,
} from "~~/types/shopify-product";

const props = defineProps<{ product: ShopifyProduct }>();
const emit = defineEmits<{ refreshed: [] }>();
const toast = useToastStore();
const operations = useProductOperations();
const { t } = useLocalization();
const {
  locations,
  inventoryLevels,
  fetchLocations,
  fetchProductInventory,
} = useLocations();

const editingVariantId = ref<number | null>(null);
const variantForm = ref<ShopifyVariantInput>(emptyVariantForm());
const imageUrl = ref("");
const imageAlt = ref("");
const imageDrafts = ref<
  Record<number, { position: number; alt: string; variantIds: number[] }>
>({});
const inventoryVariantId = ref<number | null>(null);
const inventoryLocationId = ref<number | null>(null);
const inventoryMode = ref<"set" | "adjust">("set");
const inventoryAmount = ref(0);

const inventoryVariants = computed(() =>
  operations.variants.value.filter(
    (variant) => typeof variant.inventory_item_id === "number",
  ),
);
const selectedInventoryVariant = computed(() =>
  inventoryVariants.value.find(
    (variant) => variant.id === inventoryVariantId.value,
  ),
);
const selectedInventoryLevel = computed(() => {
  const itemId = selectedInventoryVariant.value?.inventory_item_id;
  if (!itemId || !inventoryLocationId.value) return null;
  return inventoryLevels.value.find(
    (level) =>
      level.inventory_item_id === itemId &&
      level.location_id === inventoryLocationId.value,
  );
});

function formatVariantInventory(variant: ShopifyVariant) {
  if (typeof variant.inventory_quantity === "number") {
    return t("product.availableCount", {
      count: variant.inventory_quantity,
    });
  }

  return variant.inventory_management
    ? t("product.tracked")
    : t("product.notTracked");
}

watch(
  () => props.product.id,
  () => {
    resetVariantForm();
    imageUrl.value = "";
    imageAlt.value = "";
    imageDrafts.value = {};
    inventoryVariantId.value = null;
    inventoryLocationId.value = null;
    inventoryAmount.value = 0;
    void refreshAll();
  },
  { immediate: true },
);

function emptyVariantForm(): ShopifyVariantInput {
  return {
    option1: "",
    price: "0.00",
    sku: "",
    barcode: "",
    taxable: true,
    requires_shipping: true,
    inventory_management: "shopify",
    inventory_policy: "deny",
  };
}

async function refreshAll() {
  const productId = props.product.id;
  await Promise.all([
    operations.load(productId),
    fetchLocations(),
  ]);
  if (props.product.id !== productId) return;

  await fetchProductInventory(
    { ...props.product, variants: operations.variants.value },
    true,
  );
  if (props.product.id !== productId) return;

  initializeDrafts();
}

function initializeDrafts() {
  imageDrafts.value = Object.fromEntries(
    operations.images.value
      .filter((image): image is ShopifyProductImage & { id: number } =>
        Boolean(image.id),
      )
      .map((image) => [
        image.id,
        {
          position: image.position || 1,
          alt: image.alt || "",
          variantIds: [...(image.variant_ids || [])],
        },
      ]),
  );
  if (
    !inventoryVariantId.value ||
    !inventoryVariants.value.some(
      (variant) => variant.id === inventoryVariantId.value,
    )
  ) {
    inventoryVariantId.value = inventoryVariants.value[0]?.id || null;
  }
  if (
    !inventoryLocationId.value ||
    !locations.value.some(
      (location) => location.id === inventoryLocationId.value,
    )
  ) {
    inventoryLocationId.value = locations.value[0]?.id || null;
  }
}

function editVariant(variant: ShopifyVariant) {
  editingVariantId.value = variant.id;
  variantForm.value = {
    option1: variant.option1 || variant.title || "",
    option2: variant.option2 || null,
    option3: variant.option3 || null,
    price: variant.price || "0.00",
    compare_at_price: variant.compare_at_price || null,
    sku: variant.sku || "",
    barcode: variant.barcode || "",
    taxable: variant.taxable !== false,
    requires_shipping: variant.requires_shipping !== false,
    inventory_management:
      variant.inventory_management === "shopify" ? "shopify" : null,
    inventory_policy:
      variant.inventory_policy === "continue" ? "continue" : "deny",
    image_id: variant.image_id || null,
  };
}

function resetVariantForm() {
  editingVariantId.value = null;
  variantForm.value = emptyVariantForm();
}

async function saveVariant() {
  const option1 = String(variantForm.value.option1 || "").trim();
  const price = String(variantForm.value.price || "").trim();
  if (!option1 || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(price)) {
    toast.error(t("product.variantRequired"));
    return;
  }
  const input = {
    ...variantForm.value,
    option1,
    price,
  };
  const response = editingVariantId.value
    ? await operations.updateVariant(
        props.product.id,
        editingVariantId.value,
        input,
      )
    : await operations.createVariant(props.product.id, input);
  if (!response) return;

  toast.success(
    editingVariantId.value
      ? t("product.variantUpdated")
      : t("product.variantCreated"),
  );
  resetVariantForm();
  await afterMutation();
}

async function removeVariant(variant: ShopifyVariant) {
  if (
    !confirm(
      t("product.deleteVariantConfirm", {
        title: variant.title || variant.id,
      }),
    ) ||
    !(await operations.deleteVariant(props.product.id, variant.id))
  ) {
    return;
  }
  toast.success(t("product.variantDeleted"));
  await afterMutation();
}

async function addImage() {
  const src = imageUrl.value.trim();
  if (!/^https?:\/\//i.test(src)) {
    toast.error(t("product.validImageUrl"));
    return;
  }
  const image: ShopifyProductImageInput = {
    src,
    ...(imageAlt.value.trim() ? { alt: imageAlt.value.trim() } : {}),
  };
  if (!(await operations.createImage(props.product.id, image))) return;

  imageUrl.value = "";
  imageAlt.value = "";
  toast.success(t("product.productImageAdded"));
  await afterMutation();
}

async function saveImage(image: ShopifyProductImage) {
  if (!image.id) return;
  const draft = imageDrafts.value[image.id];
  if (!draft || !Number.isSafeInteger(Number(draft.position)) || draft.position < 1) {
    toast.error(t("product.imagePositionRequired"));
    return;
  }
  if (
    !(await operations.updateImage(props.product.id, image.id, {
      position: Number(draft.position),
      alt: draft.alt.trim() || null,
      variant_ids: draft.variantIds,
    }))
  ) {
    return;
  }
  toast.success(t("product.imageSaved"));
  await afterMutation();
}

async function removeImage(image: ShopifyProductImage) {
  if (
    !image.id ||
    !confirm(t("product.deleteImageConfirm")) ||
    !(await operations.deleteImage(props.product.id, image.id))
  ) {
    return;
  }
  toast.success(t("product.imageDeleted"));
  await afterMutation();
}

function toggleImageVariant(imageId: number, variantId: number) {
  const draft = imageDrafts.value[imageId];
  if (!draft) return;
  const index = draft.variantIds.indexOf(variantId);
  if (index === -1) draft.variantIds.push(variantId);
  else draft.variantIds.splice(index, 1);
}

async function updateInventory() {
  const itemId = selectedInventoryVariant.value?.inventory_item_id;
  const locationId = inventoryLocationId.value;
  const amount = Number(inventoryAmount.value);
  if (!itemId || !locationId || !Number.isSafeInteger(amount)) {
    toast.error(t("product.selectVariantLocationWhole"));
    return;
  }
  const response =
    inventoryMode.value === "set"
      ? await operations.setInventory(locationId, itemId, amount)
      : await operations.adjustInventory(locationId, itemId, amount);
  if (!response) return;

  operations.replaceInventoryLevel(
    inventoryLevels.value,
    response.inventory_level,
  );
  toast.success(
    inventoryMode.value === "set"
      ? t("product.inventoryUpdated")
      : t("product.inventoryAdjustmentApplied"),
  );
  inventoryAmount.value = 0;
  emit("refreshed");
}

async function afterMutation() {
  emit("refreshed");
  await refreshAll();
}
</script>

<template>
  <section class="operations-panel">
    <header>
      <div>
        <strong>{{ t("product.operationsTitle") }}</strong>
        <span>{{ t("product.operationsDescription") }}</span>
      </div>
      <BaseButton
        icon-only
        :title="t('product.refreshOperations')"
        :loading="operations.isLoading.value"
        @click="refreshAll"
      >
        <template #icon><RefreshCw /></template>
      </BaseButton>
    </header>

    <div v-if="operations.error.value" class="operation-error" role="alert">
      {{ operations.error.value }}
    </div>

    <div class="operation-section">
      <div class="section-title">
        <div><Boxes /><strong>{{ t("product.variants") }}</strong></div>
        <span>{{ t("product.totalCount", { count: operations.variants.value.length }) }}</span>
      </div>

      <div class="variant-form form-grid">
        <label><span>{{ t("product.variantTitle") }} *</span><input v-model="variantForm.option1" :placeholder="t('product.defaultTitle')" /></label>
        <label><span>{{ t("product.price") }} *</span><input v-model="variantForm.price" type="number" min="0" step="0.01" /></label>
        <label><span>{{ t("product.sku") }}</span><input v-model="variantForm.sku" /></label>
        <label><span>{{ t("product.barcode") }}</span><input v-model="variantForm.barcode" /></label>
        <label>
          <span>{{ t("product.image") }}</span>
          <select v-model.number="variantForm.image_id">
            <option :value="null">{{ t("product.noImage") }}</option>
            <option v-for="image in operations.images.value" :key="image.id" :value="image.id">
              {{ t("product.imageNumber", { id: image.position || image.id || "" }) }}
            </option>
          </select>
        </label>
        <label>
          <span>{{ t("product.inventoryPolicy") }}</span>
          <select v-model="variantForm.inventory_policy">
            <option value="deny">{{ t("product.stopSellingAtZero") }}</option>
            <option value="continue">{{ t("product.continueSelling") }}</option>
          </select>
        </label>
        <label class="check"><input v-model="variantForm.taxable" type="checkbox" /><span>{{ t("product.taxable") }}</span></label>
        <label class="check"><input v-model="variantForm.requires_shipping" type="checkbox" /><span>{{ t("product.requiresShipping") }}</span></label>
        <div class="form-actions">
          <BaseButton v-if="editingVariantId" @click="resetVariantForm">{{ t("common.cancel") }}</BaseButton>
          <BaseButton variant="primary" :loading="operations.isLoading.value" @click="saveVariant">
            <template #icon><Save v-if="editingVariantId" /><Plus v-else /></template>
            {{ editingVariantId ? t("product.saveVariant") : t("product.addVariant") }}
          </BaseButton>
        </div>
      </div>

      <div class="compact-list">
        <article v-for="variant in operations.variants.value" :key="variant.id">
          <div>
            <strong>{{ variant.title || t("product.defaultVariant") }}</strong>
            <span class="variant-summary">{{ variant.sku || t("product.noSku") }} - {{ variant.price || "0.00" }} - {{ formatVariantInventory(variant) }}</span>
          </div>
          <div class="row-actions">
            <BaseButton icon-only variant="ghost" :title="t('product.editVariant')" @click="editVariant(variant)">
              <template #icon><Pencil /></template>
            </BaseButton>
            <BaseButton icon-only variant="danger-ghost" :title="t('product.deleteVariant')" @click="removeVariant(variant)">
              <template #icon><Trash2 /></template>
            </BaseButton>
          </div>
        </article>
      </div>
    </div>

    <div class="operation-section">
      <div class="section-title">
        <div><ImagePlus /><strong>{{ t("product.images") }}</strong></div>
        <span>{{ t("product.imagesDescription") }}</span>
      </div>
      <div class="image-create">
        <input v-model="imageUrl" type="url" :placeholder="t('product.imageUrlPlaceholder')" />
        <input v-model="imageAlt" :placeholder="t('product.altText')" />
        <BaseButton variant="primary" :loading="operations.isLoading.value" @click="addImage">
          <template #icon><ImagePlus /></template>
          {{ t("product.addImage") }}
        </BaseButton>
      </div>
      <div class="image-grid">
        <article v-for="image in operations.images.value" :key="image.id" class="image-card">
          <img :src="image.src" :alt="image.alt || t('product.productImage')" />
          <div v-if="image.id && imageDrafts[image.id]" class="image-fields">
            <label><span>{{ t("product.position") }}</span><input v-model.number="imageDrafts[image.id]!.position" type="number" min="1" step="1" /></label>
            <label><span>{{ t("product.altText") }}</span><input v-model="imageDrafts[image.id]!.alt" /></label>
            <fieldset>
              <legend>{{ t("product.assignedVariants") }}</legend>
              <label v-for="variant in operations.variants.value" :key="variant.id" class="check">
                <input
                  type="checkbox"
                  :checked="imageDrafts[image.id]!.variantIds.includes(variant.id)"
                  @change="toggleImageVariant(image.id!, variant.id)"
                />
                <span>{{ variant.title || variant.sku || variant.id }}</span>
              </label>
            </fieldset>
            <div class="form-actions">
              <BaseButton variant="danger-ghost" @click="removeImage(image)">
                <template #icon><Trash2 /></template>
                {{ t("common.delete") }}
              </BaseButton>
              <BaseButton variant="primary" @click="saveImage(image)">
                <template #icon><Save /></template>
                {{ t("common.save") }}
              </BaseButton>
            </div>
          </div>
        </article>
      </div>
    </div>

    <div class="operation-section">
      <div class="section-title">
        <div><Boxes /><strong>{{ t("product.inventory") }}</strong></div>
        <span>{{ t("product.inventoryDescription") }}</span>
      </div>
      <div class="inventory-form">
        <label>
          <span>{{ t("product.variant") }}</span>
          <select v-model.number="inventoryVariantId">
            <option v-for="variant in inventoryVariants" :key="variant.id" :value="variant.id">
              {{ variant.title || variant.sku || variant.id }}
            </option>
          </select>
        </label>
        <label>
          <span>{{ t("product.location") }}</span>
          <select v-model.number="inventoryLocationId">
            <option v-for="location in locations" :key="location.id" :value="location.id">
              {{ location.name || location.id }}
            </option>
          </select>
        </label>
        <label>
          <span>{{ t("product.operation") }}</span>
          <select v-model="inventoryMode">
            <option value="set">{{ t("product.setQuantity") }}</option>
            <option value="adjust">{{ t("product.adjustQuantity") }}</option>
          </select>
        </label>
        <label>
          <span>{{ inventoryMode === "set" ? t("product.available") : t("product.adjustment") }}</span>
          <input v-model.number="inventoryAmount" type="number" step="1" />
        </label>
        <div class="inventory-current">
          {{ t("product.current") }}: <strong>{{ selectedInventoryLevel?.available ?? t("product.notConnected") }}</strong>
        </div>
        <BaseButton variant="primary" :loading="operations.isLoading.value" @click="updateInventory">
          <template #icon><Save /></template>
          {{ t("product.apply") }}
        </BaseButton>
      </div>
    </div>
  </section>
</template>

<style scoped>
.operations-panel { border-top: 1px solid var(--border); background: var(--surface); }
header, .section-title, .compact-list article, .form-actions { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
header { padding: 14px 16px; }
header > div { display: grid; gap: 2px; }
header strong, .section-title strong { color: var(--text); font-size: 13px; }
header span, .section-title span, .compact-list span { color: var(--text-sub); font-size: 11px; }
.operation-error { padding: 10px 16px; border-top: 1px solid rgba(180,49,43,.2); background: var(--red-soft); color: var(--red); font-size: 12px; }
.operation-section { padding: 14px 16px; border-top: 1px solid var(--border); }
.section-title > div { display: inline-flex; align-items: center; gap: 7px; }
.section-title svg { width: 15px; color: var(--green); }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px; margin-top: 10px; }
label { display: grid; gap: 4px; }
label > span, legend { color: var(--text-sub); font-size: 10px; font-weight: 700; }
input, select { width: 100%; min-height: 32px; border: 1px solid var(--border); border-radius: 6px; padding: 6px 8px; background: var(--surface-raised); color: var(--text); font: inherit; font-size: 11px; }
.check { display: flex; align-items: center; gap: 6px; }
.check input { width: 15px; min-height: 15px; }
.form-actions { grid-column: 1 / -1; justify-content: flex-end; }
.compact-list { display: grid; gap: 6px; margin-top: 10px; }
.compact-list article { border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px; }
.compact-list article > div:first-child { display: grid; min-width: 0; }
.compact-list strong { overflow: hidden; color: var(--text); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.row-actions { display: flex; gap: 4px; }
.image-create { display: grid; grid-template-columns: 2fr 1fr auto; gap: 7px; margin-top: 10px; }
.image-grid { display: grid; gap: 8px; margin-top: 10px; }
.image-card { display: grid; grid-template-columns: 74px minmax(0,1fr); gap: 10px; border: 1px solid var(--border); border-radius: 7px; padding: 8px; }
.image-card > img { width: 74px; height: 74px; border-radius: 5px; object-fit: cover; }
.image-fields { display: grid; grid-template-columns: 80px minmax(0,1fr); gap: 7px; }
.image-fields fieldset { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 6px 12px; border: 0; }
.image-fields .form-actions { grid-column: 1 / -1; }
.inventory-form { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px; align-items: end; margin-top: 10px; }
.inventory-current { color: var(--text-sub); font-size: 11px; }
@media (max-width: 720px) {
  .form-grid, .inventory-form, .image-create { grid-template-columns: 1fr; }
  .form-actions { grid-column: auto; }
  .image-card { grid-template-columns: 1fr; }
}
</style>
