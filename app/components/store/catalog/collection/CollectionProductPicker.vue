<script setup lang="ts">
import { LoaderCircle, Search } from "@lucide/vue";
import { computed, onMounted, ref } from "vue";
import type { ShopifyProduct } from "~~/types/shopify";
import type { ProductPageResponse } from "~~/types/shopify-product";
import { getAppErrorMessage } from "~~/utils/error";

const props = defineProps<{
  modelValue: string[];
  storeId: string;
  token: string;
  disabled?: boolean;
}>();
const emit = defineEmits<{ "update:modelValue": [value: string[]] }>();
const { t } = useLocalization();
const search = ref("");
const products = ref<ShopifyProduct[]>([]);
const nextCursor = ref<string | null>(null);
const isLoading = ref(false);
const error = ref("");
const selected = computed(() => new Set(props.modelValue));

onMounted(() => void loadProducts(false));

async function loadProducts(append: boolean) {
  if (!props.storeId || !props.token || isLoading.value) return;
  if (!append) nextCursor.value = null;
  isLoading.value = true;
  error.value = "";
  try {
    const response = await $fetch<ProductPageResponse>("/api/product/page", {
      method: "POST",
      body: {
        storeId: props.storeId,
        token: props.token,
        query: {
          limit: 20,
          title: search.value.trim(),
          sort_key: "TITLE",
          page_info: append ? nextCursor.value || undefined : undefined,
        },
      },
    });
    products.value = append
      ? mergeProducts(products.value, response.products)
      : response.products;
    nextCursor.value = response.pageInfo.nextCursor;
  } catch (cause) {
    error.value = getAppErrorMessage(cause, t("collection.productSearchFailed"));
  } finally {
    isLoading.value = false;
  }
}

function mergeProducts(current: ShopifyProduct[], incoming: ShopifyProduct[]) {
  const knownIds = new Set(current.map((product) => String(product.id)));
  return [
    ...current,
    ...incoming.filter((product) => !knownIds.has(String(product.id))),
  ];
}

function toggleProduct(product: ShopifyProduct) {
  if (props.disabled) return;
  const id = product.admin_graphql_api_id || `gid://shopify/Product/${product.id}`;
  const next = new Set(props.modelValue);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  emit("update:modelValue", [...next]);
}
</script>

<template>
  <div class="collection-product-picker">
    <form class="picker-search" @submit.prevent="loadProducts(false)">
      <BaseTextField
        v-model="search"
        type="search"
        :disabled="disabled"
        :placeholder="t('collection.productSearchPlaceholder')"
      />
      <BaseButton type="submit" size="medium" :disabled="disabled || isLoading">
        <template #icon>
          <LoaderCircle v-if="isLoading" class="spin" aria-hidden="true" />
          <Search v-else aria-hidden="true" />
        </template>
        {{ t("common.search") }}
      </BaseButton>
    </form>
    <p v-if="error" class="picker-error" role="alert">{{ error }}</p>
    <div v-else-if="products.length" class="picker-results">
      <div v-for="product in products" :key="String(product.id)" class="picker-result">
        <BaseCheckbox
          compact
          :disabled="disabled"
          :model-value="
            selected.has(
              product.admin_graphql_api_id ||
                `gid://shopify/Product/${String(product.id)}`,
            )
          "
          :aria-label="product.title"
          @change="toggleProduct(product)"
        />
        <img v-if="product.image?.src" :src="product.image.src" alt="" />
        <span v-else class="picker-placeholder" aria-hidden="true" />
        <span>
          <strong>{{ product.title }}</strong>
          <small>{{ product.id }}</small>
        </span>
      </div>
      <div v-if="nextCursor" class="picker-load-more">
        <BaseButton
          :loading="isLoading"
          :disabled="disabled"
          @click="loadProducts(true)"
        >
          {{ t("collection.loadMoreProducts") }}
        </BaseButton>
      </div>
    </div>
    <p v-else-if="!isLoading" class="picker-empty">
      {{ t("collection.noProductsFound") }}
    </p>
    <p class="picker-selection-count">
      {{ t("collection.productsSelected", { count: modelValue.length }) }}
    </p>
  </div>
</template>

<style scoped>
.collection-product-picker {
  display: grid;
  gap: 10px;
}

.picker-search {
  display: flex;
  gap: 8px;
}

.picker-search > :first-child {
  flex: 1;
  min-width: 0;
}

.picker-results {
  max-height: 260px;
  display: grid;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 9px;
}

.picker-result {
  min-width: 0;
  display: grid;
  grid-template-columns: auto 38px minmax(0, 1fr);
  align-items: center;
  gap: 9px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
}

.picker-result:last-of-type {
  border-bottom: 0;
}

.picker-results img,
.picker-placeholder {
  width: 38px;
  height: 38px;
  border-radius: 6px;
  object-fit: cover;
  background: var(--surface-soft);
}

.picker-results span:last-child {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.picker-results strong,
.picker-results small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.picker-load-more {
  display: flex;
  justify-content: center;
  padding: 9px;
  border-top: 1px solid var(--border);
}

.picker-results small,
.picker-selection-count,
.picker-empty {
  color: var(--text-muted);
  font-size: 11px;
}

.picker-error {
  color: var(--red);
  font-size: 12px;
}

.spin {
  animation: picker-spin 0.8s linear infinite;
}

@keyframes picker-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
