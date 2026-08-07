<template>
  <div class="products-tab">
    <div v-if="productStore.isLoading && !productStore.products.length" class="empty">
      Loading products...
    </div>
    <div v-else-if="productStore.error" class="empty" style="color: red">
      {{ productStore.error }}
    </div>
    <template v-else>
      <div class="products-tab-header">
        <div class="products-tab-meta">
          {{ productStore.products.length }} product{{ productStore.products.length !== 1 ? "s" : "" }}
        </div>
        <button class="btn-primary-sm" type="button" @click="showCreateModal = true">
          <Plus />
          Add product
        </button>
      </div>

      <table class="products-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Status</th>
            <th>Type</th>
            <th>Tags</th>
            <th>Variants</th>
            <th>Updated</th>
            <th style="text-align: right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(prod, index) in productStore.products"
            :key="prod.id || index"
            class="product-row"
          >
            <td>
              <div class="product-info-cell">
                <img
                  v-if="prod.image"
                  :src="prod.image.src"
                  class="product-thumb"
                  alt="Product Image"
                />
                <div v-else class="product-thumb empty-thumb">No Img</div>
                <div class="product-main-details">
                  <div class="product-title-text">{{ prod.title }}</div>
                  <div class="product-id-sub">ID: {{ prod.id }}</div>
                </div>
              </div>
            </td>
            <td>
              <span
                v-if="prod.status"
                class="badge"
                :class="prod.status === 'active' ? 'badge-paid' : 'badge-pending'"
              >
                {{ prod.status.charAt(0).toUpperCase() + prod.status.slice(1) }}
              </span>
            </td>
            <td>{{ prod.product_type || "—" }}</td>
            <td>
              <div class="tags-cell">
                <span
                  v-for="tag in prod.tags ? prod.tags.split(',').slice(0, 2) : []"
                  :key="tag"
                  class="tag-item"
                >
                  {{ tag.trim() }}
                </span>
                <span v-if="prod.tags && prod.tags.split(',').length > 2" class="tag-item more">
                  +{{ prod.tags.split(",").length - 2 }}
                </span>
                <span v-if="!prod.tags || prod.tags.trim() === ''">—</span>
              </div>
            </td>
            <td>{{ prod.variants?.length || 0 }}</td>
            <td>
              {{
                prod.updated_at
                  ? new Date(prod.updated_at).toLocaleDateString()
                  : "—"
              }}
            </td>
            <td style="text-align: right">
              <div class="product-actions-cell" style="justify-content: flex-end">
                <BasePopover align="right">
                  <template #trigger="{ isOpen }">
                    <button class="btn-ghost-sm btn-icon" :class="{ 'is-active': isOpen }">
                      <IconsMore />
                    </button>
                  </template>
                  <template #default="{ close }">
                    <div class="popover-menu popover-actions">
                      <button
                        class="popover-item"
                        type="button"
                        @click.stop="openEditModal(prod); close()"
                      >
                        <Pencil />
                        Edit
                      </button>
                      <button
                        class="popover-item text-danger"
                        type="button"
                        @click.stop="removeProduct(prod.id); close()"
                      >
                        <Trash2 />
                        Delete
                      </button>
                    </div>
                  </template>
                </BasePopover>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="productStore.products.length === 0" class="empty">
        No products found. Create one.
      </div>
    </template>

    <!-- Create Modal -->
    <div v-if="showCreateModal" class="modal-backdrop" @click.self="showCreateModal = false">
      <div class="modal-card">
        <div class="modal-head">
          <h3 class="modal-title">Create Product</h3>
          <button
            class="btn-close"
            type="button"
            aria-label="Close create product"
            title="Close"
            @click="showCreateModal = false"
          >
            <X />
          </button>
        </div>
        <div class="modal-body">
          <div class="field">
            <label class="field-label">Title <span style="color: red">*</span></label>
            <input v-model="newProduct.title" type="text" class="inp" placeholder="Awesome Product" />
          </div>
          <div class="field-row">
            <div class="field">
              <label class="field-label">Vendor</label>
              <input v-model="newProduct.vendor" type="text" class="inp" placeholder="My Vendor" />
            </div>
            <div class="field">
              <label class="field-label">Product Type</label>
              <input v-model="newProduct.product_type" type="text" class="inp" placeholder="e.g. Shirts" />
            </div>
          </div>
          <div class="field">
            <label class="field-label">Tags</label>
            <input v-model="newProduct.tags" type="text" class="inp" placeholder="Tag 1, Tag 2" />
          </div>
          <div class="field">
            <label class="field-label">Description (HTML)</label>
            <textarea v-model="newProduct.body_html" class="inp" rows="4" placeholder="<p>Information</p>"></textarea>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-outline" type="button" @click="showCreateModal = false">
            <X />
            Cancel
          </button>
          <button
            class="btn-primary"
            type="button"
            @click="createProduct"
            :disabled="productStore.isLoading"
          >
            <Plus />
            {{ productStore.isLoading ? "Creating..." : "Create Product" }}
          </button>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <div v-if="showEditModal" class="modal-backdrop" @click.self="showEditModal = false">
      <div class="modal-card">
        <div class="modal-head">
          <h3 class="modal-title">Edit Product</h3>
          <button
            class="btn-close"
            type="button"
            aria-label="Close edit product"
            title="Close"
            @click="showEditModal = false"
          >
            <X />
          </button>
        </div>
        <div class="modal-body">
          <div class="field">
            <label class="field-label">Title <span style="color: red">*</span></label>
            <input v-model="editProduct.title" type="text" class="inp" />
          </div>
          <div class="field-row">
            <div class="field">
              <label class="field-label">Vendor</label>
              <input v-model="editProduct.vendor" type="text" class="inp" />
            </div>
            <div class="field">
              <label class="field-label">Product Type</label>
              <input v-model="editProduct.product_type" type="text" class="inp" />
            </div>
          </div>
          <div class="field">
            <label class="field-label">Tags</label>
            <input v-model="editProduct.tags" type="text" class="inp" />
          </div>
          <div class="field">
            <label class="field-label">Description (HTML)</label>
            <textarea v-model="editProduct.body_html" class="inp" rows="4"></textarea>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-outline" type="button" @click="showEditModal = false">
            <X />
            Cancel
          </button>
          <button
            class="btn-primary"
            type="button"
            @click="saveEditProduct"
            :disabled="productStore.isLoading"
          >
            <Save />
            {{ productStore.isLoading ? "Saving..." : "Save Changes" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Pencil, Plus, Save, Trash2, X } from "@lucide/vue";
import { ref } from "vue";
import { useStoreFeedback } from "~/composables/useStoreFeedback";
import { useCredentialVaultStore } from "~/stores/credentialVault";
import { useFormStore } from "~/stores/form";
import { useProductStore } from "~/stores/product";
import type { ShopifyProduct } from "~~/types/shopify";

const productStore = useProductStore();
const formStore = useFormStore();
const credentialVault = useCredentialVaultStore();
const feedback = useStoreFeedback();

const showCreateModal = ref(false);
const showEditModal = ref(false);

const newProduct = ref({
  title: "",
  body_html: "",
  vendor: "",
  product_type: "",
  tags: "",
});

const editProduct = ref({
  id: null as number | null,
  title: "",
  body_html: "",
  vendor: "",
  product_type: "",
  tags: "",
});

function resolveToken(sid: string): string | null {
  const data = credentialVault.getStoreData(sid);
  const now = Date.now();
  if (data?.accessToken && data?.expiresTime && now < data.expiresTime) {
    return data.accessToken;
  }
  return null;
}

async function createProduct() {
  const sid = formStore.storeId;
  const token = sid ? resolveToken(sid) : null;
  if (!sid || !token) {
    feedback.error("Store ID or Access Token is missing.");
    return;
  }
  const success = await productStore.createProduct(sid, token, { ...newProduct.value });
  if (success) {
    showCreateModal.value = false;
    newProduct.value = { title: "", body_html: "", vendor: "", product_type: "", tags: "" };
    feedback.success("Product created.");
  } else {
    feedback.error(productStore.error, "Create failed.");
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
  };
  showEditModal.value = true;
}

async function saveEditProduct() {
  const sid = formStore.storeId;
  const token = sid ? resolveToken(sid) : null;
  if (!sid || !token || !editProduct.value.id) {
    feedback.error("Store ID or Access Token is missing.");
    return;
  }
  const success = await productStore.updateProduct(sid, token, editProduct.value.id, {
    title: editProduct.value.title,
    body_html: editProduct.value.body_html,
    vendor: editProduct.value.vendor,
    product_type: editProduct.value.product_type,
    tags: editProduct.value.tags,
  });
  if (success) {
    showEditModal.value = false;
    feedback.success("Product saved.");
  } else {
    feedback.error(productStore.error, "Update failed.");
  }
}

async function removeProduct(prodId: number) {
  if (!confirm("Are you sure you want to delete this product?")) return;
  const sid = formStore.storeId;
  const token = sid ? resolveToken(sid) : null;
  if (!sid || !token) {
    feedback.error("Store ID or Access Token is missing.");
    return;
  }
  const success = await productStore.deleteProduct(sid, token, prodId);
  if (success) {
    feedback.success("Product deleted.");
  } else {
    feedback.error(productStore.error, "Delete failed.");
  }
}
</script>

<style scoped>
.products-tab-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}
.products-tab-meta {
  font-size: 13px;
  color: var(--text-secondary);
}

.products-table {
  width: 100%;
  border-collapse: collapse;
}
.products-table th {
  padding: 10px 16px;
  text-align: left;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
  background: var(--surface-soft);
}
.products-table td {
  padding: 12px 16px;
  font-size: 13px;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
}
.product-row {
  cursor: default;
  transition: background 0.12s;
}
.product-row:hover {
  background: var(--surface-soft);
}

.product-info-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}
.product-thumb {
  width: 36px;
  height: 36px;
  border-radius: 4px;
  object-fit: cover;
  border: 1px solid var(--border);
  flex-shrink: 0;
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
}
.product-title-text {
  font-weight: 600;
  color: var(--text-primary);
}
.product-id-sub {
  font-size: 11px;
  color: var(--text-secondary);
}

.tags-cell {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.tag-item {
  background: var(--surface-soft);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  color: var(--text-secondary);
}
.tag-item.more {
  background: var(--blue-soft);
  color: var(--blue);
}

.product-actions-cell {
  display: flex;
}
.btn-ghost-sm {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.btn-ghost-sm:hover {
  background: var(--surface-soft);
}
.popover-actions {
  min-width: 120px;
  padding: 4px;
}
.popover-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  text-align: left;
  padding: 8px 12px;
  background: none;
  border: none;
  font-size: 13px;
  cursor: pointer;
  border-radius: 4px;
  color: var(--text-primary);
  font-family: inherit;
}
.popover-item svg {
  width: 14px;
  height: 14px;
  flex: 0 0 14px;
}
.popover-item:hover {
  background: var(--surface-soft);
}
.text-danger {
  color: var(--red) !important;
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
.btn-primary-sm svg {
  width: 14px;
  height: 14px;
  flex: 0 0 14px;
}
.btn-primary-sm:hover {
  opacity: 0.85;
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
  width: 32px;
  height: 32px;
  display: inline-grid;
  place-items: center;
  background: none;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-secondary);
}
.btn-close:hover {
  background: var(--surface-soft);
}
.btn-close svg {
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
.field-label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  font-size: 13px;
  color: var(--text-primary);
}
.inp {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-family: inherit;
  font-size: 14px;
  box-sizing: border-box;
}
.inp:focus {
  border-color: var(--blue);
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
  padding: 8px 16px;
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
  padding: 8px 16px;
  background: var(--green);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}
.btn-outline svg,
.btn-primary svg {
  width: 15px;
  height: 15px;
  flex: 0 0 15px;
}
.btn-primary:hover {
  opacity: 0.85;
}
.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.empty {
  text-align: center;
  padding: 32px;
  color: var(--text-secondary);
  font-size: 13px;
}
</style>
