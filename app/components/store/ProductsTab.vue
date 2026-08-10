<template>
  <div class="products-tab">
    <div class="products-manager">
      <!-- Loading state -->
      <div v-if="productStore.isLoading && !products.length" id="loading">
        {{ t("product.loadingProducts") }}
      </div>
      <div
        v-else-if="productStore.error"
        id="loading"
        class="error-state"
        role="alert"
      >
        {{ productStore.error }}
      </div>

      <!-- ════════════════════════════════════════ SCREEN: LIST -->
      <div v-else>
        <div class="page-meta-header">
          <div class="page-meta">
            {{ t("product.productCount", { count: products.length }) }}
          </div>
          <button class="btn-primary-sm" @click="showCreateModal = true">
            <Plus :size="14" aria-hidden="true" />
            {{ t("product.addProduct") }}
          </button>
        </div>

        <div class="product-workspace">
        <div class="card table-card">
          <table class="products-table">
            <thead>
              <tr>
                <th>{{ t("product.columnProduct") }}</th>
                <th>{{ t("product.columnStatus") }}</th>
                <th>{{ t("product.columnVariants") }}</th>
                <th>{{ t("product.columnUpdated") }}</th>
                <th style="text-align: right">{{ t("product.columnActions") }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(prod, index) in products"
                :key="prod.id || index"
                class="product-row"
                :class="{ selected: selectedProduct?.id === prod.id }"
                @click="selectProduct(prod)"
              >
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
                  {{ prod.variants?.length || 0 }}
                </td>
                <td>
                  {{ formatProductDate(prod.updated_at) }}
                </td>
                <td style="text-align: right">
                  <div
                    class="product-actions-cell"
                    style="justify-content: flex-end"
                  >
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
                            {{ t("common.delete") }}
                          </button>
                        </div>
                      </template>
                    </BasePopover>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="products.length === 0" class="empty-state">
            {{ t("product.empty") }}
          </div>
        </div>
        </div>
      </div>
    </div>

    <ProductDetailModal
      v-if="detailProduct"
      :product="detailProduct"
      @close="detailProductId = null"
      @refreshed="refreshProducts"
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
            x
          </button>
        </div>
        <div class="modal-body">
          <div class="field">
            <label class="field-label"
              >{{ t("product.fieldTitle") }}
                <span aria-hidden="true" style="color: red">*</span>
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
        </div>
        <div class="modal-actions">
          <button class="btn-outline" @click="showCreateModal = false">
            {{ t("common.cancel") }}
          </button>
          <button
            class="btn-primary"
            @click="createProduct"
            :disabled="productStore.isLoading"
          >
            {{
              productStore.isLoading
                ? t("product.creating")
                : t("product.createTitle")
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
            x
          </button>
        </div>
        <div class="modal-body">
          <div class="field">
            <label class="field-label"
              >{{ t("product.fieldTitle") }} <span style="color: red">*</span></label
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
              <label class="field-label">{{ t("product.vendor") }}</label>
              <input v-model="editProduct.vendor" type="text" class="inp" />
            </div>
            <div class="field">
              <label class="field-label">{{ t("product.productType") }}</label>
              <input
                v-model="editProduct.product_type"
                type="text"
                class="inp"
              />
            </div>
          </div>
          <div class="field">
            <label class="field-label">{{ t("product.tags") }}</label>
            <input v-model="editProduct.tags" type="text" class="inp" />
          </div>
          <div class="field">
            <label class="field-label">{{ t("product.descriptionHtml") }}</label>
            <textarea
              v-model="editProduct.body_html"
              class="inp"
              rows="4"
            ></textarea>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-outline" @click="showEditModal = false">
            {{ t("common.cancel") }}
          </button>
          <button
            class="btn-primary"
            @click="saveEditProduct"
            :disabled="productStore.isLoading"
          >
            {{
              productStore.isLoading
                ? t("product.saving")
                : t("product.saveChanges")
            }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Plus } from "@lucide/vue";
import { computed, ref } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useStoreFeedback } from "~/composables/useStoreFeedback";
import { useFormStore } from "~/stores/form";
import { useProductStore } from "~/stores/product";
import type {
  ShopifyProduct,
  ShopifyProductInput,
  ShopifyProductStatus,
} from "~~/types/shopify";

const productStore = useProductStore();
const formStore = useFormStore();
const { token: activeToken } = useActiveShopAuth();
const feedback = useStoreFeedback();
const { t, locale } = useLocalization();
const { requestConfirmation } = useConfirmDialog();

const products = computed(() => productStore.products);
const selectedProductId = ref<number | null>(null);
const selectedProduct = computed(() => {
  return (
    products.value.find((product) => product.id === selectedProductId.value) ||
    null
  );
});
const detailProductId = ref<number | null>(null);
const detailProduct = computed(() => {
  return (
    products.value.find((product) => product.id === detailProductId.value) ||
    null
  );
});

// ── Local state for modals ──
const showCreateModal = ref(false);
const showEditModal = ref(false);
const publishingProductId = ref<number | null>(null);

const newProduct = ref<ShopifyProductInput>({
  title: "",
  body_html: "",
  vendor: "",
  product_type: "",
  tags: "",
  status: "active",
  published: true,
});

const editProduct = ref({
  id: null as number | null,
  title: "",
  body_html: "",
  vendor: "",
  product_type: "",
  tags: "",
  status: "active" as ShopifyProductStatus,
  published: true,
  published_at: null as string | null,
});

// ── Actions ──
function selectProduct(prod: ShopifyProduct) {
  selectedProductId.value = prod.id;
}

function isProductPublished(prod: ShopifyProduct) {
  return prod.status === "active" && Boolean(prod.published_at);
}

function openDetailModal(prod: ShopifyProduct) {
  selectProduct(prod);
  detailProductId.value = prod.id;
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

async function createProduct() {
  const sid = formStore.storeId;
  const token = activeToken.value;

  if (!sid || !token) {
    feedback.error(t("product.credentialsMissing"));
    return;
  }

  const success = await productStore.createProduct(sid, token, {
    ...newProduct.value,
    published:
      newProduct.value.status === "active" && newProduct.value.published,
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
    };
    feedback.success(t("product.created"));
  } else {
    feedback.error(productStore.error, t("product.createFailed"));
  }
}

function openEditModal(prod: ShopifyProduct) {
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
  };
  showEditModal.value = true;
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

  const success = await productStore.updateProduct(
    sid,
    token,
    editProduct.value.id,
    {
      title: editProduct.value.title,
      body_html: editProduct.value.body_html,
      vendor: editProduct.value.vendor,
      product_type: editProduct.value.product_type,
      tags: editProduct.value.tags,
      status: editProduct.value.status,
      published_at: shouldPublish
        ? editProduct.value.published_at || new Date().toISOString()
        : null,
      ...(shouldPublish ? { published_scope: "web" as const } : {}),
    },
  );
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

async function removeProduct(prodId: number) {
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
    feedback.success(t("product.deleted"));
  } else {
    feedback.error(productStore.error, t("product.deleteFailed"));
  }
}

async function refreshProducts() {
  const sid = formStore.storeId;
  const token = activeToken.value;
  if (!sid || !token) return;
  await productStore.fetchAll(sid, token, 250);
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

.products-table th:nth-child(1) {
  width: 46%;
}

.products-table th:nth-child(2) {
  width: 18%;
}

.products-table th:nth-child(3),
.products-table th:nth-child(4) {
  width: 12%;
}

.products-table th:nth-child(5) {
  width: 12%;
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
  color: white;
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
  display: block;
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
  max-width: 540px;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  max-height: 90vh;
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
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: var(--text-sub);
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
  padding: 10px 16px;
  background: var(--green);
  color: white;
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

</style>
