<template>
  <div class="products-tab">
    <div class="products-manager">
      <!-- Loading state -->
      <div v-if="productStore.isLoading && !products.length" id="loading">
        {{ t("product.loadingProducts") }}
      </div>
      <div v-else-if="productStore.error" id="loading" class="error-state" role="alert">
        {{ productStore.error }}
      </div>

      <!-- ════════════════════════════════════════ SCREEN: LIST -->
      <div v-else>
        <div class="page-meta-header">
          <div class="page-meta">
            {{
              t("product.showingProductCount", {
                shown: products.length,
                total: productStore.totalCount,
              })
            }}
          </div>
          <div class="page-meta-actions">
            <CsvExportButton resource="products" />
            <button class="btn-primary-sm" @click="showCreateModal = true">
              <Plus :size="14" aria-hidden="true" />
              {{ t("product.addProduct") }}
            </button>
          </div>
        </div>

        <form class="product-filters" @submit.prevent="applyProductFilters">
          <input
            v-model="filterForm.title"
            class="inp"
            :placeholder="t('product.searchPlaceholder')"
          />
          <select v-model="filterForm.status" class="inp">
            <option value="">{{ t("product.filterStatusAny") }}</option>
            <option value="active">{{ t("product.statusActive") }}</option>
            <option value="draft">{{ t("product.statusDraft") }}</option>
            <option value="archived">{{ t("product.statusArchived") }}</option>
          </select>
          <select v-model="filterForm.published_status" class="inp">
            <option value="">{{ t("product.filterPublishedAny") }}</option>
            <option value="published">{{ t("product.filterPublished") }}</option>
            <option value="unpublished">{{ t("product.filterUnpublished") }}</option>
          </select>
          <input
            v-model="filterForm.vendor"
            class="inp"
            :placeholder="t('product.filterVendorPlaceholder')"
          />
          <input
            v-model="filterForm.product_type"
            class="inp"
            :placeholder="t('product.filterTypePlaceholder')"
          />
          <button class="btn-primary-sm" type="submit">
            {{ t("product.search") }}
          </button>
          <button class="btn-outline filter-reset" type="button" @click="resetFilters">
            {{ t("product.resetFilters") }}
          </button>
        </form>

        <div
          v-if="selectedProductCount"
          class="bulk-toolbar"
          role="region"
          :aria-label="t('product.bulkActions')"
        >
          <strong>
            {{ t("product.bulkSelected", { count: selectedProductCount }) }}
          </strong>
          <div class="bulk-toolbar-actions">
            <button
              class="btn-ghost-sm"
              type="button"
              :disabled="isBulkUpdating"
              @click="runBulkPublication(true)"
            >
              <Eye aria-hidden="true" />
              {{
                isBulkUpdating ? t("product.bulkUpdating") : t("product.bulkPublish")
              }}
            </button>
            <button
              class="btn-ghost-sm"
              type="button"
              :disabled="isBulkUpdating"
              @click="runBulkPublication(false)"
            >
              <EyeOff aria-hidden="true" />
              {{
                isBulkUpdating ? t("product.bulkUpdating") : t("product.bulkUnpublish")
              }}
            </button>
            <button
              class="btn-ghost-sm"
              type="button"
              :disabled="isBulkUpdating"
              @click="clearBulkSelection"
            >
              <X aria-hidden="true" />
              {{ t("common.clear") }}
            </button>
          </div>
        </div>

        <div class="product-workspace">
          <div
            ref="productList"
            class="card table-card"
            @scroll="updateProductViewport"
          >
            <table class="products-table">
              <thead>
                <tr>
                  <th class="selection-column">
                    <input
                      ref="selectAllCheckbox"
                      type="checkbox"
                      :checked="allProductsSelected"
                      :aria-label="t('product.selectAll')"
                      @change="toggleAllProducts"
                    />
                  </th>
                  <th>{{ t("product.columnProduct") }}</th>
                  <th>{{ t("product.columnStatus") }}</th>
                  <th>{{ t("product.columnVariants") }}</th>
                  <th>{{ t("product.price") }}</th>
                  <th>{{ t("product.columnUpdated") }}</th>
                  <th style="text-align: right">{{ t("product.columnActions") }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="productPaddingTop" class="virtual-spacer" aria-hidden="true">
                  <td :style="{ height: `${productPaddingTop}px` }" colspan="7" />
                </tr>
                <tr
                  v-for="{ item: prod, index } in visibleProducts"
                  :key="prod.id || index"
                  class="product-row"
                  :class="{
                    selected: selectedProduct?.id === prod.id,
                    'is-bulk-selected': isProductBulkSelected(prod),
                  }"
                  @click="selectProduct(prod)"
                >
                  <td class="selection-column" @click.stop>
                    <input
                      type="checkbox"
                      :checked="isProductBulkSelected(prod)"
                      :aria-label="
                        t('product.selectProduct', {
                          title: prod.title || String(prod.id),
                        })
                      "
                      @change="toggleProductSelection(prod)"
                    />
                  </td>
                  <td>
                    <div class="product-info-cell">
                      <img
                        v-if="prod.image"
                        :src="prod.image.src"
                        class="product-thumb"
                        :alt="t('product.productImage')"
                      />
                      <div v-else class="product-thumb empty-thumb">
                        {{ t("product.noImage") }}
                      </div>
                      <div class="product-main-details">
                        <div class="product-title-text">{{ prod.title }}</div>
                        <div class="product-id-sub">
                          {{ t("product.productId", { id: prod.id }) }}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div class="product-status-cell">
                      <span
                        v-if="prod.status"
                        class="badge"
                        :aria-label="
                          t('a11y.statusLabel', {
                            status: formatProductStatus(prod.status),
                          })
                        "
                        :class="
                          prod.status === 'active' ? 'badge-paid' : 'badge-pending'
                        "
                      >
                        {{ formatProductStatus(prod.status) }}
                      </span>
                      <span
                        class="publication-state"
                        :class="{ published: isProductPublished(prod) }"
                      >
                        {{
                          isProductPublished(prod)
                            ? t("product.published")
                            : t("product.unpublished")
                        }}
                      </span>
                    </div>
                  </td>
                  <td>
                    {{ prod.variants_count ?? prod.variants?.length ?? 0 }}
                  </td>
                  <td>{{ formatProductPrice(prod) }}</td>
                  <td>
                    {{ formatProductDate(prod.updated_at) }}
                  </td>
                  <td style="text-align: right">
                    <div class="product-actions-cell" style="justify-content: flex-end">
                      <BasePopover align="right">
                        <template #trigger="{ isOpen, triggerProps }">
                          <button
                            v-bind="triggerProps"
                            class="btn-ghost-sm btn-icon"
                            :class="{ 'is-active': isOpen }"
                            type="button"
                            :aria-label="t('product.moreActions')"
                          >
                            <IconsMore />
                          </button>
                        </template>
                        <template #default="{ close }">
                          <div class="popover-menu popover-actions">
                            <button
                              role="menuitem"
                              class="popover-item"
                              @click.stop="
                                openDetailModal(prod);
                                close();
                              "
                            >
                              <Eye aria-hidden="true" />
                              {{ t("product.details") }}
                            </button>
                            <button
                              role="menuitem"
                              class="popover-item"
                              @click.stop="
                                openEditModal(prod);
                                close();
                              "
                            >
                              <Pencil aria-hidden="true" />
                              {{ t("common.edit") }}
                            </button>
                            <button
                              role="menuitem"
                              class="popover-item"
                              :disabled="publishingProductId === prod.id"
                              @click.stop="
                                toggleProductPublication(prod);
                                close();
                              "
                            >
                              <EyeOff
                                v-if="isProductPublished(prod)"
                                aria-hidden="true"
                              />
                              <Eye v-else aria-hidden="true" />
                              {{
                                publishingProductId === prod.id
                                  ? t("product.publicationSaving")
                                  : isProductPublished(prod)
                                    ? t("product.unpublish")
                                    : t("product.publish")
                              }}
                            </button>
                            <button
                              role="menuitem"
                              class="popover-item text-danger"
                              @click.stop="
                                removeProduct(prod.id);
                                close();
                              "
                            >
                              <Trash2 aria-hidden="true" />
                              {{ t("common.delete") }}
                            </button>
                          </div>
                        </template>
                      </BasePopover>
                    </div>
                  </td>
                </tr>
                <tr
                  v-if="productPaddingBottom"
                  class="virtual-spacer"
                  aria-hidden="true"
                >
                  <td :style="{ height: `${productPaddingBottom}px` }" colspan="7" />
                </tr>
              </tbody>
            </table>
            <div v-if="products.length === 0" class="empty-state">
              {{ t("product.empty") }}
            </div>
          </div>
          <div v-if="productStore.nextCursor" class="load-more-row">
            <button
              class="btn-outline"
              type="button"
              :disabled="productStore.isLoadingMore"
              @click="loadMoreProducts"
            >
              {{ t("product.loadMore") }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <ProductDetailModal
      v-if="detailProduct"
      :product="detailProduct"
      @close="detailProductId = null"
      @refreshed="refreshProductDetail"
    />

    <!-- Create Modal -->
    <div
      v-if="showCreateModal"
      class="modal-backdrop"
      @click.self="showCreateModal = false"
    >
      <div class="modal-card">
        <div class="modal-head">
          <h3 class="modal-title">{{ t("product.createTitle") }}</h3>
          <button
            class="btn-close"
            type="button"
            :aria-label="t('common.close')"
            @click="showCreateModal = false"
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <div class="modal-body">
          <div class="field">
            <label class="field-label"
              >{{ t("product.fieldTitle") }}
              <span class="required-marker" aria-hidden="true">*</span>
              <span class="sr-only">{{ t("a11y.required") }}</span></label
            >
            <input
              v-model="newProduct.title"
              type="text"
              class="inp"
              :placeholder="t('product.titlePlaceholder')"
            />
          </div>
          <div class="field-row">
            <div class="field">
              <label class="field-label">{{ t("product.handle") }}</label>
              <input v-model="newProduct.handle" type="text" class="inp" />
            </div>
            <div class="field">
              <label class="field-label">{{ t("product.templateSuffix") }}</label>
              <input v-model="newProduct.template_suffix" type="text" class="inp" />
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label class="field-label">{{ t("product.columnStatus") }}</label>
              <select v-model="newProduct.status" class="inp">
                <option value="active">{{ t("product.statusActive") }}</option>
                <option value="draft">{{ t("product.statusDraft") }}</option>
                <option value="archived">{{ t("product.statusArchived") }}</option>
              </select>
            </div>
            <label class="field checkbox-field">
              <input
                v-model="newProduct.published"
                type="checkbox"
                :disabled="newProduct.status !== 'active'"
              />
              {{ t("product.publishedToOnlineStore") }}
            </label>
          </div>
          <div class="field-row">
            <div class="field">
              <label class="field-label">{{ t("product.vendor") }}</label>
              <input
                v-model="newProduct.vendor"
                type="text"
                class="inp"
                :placeholder="t('product.vendorPlaceholder')"
              />
            </div>
            <div class="field">
              <label class="field-label">{{ t("product.productType") }}</label>
              <input
                v-model="newProduct.product_type"
                type="text"
                class="inp"
                :placeholder="t('product.typePlaceholder')"
              />
            </div>
          </div>
          <div class="field">
            <label class="field-label">{{ t("product.tags") }}</label>
            <input
              v-model="newProduct.tags"
              type="text"
              class="inp"
              :placeholder="t('product.tagsPlaceholder')"
            />
          </div>
          <div class="field">
            <label class="field-label">{{ t("product.descriptionHtml") }}</label>
            <textarea
              v-model="newProduct.body_html"
              class="inp"
              rows="4"
              :placeholder="t('product.descriptionPlaceholder')"
            ></textarea>
          </div>
          <div class="field-row">
            <div class="field">
              <label class="field-label">{{ t("product.defaultPrice") }}</label>
              <input
                v-model="newProductDefaultPrice"
                type="number"
                min="0"
                step="0.01"
                class="inp"
              />
            </div>
            <div class="field">
              <label class="field-label">{{ t("product.initialImageUrl") }}</label>
              <input v-model="newProductImageUrl" type="url" class="inp" />
            </div>
          </div>
          <div class="field option-editor">
            <div class="option-editor-head">
              <label class="field-label">{{ t("product.optionDefinitions") }}</label>
              <button
                class="btn-ghost-sm"
                type="button"
                :disabled="newProductOptions.length >= 3"
                @click="addProductOption"
              >
                <Plus aria-hidden="true" />{{ t("product.addOption") }}
              </button>
            </div>
            <div
              v-for="(option, index) in newProductOptions"
              :key="index"
              class="option-row"
            >
              <input
                v-model="option.name"
                class="inp"
                :placeholder="t('product.optionName')"
              />
              <input
                v-model="option.values"
                class="inp"
                :placeholder="t('product.optionValues')"
              />
              <button
                class="btn-ghost-sm text-danger"
                type="button"
                :aria-label="t('product.removeOption')"
                @click="removeProductOption(index)"
              >
                <Trash2 aria-hidden="true" />
              </button>
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label class="field-label">{{ t("product.seoTitle") }}</label>
              <input v-model="newProductSeo.title" class="inp" />
            </div>
            <div class="field">
              <label class="field-label">{{ t("product.seoDescription") }}</label>
              <input v-model="newProductSeo.description" class="inp" />
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-outline" @click="showCreateModal = false">
            <X aria-hidden="true" />
            {{ t("common.cancel") }}
          </button>
          <button
            class="btn-primary"
            @click="createProduct"
            :disabled="productStore.isLoading"
          >
            <Plus aria-hidden="true" />
            {{
              productStore.isLoading ? t("product.creating") : t("product.createTitle")
            }}
          </button>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <div
      v-if="showEditModal"
      class="modal-backdrop"
      @click.self="showEditModal = false"
    >
      <div class="modal-card">
        <div class="modal-head">
          <h3 class="modal-title">{{ t("product.editTitle") }}</h3>
          <button
            class="btn-close"
            type="button"
            :aria-label="t('common.close')"
            @click="showEditModal = false"
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <div class="modal-body">
          <div class="field">
            <label class="field-label"
              >{{ t("product.fieldTitle") }}
              <span class="required-marker" aria-hidden="true">*</span></label
            >
            <input v-model="editProduct.title" type="text" class="inp" />
          </div>
          <div class="field-row">
            <div class="field">
              <label class="field-label">{{ t("product.columnStatus") }}</label>
              <select v-model="editProduct.status" class="inp">
                <option value="active">{{ t("product.statusActive") }}</option>
                <option value="draft">{{ t("product.statusDraft") }}</option>
                <option value="archived">{{ t("product.statusArchived") }}</option>
              </select>
            </div>
            <label class="field checkbox-field">
              <input
                v-model="editProduct.published"
                type="checkbox"
                :disabled="editProduct.status !== 'active'"
              />
              {{ t("product.publishedToOnlineStore") }}
            </label>
          </div>
          <div class="field-row">
            <div class="field">
              <label class="field-label">{{ t("product.handle") }}</label>
              <input v-model="editProduct.handle" type="text" class="inp" />
            </div>
            <div class="field">
              <label class="field-label">{{ t("product.templateSuffix") }}</label>
              <input v-model="editProduct.template_suffix" type="text" class="inp" />
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label class="field-label">{{ t("product.vendor") }}</label>
              <input v-model="editProduct.vendor" type="text" class="inp" />
            </div>
            <div class="field">
              <label class="field-label">{{ t("product.productType") }}</label>
              <input v-model="editProduct.product_type" type="text" class="inp" />
            </div>
          </div>
          <div class="field">
            <label class="field-label">{{ t("product.tags") }}</label>
            <input v-model="editProduct.tags" type="text" class="inp" />
          </div>
          <div class="field">
            <label class="field-label">{{ t("product.descriptionHtml") }}</label>
            <textarea v-model="editProduct.body_html" class="inp" rows="4"></textarea>
          </div>
          <div class="field-row">
            <div class="field">
              <label class="field-label">{{ t("product.seoTitle") }}</label>
              <input v-model="editProduct.seo_title" class="inp" />
            </div>
            <div class="field">
              <label class="field-label">{{ t("product.seoDescription") }}</label>
              <input v-model="editProduct.seo_description" class="inp" />
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-outline" @click="showEditModal = false">
            <X aria-hidden="true" />
            {{ t("common.cancel") }}
          </button>
          <button
            class="btn-primary"
            @click="saveEditProduct"
            :disabled="productStore.isLoading"
          >
            <Save aria-hidden="true" />
            {{
              productStore.isLoading ? t("product.saving") : t("product.saveChanges")
            }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Eye, EyeOff, Pencil, Plus, Save, Trash2, X } from "@lucide/vue";
import { computed, nextTick, ref, watch } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useStoreFeedback } from "~/composables/useStoreFeedback";
import { useFormStore } from "~/stores/form";
import { useProductStore } from "~/stores/product";
import type {
  MetafieldsResponse,
  ShopifyNumericId,
  ShopifyProduct,
  ShopifyProductInput,
  ShopifyProductStatus,
} from "~~/types/shopify";
import type { ProductListQuery } from "~~/types/shopify-product";
import {
  buildVariantsFromOptions,
  isValidProductPrice,
  normalizeProductOptions,
  type ProductOptionDraft,
} from "~~/utils/product-options";

const productStore = useProductStore();
const formStore = useFormStore();
const { token: activeToken } = useActiveShopAuth();
const feedback = useStoreFeedback();
const { t, locale } = useLocalization();
const { requestConfirmation } = useConfirmDialog();

const products = computed(() => productStore.products);
const {
  container: productList,
  paddingBottom: productPaddingBottom,
  paddingTop: productPaddingTop,
  updateViewport: updateProductViewport,
  visibleItems: visibleProducts,
} = useVirtualList(products, {
  itemHeight: 65,
  overscan: 6,
  defaultViewportHeight: 600,
});
const selectedProductId = ref<ShopifyNumericId | null>(null);
const selectedProductIds = ref<Set<string>>(new Set());
const selectAllCheckbox = ref<HTMLInputElement | null>(null);
const isBulkUpdating = ref(false);
const selectedProductCount = computed(() => selectedProductIds.value.size);
const allProductsSelected = computed(
  () =>
    products.value.length > 0 &&
    products.value.every((product) => selectedProductIds.value.has(String(product.id))),
);
const selectedProduct = computed(() => {
  return (
    products.value.find((product) => product.id === selectedProductId.value) || null
  );
});
const detailProductId = ref<ShopifyNumericId | null>(null);
const detailProductRecord = ref<ShopifyProduct | null>(null);
const detailProduct = computed(() =>
  detailProductId.value ? detailProductRecord.value : null,
);

// ── Local state for modals ──
const showCreateModal = ref(false);
const showEditModal = ref(false);
const publishingProductId = ref<ShopifyNumericId | null>(null);
const filterForm = ref({
  title: "",
  status: "" as "" | ShopifyProductStatus,
  published_status: "" as "" | "published" | "unpublished",
  vendor: "",
  product_type: "",
});

const newProduct = ref<ShopifyProductInput>({
  title: "",
  body_html: "",
  vendor: "",
  product_type: "",
  tags: "",
  status: "active",
  published: true,
  handle: "",
  template_suffix: null,
});
const newProductOptions = ref<ProductOptionDraft[]>([{ name: "", values: "" }]);
const newProductDefaultPrice = ref("0.00");
const newProductImageUrl = ref("");
const newProductSeo = ref({ title: "", description: "" });

const editProduct = ref({
  id: null as ShopifyNumericId | null,
  title: "",
  body_html: "",
  vendor: "",
  product_type: "",
  tags: "",
  status: "active" as ShopifyProductStatus,
  published: true,
  published_at: null as string | null,
  handle: "",
  template_suffix: "" as string | null,
  seo_title: "",
  seo_description: "",
  seo_title_id: null as ShopifyNumericId | null,
  seo_description_id: null as ShopifyNumericId | null,
});

// ── Actions ──
function selectProduct(prod: ShopifyProduct) {
  selectedProductId.value = prod.id;
}

function isProductBulkSelected(prod: ShopifyProduct) {
  return selectedProductIds.value.has(String(prod.id));
}

function toggleProductSelection(prod: ShopifyProduct) {
  const next = new Set(selectedProductIds.value);
  const id = String(prod.id);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  selectedProductIds.value = next;
}

function toggleAllProducts() {
  selectedProductIds.value = allProductsSelected.value
    ? new Set()
    : new Set(products.value.map((product) => String(product.id)));
}

function clearBulkSelection() {
  selectedProductIds.value = new Set();
}

async function runBulkPublication(publish: boolean) {
  const sid = formStore.storeId;
  const token = activeToken.value;
  if (!sid || !token) {
    feedback.error(t("product.credentialsMissing"));
    return;
  }

  const selected = products.value
    .filter((product) => selectedProductIds.value.has(String(product.id)))
    .map((product) => product.id);
  if (!selected.length) return;

  isBulkUpdating.value = true;
  try {
    const result = await productStore.setProductsPublished(
      sid,
      token,
      selected,
      publish,
    );
    selectedProductIds.value = new Set(result.failedIds.map(String));

    if (result.failedIds.length) {
      feedback.error(
        t("product.bulkPublicationPartial", {
          succeeded: result.succeeded,
          failed: result.failedIds.length,
        }),
      );
    } else {
      feedback.success(
        t(publish ? "product.bulkPublishSuccess" : "product.bulkUnpublishSuccess", {
          count: result.succeeded,
        }),
      );
    }
  } finally {
    isBulkUpdating.value = false;
  }
}

watch(
  [selectedProductCount, allProductsSelected],
  () => {
    void nextTick(() => {
      if (selectAllCheckbox.value) {
        selectAllCheckbox.value.indeterminate =
          selectedProductCount.value > 0 && !allProductsSelected.value;
      }
    });
  },
  { immediate: true },
);

watch(products, (nextProducts) => {
  const validIds = new Set(nextProducts.map((product) => String(product.id)));
  selectedProductIds.value = new Set(
    [...selectedProductIds.value].filter((id) => validIds.has(id)),
  );
});

function isProductPublished(prod: ShopifyProduct) {
  return prod.status === "active" && Boolean(prod.published_at);
}

async function openDetailModal(prod: ShopifyProduct) {
  selectProduct(prod);
  detailProductId.value = prod.id;
  detailProductRecord.value = prod;
  await loadProductDetail(prod.id);
}

function formatProductStatus(status?: ShopifyProductStatus) {
  if (status === "active") return t("product.statusActive");
  if (status === "draft") return t("product.statusDraft");
  if (status === "archived") return t("product.statusArchived");
  return t("product.statusUnknown");
}

function formatProductDate(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString(locale.value);
}

function formatProductPrice(product: ShopifyProduct) {
  if (product.min_price !== undefined && product.max_price !== undefined) {
    const range =
      product.min_price === product.max_price
        ? product.min_price
        : `${product.min_price} - ${product.max_price}`;
    return product.price_currency ? `${range} ${product.price_currency}` : range;
  }
  const prices = (product.variants || [])
    .map((variant) => Number(variant.price))
    .filter(Number.isFinite);
  if (!prices.length) return "-";
  const minimum = Math.min(...prices).toFixed(2);
  const maximum = Math.max(...prices).toFixed(2);
  return minimum === maximum ? minimum : `${minimum} - ${maximum}`;
}

async function loadProductDetail(productId: ShopifyNumericId) {
  const sid = formStore.storeId;
  const token = activeToken.value;
  if (!sid || !token) return;
  try {
    const response = await $fetch<{ product?: ShopifyProduct }>(
      `/api/product/${productId}`,
      {
        query: { storeId: sid },
        headers: { "X-Shopify-Access-Token": token },
      },
    );
    if (detailProductId.value === productId && response.product) {
      detailProductRecord.value = response.product;
    }
  } catch {
    // Keep the list summary visible if the dedicated detail request fails.
  }
}

async function refreshProductDetail() {
  await refreshProducts();
  if (detailProductId.value) await loadProductDetail(detailProductId.value);
}

function addProductOption() {
  if (newProductOptions.value.length < 3) {
    newProductOptions.value.push({ name: "", values: "" });
  }
}

function removeProductOption(index: number) {
  newProductOptions.value.splice(index, 1);
}

async function applyProductFilters() {
  const sid = formStore.storeId;
  const token = activeToken.value;
  if (!sid || !token) return;
  clearBulkSelection();
  await productStore.fetchAll(sid, token, 50, toProductFilters());
}

async function resetFilters() {
  filterForm.value = {
    title: "",
    status: "",
    published_status: "",
    vendor: "",
    product_type: "",
  };
  await applyProductFilters();
}

function toProductFilters(): ProductListQuery {
  return Object.fromEntries(
    Object.entries(filterForm.value).filter(([, value]) => value.trim()),
  );
}

async function loadMoreProducts() {
  const sid = formStore.storeId;
  const token = activeToken.value;
  if (!sid || !token) return;
  await productStore.fetchNext(sid, token);
}

async function createProduct() {
  const sid = formStore.storeId;
  const token = activeToken.value;

  if (!sid || !token) {
    feedback.error(t("product.credentialsMissing"));
    return;
  }

  let options;
  let variants;
  const imageUrl = newProductImageUrl.value.trim();
  try {
    if (!isValidProductPrice(newProductDefaultPrice.value)) throw new Error("price");
    options = normalizeProductOptions(newProductOptions.value);
    variants = buildVariantsFromOptions(options, {
      price: newProductDefaultPrice.value.trim(),
    });
    if (imageUrl && !/^https?:\/\//i.test(imageUrl)) throw new Error("image");
  } catch {
    feedback.error(t("product.productOptionsInvalid"));
    return;
  }
  const metafields = [
    ...(newProductSeo.value.title.trim()
      ? [
          {
            namespace: "global",
            key: "title_tag",
            value: newProductSeo.value.title.trim(),
            type: "single_line_text_field",
          },
        ]
      : []),
    ...(newProductSeo.value.description.trim()
      ? [
          {
            namespace: "global",
            key: "description_tag",
            value: newProductSeo.value.description.trim(),
            type: "single_line_text_field",
          },
        ]
      : []),
  ];
  const success = await productStore.createProduct(sid, token, {
    ...newProduct.value,
    template_suffix: newProduct.value.template_suffix || null,
    published: newProduct.value.status === "active" && newProduct.value.published,
    ...(options.length ? { options } : {}),
    variants,
    ...(imageUrl ? { images: [{ src: imageUrl }] } : {}),
    ...(metafields.length ? { metafields } : {}),
  });
  if (success) {
    showCreateModal.value = false;
    newProduct.value = {
      title: "",
      body_html: "",
      vendor: "",
      product_type: "",
      tags: "",
      status: "active",
      published: true,
      handle: "",
      template_suffix: null,
    };
    newProductOptions.value = [{ name: "", values: "" }];
    newProductDefaultPrice.value = "0.00";
    newProductImageUrl.value = "";
    newProductSeo.value = { title: "", description: "" };
    feedback.success(t("product.created"));
  } else {
    feedback.error(productStore.error, t("product.createFailed"));
  }
}

async function openEditModal(prod: ShopifyProduct) {
  editProduct.value = {
    id: prod.id,
    title: prod.title || "",
    body_html: prod.body_html || "",
    vendor: prod.vendor || "",
    product_type: prod.product_type || "",
    tags: prod.tags || "",
    status: prod.status || "draft",
    published: isProductPublished(prod),
    published_at: prod.published_at || null,
    handle: prod.handle || "",
    template_suffix: prod.template_suffix || "",
    seo_title: "",
    seo_description: "",
    seo_title_id: null,
    seo_description_id: null,
  };
  showEditModal.value = true;

  const sid = formStore.storeId;
  const token = activeToken.value;
  if (!sid || !token) return;
  try {
    const response = await $fetch<MetafieldsResponse>(
      `/api/metafield/product/${prod.id}`,
      {
        query: { storeId: sid, namespace: "global" },
        headers: { "X-Shopify-Access-Token": token },
      },
    );
    if (editProduct.value.id !== prod.id) return;
    const titleMetafield = response.metafields?.find(
      (metafield) => metafield.key === "title_tag",
    );
    const descriptionMetafield = response.metafields?.find(
      (metafield) => metafield.key === "description_tag",
    );
    editProduct.value.seo_title = titleMetafield?.value || "";
    editProduct.value.seo_description = descriptionMetafield?.value || "";
    editProduct.value.seo_title_id = titleMetafield?.id || null;
    editProduct.value.seo_description_id = descriptionMetafield?.id || null;
  } catch {
    // Product fields remain editable even when optional SEO metafields cannot load.
  }
}

async function saveEditProduct() {
  const sid = formStore.storeId;
  const token = activeToken.value;

  if (!sid || !token || !editProduct.value.id) {
    feedback.error(t("product.credentialsMissing"));
    return;
  }

  const shouldPublish =
    editProduct.value.status === "active" && editProduct.value.published;

  const metafields = [
    ...(editProduct.value.seo_title || editProduct.value.seo_title_id
      ? [
          {
            ...(editProduct.value.seo_title_id
              ? { id: editProduct.value.seo_title_id }
              : {}),
            namespace: "global",
            key: "title_tag",
            value: editProduct.value.seo_title,
            type: "single_line_text_field",
          },
        ]
      : []),
    ...(editProduct.value.seo_description || editProduct.value.seo_description_id
      ? [
          {
            ...(editProduct.value.seo_description_id
              ? { id: editProduct.value.seo_description_id }
              : {}),
            namespace: "global",
            key: "description_tag",
            value: editProduct.value.seo_description,
            type: "single_line_text_field",
          },
        ]
      : []),
  ];
  const success = await productStore.updateProduct(sid, token, editProduct.value.id, {
    title: editProduct.value.title,
    body_html: editProduct.value.body_html,
    vendor: editProduct.value.vendor,
    product_type: editProduct.value.product_type,
    tags: editProduct.value.tags,
    status: editProduct.value.status,
    handle: editProduct.value.handle.trim(),
    template_suffix: editProduct.value.template_suffix?.trim() || null,
    ...(metafields.length ? { metafields } : {}),
    published_at: shouldPublish
      ? editProduct.value.published_at || new Date().toISOString()
      : null,
    ...(shouldPublish ? { published_scope: "web" as const } : {}),
  });
  if (success) {
    showEditModal.value = false;
    feedback.success(t("product.saved"));
  } else {
    feedback.error(productStore.error, t("product.updateFailed"));
  }
}

async function toggleProductPublication(prod: ShopifyProduct) {
  const sid = formStore.storeId;
  const token = activeToken.value;
  if (!sid || !token) {
    feedback.error(t("product.credentialsMissing"));
    return;
  }

  const publish = !isProductPublished(prod);
  publishingProductId.value = prod.id;
  try {
    const success = await productStore.updateProduct(sid, token, prod.id, {
      ...(publish ? { status: "active" as const } : {}),
      published_at: publish ? new Date().toISOString() : null,
      ...(publish ? { published_scope: "web" as const } : {}),
    });

    if (success) {
      feedback.success(
        publish ? t("product.publishSuccess") : t("product.unpublishSuccess"),
      );
    } else {
      feedback.error(
        productStore.error,
        publish ? t("product.publishFailed") : t("product.unpublishFailed"),
      );
    }
  } finally {
    publishingProductId.value = null;
  }
}

async function removeProduct(prodId: ShopifyNumericId) {
  if (
    !(await requestConfirmation({
      title: t("confirm.deleteTitle"),
      message: t("product.deleteConfirm"),
      confirmLabel: t("common.delete"),
    }))
  ) {
    return;
  }
  const sid = formStore.storeId;
  const token = activeToken.value;

  if (!sid || !token) {
    feedback.error(t("product.credentialsMissing"));
    return;
  }

  const success = await productStore.deleteProduct(sid, token, prodId);
  if (success) {
    const nextSelection = new Set(selectedProductIds.value);
    nextSelection.delete(String(prodId));
    selectedProductIds.value = nextSelection;
    feedback.success(t("product.deleted"));
  } else {
    feedback.error(productStore.error, t("product.deleteFailed"));
  }
}

async function refreshProducts() {
  const sid = formStore.storeId;
  const token = activeToken.value;
  if (!sid || !token) return;
  await productStore.fetchAll(sid, token, productStore.pageSize, productStore.filters);
}
</script>

<style scoped>
.page-meta-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.page-meta {
  font-size: 13px;
  color: var(--text-sub);
}
.product-filters {
  display: grid;
  grid-template-columns: minmax(180px, 2fr) repeat(4, minmax(120px, 1fr)) auto auto;
  gap: 8px;
  margin-bottom: 12px;
}
.product-filters .inp {
  padding: 7px 9px;
  font-size: 12px;
}
.filter-reset {
  padding: 6px 12px;
}

.bulk-toolbar {
  display: flex;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  border: 1px solid color-mix(in srgb, var(--green) 35%, var(--border));
  border-radius: var(--radius-sm);
  background: var(--green-soft);
  color: var(--text);
  padding: 8px 10px 8px 14px;
}

.bulk-toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.required-marker {
  color: var(--red);
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
}
.table-card {
  max-height: calc(100vh - 220px);
  overflow: auto;
}

.product-workspace {
  display: block;
  min-width: 0;
}
.load-more-row {
  display: flex;
  justify-content: center;
  padding: 14px 0 0;
}

.products-table {
  width: 100%;
  min-width: 720px;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
  text-align: left;
}
.products-table th {
  position: sticky;
  top: 0;
  z-index: 2;
  padding: 12px 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-sub);
  background: var(--surface-soft);
  border-bottom: 1px solid var(--border);
}
.products-table td {
  padding: 12px 16px;
  font-size: 13px;
  color: var(--text);
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
  overflow-wrap: anywhere;
}

.products-table .selection-column {
  width: 48px;
  padding-inline: 16px 4px;
}

.products-table th:nth-child(2) {
  width: 38%;
}

.products-table th:nth-child(3) {
  width: 14%;
}

.products-table th:nth-child(4) {
  width: 9%;
}

.products-table th:nth-child(5),
.products-table th:nth-child(6) {
  width: 12%;
}

.products-table th:nth-child(7) {
  width: 10%;
}

.product-row:hover {
  background: var(--surface-soft);
}
.product-row {
  cursor: pointer;
}
.product-row.selected,
.product-row.selected:hover {
  background: var(--blue-soft);
}

.product-row.is-bulk-selected,
.product-row.is-bulk-selected:hover {
  background: color-mix(in srgb, var(--green-soft) 72%, var(--surface));
}

.product-row.selected.is-bulk-selected,
.product-row.selected.is-bulk-selected:hover {
  background: color-mix(in srgb, var(--blue-soft) 55%, var(--green-soft));
}

.product-info-cell {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.product-thumb {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  object-fit: cover;
  border: 1px solid var(--border);
}
.empty-thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-soft);
  color: var(--text-muted);
  font-size: 10px;
  text-align: center;
}
.product-main-details {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.product-title-text {
  font-weight: 600;
  color: var(--text);
  overflow-wrap: anywhere;
}
.product-id-sub {
  font-size: 11px;
  color: var(--text-sub);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 500;
}

.virtual-spacer td {
  padding: 0;
  border: 0;
}

.page-meta-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.error-state {
  color: var(--red);
}
.badge::before {
  content: "•";
  font-size: 14px;
}
.badge-paid {
  background: var(--badge-paid);
  color: var(--badge-paid-text);
}
.badge-pending {
  background: var(--badge-pending);
  color: var(--badge-pending-text);
}

.product-status-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.publication-state {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
}

.publication-state.published {
  color: var(--green);
}

.btn-primary-sm {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--green);
  color: var(--on-accent);
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}
.btn-primary-sm:hover {
  filter: brightness(0.94);
}

.btn-ghost-sm {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  color: var(--text-link);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}
.btn-ghost-sm:hover {
  background: var(--blue-soft);
}

.btn-ghost-sm :deep(svg),
.popover-item :deep(svg),
.modal-actions button :deep(svg) {
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
}

.btn-icon {
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.popover-actions {
  min-width: 120px;
  padding: 4px;
}
.popover-item {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  text-align: left;
  padding: 8px 12px;
  background: none;
  border: none;
  font-size: 13px;
  cursor: pointer;
  border-radius: 4px;
  color: var(--text);
  font-family: inherit;
}
.popover-item:disabled {
  cursor: wait;
  opacity: 0.55;
}
.popover-item:hover {
  background: var(--surface-soft);
}
.text-danger {
  color: var(--badge-cancelled-text) !important;
}
.product-actions-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.empty-state {
  padding: 60px 20px;
  text-align: center;
  color: var(--text-sub);
}
#loading {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-sub);
}

/* Modals */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal-card {
  background: var(--surface);
  width: 100%;
  max-width: 680px;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  max-height: 90vh;
}
.option-editor-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.option-row {
  display: grid;
  grid-template-columns: minmax(130px, 1fr) minmax(220px, 2fr) auto;
  gap: 8px;
  margin-top: 8px;
}
.modal-head {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.modal-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.btn-close {
  display: inline-grid;
  place-items: center;
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: var(--text-sub);
}

.btn-close :deep(svg) {
  width: 16px;
  height: 16px;
}
.modal-body {
  padding: 20px;
  overflow-y: auto;
}
.field {
  margin-bottom: 16px;
}
.field-row {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}
.field-row .field {
  flex: 1;
  margin-bottom: 0;
}
.checkbox-field {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 26px;
  cursor: pointer;
}
.checkbox-field input {
  width: 16px;
  height: 16px;
}
.checkbox-field:has(input:disabled) {
  color: var(--text-muted);
  cursor: not-allowed;
}
.field-label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  font-size: 13px;
  color: var(--text);
}
.inp {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-family: inherit;
  font-size: 14px;
}
.inp:focus {
  border-color: var(--text-link);
  outline: none;
}
.modal-actions {
  padding: 16px 20px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
.btn-outline {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 10px 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}
.btn-outline:hover {
  background: var(--surface-soft);
}
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 10px 16px;
  background: var(--green);
  color: var(--on-accent);
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}
.btn-primary:hover {
  background: var(--green);
}
.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 700px) {
  .page-meta-header,
  .bulk-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .page-meta-actions,
  .bulk-toolbar-actions {
    justify-content: flex-start;
  }

  .field-row {
    flex-direction: column;
  }

  .product-filters,
  .option-row {
    grid-template-columns: 1fr;
  }

  .checkbox-field {
    padding-top: 0;
  }
}
</style>
