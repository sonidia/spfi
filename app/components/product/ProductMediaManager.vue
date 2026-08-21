<script setup lang="ts">
import { Box, ExternalLink, Film, ImagePlus, RefreshCw } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import type {
  ProductMediaContentType,
  ProductMediaResponse,
  ProductMediaSummary,
} from "~~/types/shopify-product";
import { getSafeExternalUrl } from "~~/utils/safe-url";
import type { ShopifyNumericId } from "~~/types/shopify";

const props = withDefaults(
  defineProps<{
    productId: ShopifyNumericId;
    readOnly?: boolean;
    title?: string;
    description?: string;
  }>(),
  { readOnly: false, title: "", description: "" },
);
const emit = defineEmits<{ refreshed: [] }>();
const { storeId, token } = useActiveShopAuth();
const { t } = useLocalization();
const feedback = useStoreFeedback();
const items = ref<ProductMediaSummary[]>([]);
const truncated = ref(false);
const isLoading = ref(false);
const error = ref("");
const form = ref({
  type: "IMAGE" as ProductMediaContentType,
  originalSource: "",
  alt: "",
});
const typeOptions = computed(() => [
  { label: t("product.mediaTypeImage"), value: "IMAGE" },
  { label: t("product.mediaTypeExternalVideo"), value: "EXTERNAL_VIDEO" },
  { label: t("product.mediaTypeVideo"), value: "VIDEO" },
  { label: t("product.mediaTypeModel"), value: "MODEL_3D" },
]);
const visibleTitle = computed(() => props.title || t("product.media"));
const visibleDescription = computed(
  () =>
    props.description ||
    (props.readOnly
      ? t("product.mediaReadOnlyDescription")
      : t("product.mediaDescription")),
);

watch(
  () => props.productId,
  () => void load(),
  { immediate: true },
);

async function load() {
  if (!storeId.value || !token.value || !props.productId) return;
  isLoading.value = true;
  error.value = "";
  try {
    const response = await $fetch<ProductMediaResponse>("/api/product/media/all", {
      method: "POST",
      body: {
        storeId: storeId.value,
        token: token.value,
        productId: props.productId,
      },
    });
    items.value = response.items;
    truncated.value = response.truncated;
  } catch (requestError) {
    error.value = getErrorMessage(requestError, t("product.mediaLoadFailed"));
  } finally {
    isLoading.value = false;
  }
}

async function create() {
  const source = form.value.originalSource.trim();
  if (!/^https:\/\//i.test(source)) {
    feedback.error(t("product.mediaHttpsRequired"));
    return;
  }
  isLoading.value = true;
  error.value = "";
  try {
    await $fetch("/api/product/media/create", {
      method: "POST",
      body: {
        storeId: storeId.value,
        token: token.value,
        productId: props.productId,
        input: {
          type: form.value.type,
          originalSource: source,
          alt: form.value.alt.trim(),
        },
      },
    });
    form.value.originalSource = "";
    form.value.alt = "";
    feedback.success(t("product.mediaAddedProcessing"));
    await load();
    emit("refreshed");
  } catch (requestError) {
    error.value = getErrorMessage(requestError, t("product.mediaCreateFailed"));
  } finally {
    isLoading.value = false;
  }
}

function mediaUrl(item: ProductMediaSummary) {
  return getSafeExternalUrl(item.originalUrl || "");
}

function getErrorMessage(value: unknown, fallback: string) {
  if (value && typeof value === "object") {
    const row = value as {
      data?: { error?: { message?: unknown } };
      message?: unknown;
    };
    const message = row.data?.error?.message || row.message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}
</script>

<template>
  <section class="product-media-manager detail-section">
    <div class="product-media-heading">
      <div>
        <div class="detail-section-title">{{ visibleTitle }}</div>
        <p>{{ visibleDescription }}</p>
      </div>
      <BaseButton
        icon-only
        size="medium"
        variant="ghost"
        :aria-label="t('product.refreshMedia')"
        :loading="isLoading"
        @click="load"
      >
        <template #icon><RefreshCw /></template>
      </BaseButton>
    </div>

    <form v-if="!readOnly" class="product-media-create" @submit.prevent="create">
      <label>
        <span>{{ t("product.mediaType") }}</span>
        <BaseSelect
          class-name="product-media-select"
          :model-value="form.type"
          :options="typeOptions"
          @update:model-value="form.type = String($event) as ProductMediaContentType"
        />
      </label>
      <label>
        <span>{{ t("product.mediaSource") }}</span>
        <input
          v-model="form.originalSource"
          type="url"
          required
          placeholder="https://..."
        />
      </label>
      <label>
        <span>{{ t("product.altText") }}</span>
        <input v-model="form.alt" maxlength="512" />
      </label>
      <BaseButton type="submit" variant="primary" size="medium" :loading="isLoading">
        <template #icon><ImagePlus /></template>{{ t("product.addMedia") }}
      </BaseButton>
    </form>

    <p v-if="error" class="product-media-error" role="alert">{{ error }}</p>
    <p v-if="truncated" class="product-media-warning">
      {{ t("product.mediaTruncated") }}
    </p>
    <div v-if="!items.length && !isLoading" class="product-media-empty">
      {{ t("product.noMedia") }}
    </div>
    <div v-else class="product-media-grid">
      <article v-for="item in items" :key="item.id">
        <div class="product-media-preview">
          <img
            v-if="item.previewUrl"
            :src="item.previewUrl"
            :alt="item.alt || t('product.mediaPreview')"
          />
          <Film v-else-if="item.type.includes('VIDEO')" aria-hidden="true" />
          <Box v-else aria-hidden="true" />
          <span>{{ item.type.replaceAll("_", " ") }}</span>
        </div>
        <div class="product-media-copy">
          <small>{{ item.status }}</small>
          <a
            v-if="mediaUrl(item)"
            :href="mediaUrl(item) || undefined"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ t("product.openMedia") }} <ExternalLink aria-hidden="true" />
          </a>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.product-media-manager {
  min-width: 0;
  display: grid;
  gap: 12px;
}
.product-media-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.product-media-heading p {
  margin: 3px 0 0;
  color: var(--text-sub);
  font-size: 11px;
}
.product-media-create {
  display: grid;
  grid-template-columns:
    minmax(140px, 0.8fr) minmax(220px, 2fr) minmax(160px, 1fr)
    auto;
  gap: 8px;
  align-items: end;
}
.product-media-create label {
  min-width: 0;
  display: grid;
  gap: 4px;
}
.product-media-create label > span {
  color: var(--text-sub);
  font-size: 10px;
  font-weight: 600;
}
.product-media-create input {
  width: 100%;
  min-width: 0;
  min-height: var(--control-height-md);
  padding: 7px 9px;
  border: 1px solid var(--border);
  border-radius: var(--control-radius);
  background: var(--surface-raised);
  color: var(--text);
  font: inherit;
  font-size: 12px;
}
.product-media-select :deep(.select-trigger) {
  width: 100%;
  min-height: var(--control-height-md);
}
.product-media-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  gap: 9px;
}
.product-media-grid article {
  min-width: 0;
  overflow: hidden;
  display: grid;
  grid-template-rows: 128px auto;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-raised);
}
.product-media-preview {
  position: relative;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: var(--surface-soft);
  color: var(--text-muted);
}
.product-media-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.product-media-preview > svg {
  width: 28px;
  height: 28px;
}
.product-media-preview > span {
  position: absolute;
  right: 7px;
  bottom: 7px;
  padding: 3px 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface) 88%, transparent);
  color: var(--text);
  font-size: 9px;
  font-weight: 700;
}
.product-media-copy {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px;
}
.product-media-copy strong {
  overflow: hidden;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.product-media-copy small {
  color: var(--text-muted);
  font-size: 10px;
}
.product-media-copy a {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--text-link);
  font-size: 11px;
  text-decoration: none;
}
.product-media-copy a svg {
  width: 11px;
  height: 11px;
}
.product-media-error,
.product-media-warning,
.product-media-empty {
  margin: 0;
  padding: 9px 11px;
  border-radius: 7px;
  font-size: 11px;
}
.product-media-error {
  background: var(--red-soft);
  color: var(--red);
}
.product-media-warning {
  background: var(--amber-soft);
  color: var(--text);
}
.product-media-empty {
  border: 1px dashed var(--border);
  color: var(--text-sub);
  text-align: center;
}
@media (max-width: 760px) {
  .product-media-create {
    grid-template-columns: 1fr;
  }
}
</style>
