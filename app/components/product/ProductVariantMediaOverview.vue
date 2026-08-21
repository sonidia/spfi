<script setup lang="ts">
import { ExternalLink, Image as ImageIcon } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import type {
  ShopifyNumericId,
  ShopifyProduct,
  ShopifyProductImage,
  ShopifyVariant,
} from "~~/types/shopify";
import { getSafeExternalUrl } from "~~/utils/safe-url";

const props = defineProps<{ product: ShopifyProduct }>();
const { t } = useLocalization();

const variants = computed(() => props.product.variants || []);
const productImages = computed(() => {
  if (props.product.images?.length) return props.product.images;
  return props.product.image ? [props.product.image] : [];
});
const selectedVariantId = ref("");
const selectedVariant = computed(
  () =>
    variants.value.find((variant) => sameId(variant.id, selectedVariantId.value)) ||
    variants.value[0] ||
    null,
);
const selectedVariantImage = computed(() =>
  selectedVariant.value ? imageForVariant(selectedVariant.value) : null,
);

watch(
  () => [
    props.product.id,
    variants.value.map((variant) => String(variant.id)).join(","),
  ],
  () => {
    selectedVariantId.value = String(variants.value[0]?.id || "");
  },
  { immediate: true },
);

function selectVariant(variant: ShopifyVariant) {
  selectedVariantId.value = String(variant.id);
}

function imageForVariant(variant: ShopifyVariant) {
  const variantImageId = variant.image_id;
  if (!variantImageId) return null;
  return (
    productImages.value.find((image) => image.id && sameId(image.id, variantImageId)) ||
    null
  );
}

function variantsForImage(image: ShopifyProductImage) {
  const assignedIds = new Set((image.variant_ids || []).map(String));
  return variants.value.filter(
    (variant) =>
      assignedIds.has(String(variant.id)) ||
      Boolean(image.id && variant.image_id && sameId(image.id, variant.image_id)),
  );
}

function imageKey(image: ShopifyProductImage, index: number) {
  return String(image.id || image.admin_graphql_api_id || image.src || index);
}

function isSelectedVariantImage(image: ShopifyProductImage) {
  const selectedImage = selectedVariantImage.value;
  if (!selectedImage) return false;
  if (image.id && selectedImage.id) return sameId(image.id, selectedImage.id);
  return image.src === selectedImage.src;
}

function imageSourceUrl(image: ShopifyProductImage) {
  return getSafeExternalUrl(image.src || "");
}

function sameId(left: ShopifyNumericId, right: ShopifyNumericId) {
  return String(left) === String(right);
}

function formatVariantPrice(variant: ShopifyVariant) {
  const price = String(variant.price || "").trim();
  if (!price) return "-";
  return props.product.price_currency
    ? `${price} ${props.product.price_currency}`
    : price;
}

function formatVariantInventory(variant: ShopifyVariant) {
  if (typeof variant.inventory_quantity === "number") {
    return t("product.availableCount", { count: variant.inventory_quantity });
  }
  return variant.inventory_management ? t("product.tracked") : t("product.notTracked");
}
</script>

<template>
  <section class="detail-section variant-media-overview">
    <div class="variant-media-heading">
      <div>
        <div class="detail-section-title">{{ t("product.variantMediaTitle") }}</div>
        <p>{{ t("product.variantMediaDescription") }}</p>
      </div>
      <span>{{ t("product.variantCount", { count: variants.length }) }}</span>
    </div>

    <div v-if="variants.length" class="variant-media-layout">
      <div
        class="variant-media-list"
        role="tablist"
        :aria-label="t('product.variantMediaTitle')"
      >
        <button
          v-for="variant in variants"
          :key="variant.id"
          class="variant-media-tab"
          :class="{ 'is-selected': selectedVariant?.id === variant.id }"
          type="button"
          role="tab"
          :aria-selected="selectedVariant?.id === variant.id"
          @click="selectVariant(variant)"
        >
          <img
            v-if="imageForVariant(variant)"
            :src="imageForVariant(variant)?.src"
            :alt="imageForVariant(variant)?.alt || variant.title || ''"
          />
          <span v-else class="variant-media-tab-placeholder">
            <ImageIcon aria-hidden="true" />
          </span>
          <span class="variant-media-tab-copy">
            <strong>{{ variant.title || t("product.defaultVariant") }}</strong>
            <small>{{ variant.sku || t("product.noSku") }}</small>
          </span>
          <span
            class="variant-media-assignment-state"
            :class="{ assigned: imageForVariant(variant) }"
          >
            {{
              imageForVariant(variant)
                ? t("product.variantHasImage")
                : t("product.variantNoImage")
            }}
          </span>
        </button>
      </div>

      <div v-if="selectedVariant" class="variant-media-detail" role="tabpanel">
        <div class="variant-media-detail-heading">
          <div>
            <span>{{ t("product.selectedVariant") }}</span>
            <strong>{{ selectedVariant.title || t("product.defaultVariant") }}</strong>
          </div>
          <span>{{ selectedVariant.sku || t("product.noSku") }}</span>
        </div>

        <div class="variant-media-focus">
          <figure v-if="selectedVariantImage">
            <img
              :src="selectedVariantImage.src"
              :alt="
                selectedVariantImage.alt ||
                selectedVariant.title ||
                t('product.productImage')
              "
            />
            <figcaption>
              <strong>{{ t("product.assignedImage") }}</strong>
              <span>{{
                selectedVariantImage.alt || t("product.mediaWithoutAlt")
              }}</span>
              <a
                v-if="imageSourceUrl(selectedVariantImage)"
                :href="imageSourceUrl(selectedVariantImage) || undefined"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ t("product.openSourceImage") }}
                <ExternalLink aria-hidden="true" />
              </a>
            </figcaption>
          </figure>
          <div v-else class="variant-media-empty">
            <ImageIcon aria-hidden="true" />
            <strong>{{ t("product.noAssignedImage") }}</strong>
            <span>{{ t("product.noAssignedImageHint") }}</span>
          </div>

          <dl class="variant-media-facts">
            <div>
              <dt>{{ t("product.selectedVariant") }}</dt>
              <dd>{{ selectedVariant.title || t("product.defaultVariant") }}</dd>
            </div>
            <div>
              <dt>{{ t("product.price") }}</dt>
              <dd>{{ formatVariantPrice(selectedVariant) }}</dd>
            </div>
            <div>
              <dt>{{ t("product.inventory") }}</dt>
              <dd>{{ formatVariantInventory(selectedVariant) }}</dd>
            </div>
            <div>
              <dt>{{ t("product.inventoryItem") }}</dt>
              <dd>{{ selectedVariant.inventory_item_id || "-" }}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
    <div v-else class="detail-empty">{{ t("product.noVariants") }}</div>

    <div v-if="productImages.length" class="product-image-map">
      <div class="product-image-map-heading">
        <strong>{{ t("product.productImages") }}</strong>
        <span>{{ t("product.imageCount", { count: productImages.length }) }}</span>
      </div>
      <div class="product-image-map-grid">
        <article
          v-for="(image, index) in productImages"
          :key="imageKey(image, index)"
          :class="{ 'is-selected-assignment': isSelectedVariantImage(image) }"
        >
          <img :src="image.src" :alt="image.alt || t('product.productImage')" />
          <div>
            <strong>{{ image.alt || t("product.mediaWithoutAlt") }}</strong>
            <span v-if="variantsForImage(image).length">
              {{
                t("product.usedByVariantCount", {
                  count: variantsForImage(image).length,
                })
              }}
            </span>
            <span v-else>{{ t("product.sharedProductImage") }}</span>
            <small v-if="variantsForImage(image).length">
              {{
                variantsForImage(image)
                  .map((variant) => variant.title || t("product.defaultVariant"))
                  .join(" · ")
              }}
            </small>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.variant-media-overview {
  display: grid;
  gap: 12px;
}

.variant-media-heading,
.product-image-map-heading,
.variant-media-detail-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.variant-media-heading p {
  margin: -4px 0 0;
  color: var(--text-sub);
  font-size: 11px;
}

.variant-media-heading > span,
.product-image-map-heading > span {
  flex: 0 0 auto;
  color: var(--text-muted);
  font-size: 11px;
}

.variant-media-layout {
  min-height: 280px;
  display: grid;
  grid-template-columns: minmax(240px, 0.8fr) minmax(0, 1.5fr);
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--surface-raised);
}

.variant-media-list {
  max-height: 420px;
  overflow-y: auto;
  border-inline-end: 1px solid var(--border);
  padding: 7px;
  background: var(--surface-soft);
}

.variant-media-tab {
  width: 100%;
  min-width: 0;
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  border: 1px solid transparent;
  border-radius: 7px;
  padding: 7px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  text-align: start;
}

.variant-media-tab:hover {
  background: var(--surface-raised);
}

.variant-media-tab.is-selected {
  border-color: color-mix(in srgb, var(--green) 40%, var(--border));
  background: var(--surface-raised);
  box-shadow: 0 1px 3px color-mix(in srgb, var(--text) 8%, transparent);
}

.variant-media-tab > img,
.variant-media-tab-placeholder {
  width: 40px;
  height: 40px;
  border: 1px solid var(--border);
  border-radius: 6px;
}

.variant-media-tab > img {
  object-fit: cover;
}

.variant-media-tab-placeholder {
  display: grid;
  place-items: center;
  background: var(--surface-soft);
  color: var(--text-muted);
}

.variant-media-tab-placeholder svg {
  width: 17px;
  height: 17px;
}

.variant-media-tab-copy {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.variant-media-tab-copy strong,
.variant-media-tab-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.variant-media-tab-copy strong {
  font-size: 12px;
}

.variant-media-tab-copy small {
  color: var(--text-muted);
  font-size: 10px;
}

.variant-media-assignment-state {
  padding: 2px 6px;
  border-radius: 999px;
  background: var(--amber-soft);
  color: var(--amber);
  font-size: 9px;
  font-weight: 700;
  white-space: nowrap;
}

.variant-media-assignment-state.assigned {
  background: var(--green-soft);
  color: var(--green);
}

.variant-media-detail {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: 12px;
  padding: 14px;
}

.variant-media-detail-heading > div {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.variant-media-detail-heading span {
  color: var(--text-muted);
  font-size: 10px;
}

.variant-media-detail-heading strong {
  overflow-wrap: anywhere;
  font-size: 14px;
}

.variant-media-focus {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) minmax(170px, 0.75fr);
  gap: 12px;
}

.variant-media-focus figure,
.variant-media-empty {
  min-height: 220px;
  overflow: hidden;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-soft);
}

.variant-media-focus figure img {
  width: 100%;
  height: 180px;
  object-fit: contain;
}

.variant-media-focus figcaption {
  display: grid;
  gap: 2px;
  border-top: 1px solid var(--border);
  padding: 8px 10px;
  background: var(--surface-raised);
}

.variant-media-focus figcaption strong {
  color: var(--green);
  font-size: 10px;
  text-transform: uppercase;
}

.variant-media-focus figcaption span {
  overflow: hidden;
  color: var(--text-sub);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.variant-media-focus figcaption a {
  width: fit-content;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 3px;
  color: var(--text-link);
  font-size: 10px;
  font-weight: 600;
  text-decoration: none;
}

.variant-media-focus figcaption a:hover {
  text-decoration: underline;
}

.variant-media-focus figcaption a svg {
  width: 12px;
  height: 12px;
}

.variant-media-empty {
  place-items: center;
  align-content: center;
  grid-template-rows: auto;
  gap: 7px;
  padding: 24px;
  color: var(--text-sub);
  text-align: center;
}

.variant-media-empty svg {
  width: 30px;
  height: 30px;
  color: var(--text-muted);
}

.variant-media-empty strong {
  color: var(--text);
  font-size: 12px;
}

.variant-media-empty span {
  max-width: 260px;
  font-size: 10px;
}

.variant-media-facts {
  display: grid;
  align-content: start;
  gap: 8px;
  margin: 0;
}

.variant-media-facts > div {
  display: grid;
  gap: 3px;
  border-bottom: 1px solid var(--border);
  padding: 8px 0;
}

.variant-media-facts dt {
  color: var(--text-muted);
  font-size: 10px;
}

.variant-media-facts dd {
  margin: 0;
  color: var(--text);
  font-size: 12px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.product-image-map {
  display: grid;
  gap: 8px;
  border-top: 1px solid var(--border);
  padding-top: 12px;
}

.product-image-map-heading strong {
  font-size: 12px;
}

.product-image-map-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr));
  gap: 8px;
}

.product-image-map-grid article {
  min-width: 0;
  overflow: hidden;
  display: grid;
  grid-template-columns: 62px minmax(0, 1fr);
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--surface-raised);
}

.product-image-map-grid article.is-selected-assignment {
  border-color: var(--green);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--green) 14%, transparent);
}

.product-image-map-grid img {
  width: 62px;
  height: 72px;
  object-fit: cover;
  background: var(--surface-soft);
}

.product-image-map-grid article > div {
  min-width: 0;
  display: grid;
  align-content: center;
  gap: 2px;
  padding: 7px;
}

.product-image-map-grid strong,
.product-image-map-grid span,
.product-image-map-grid small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-image-map-grid strong {
  font-size: 10px;
}

.product-image-map-grid span {
  color: var(--green);
  font-size: 9px;
  font-weight: 700;
}

.product-image-map-grid small {
  color: var(--text-muted);
  font-size: 9px;
}

@media (max-width: 760px) {
  .variant-media-layout,
  .variant-media-focus {
    grid-template-columns: 1fr;
  }

  .variant-media-list {
    max-height: 260px;
    border-inline-end: 0;
    border-bottom: 1px solid var(--border);
  }

  .variant-media-assignment-state {
    display: none;
  }

  .variant-media-tab {
    grid-template-columns: 40px minmax(0, 1fr);
  }
}
</style>
