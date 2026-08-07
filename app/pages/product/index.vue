<template>
  <NuxtLayout name="shop">
    <template #title>
      <span class="page-title">Products</span>
    </template>

    <div class="page" id="app">
      <!-- Loading state -->
      <div v-if="productStore.isLoading && !products.length" id="loading">
        Loading products...
      </div>
      <div v-else-if="productStore.error" id="loading" style="color: red">
        {{ productStore.error }}
      </div>

      <!-- ════════════════════════════════════════ SCREEN: LIST -->
      <div v-else>
        <div class="page-meta-header">
          <div class="page-meta">
            {{ products.length }} product{{ products.length !== 1 ? "s" : "" }}
          </div>
          <button class="btn-primary-sm" @click="showCreateModal = true">
            <span v-html="ICONS_PLUS"></span>
            Add product
          </button>
        </div>

        <div class="product-workspace">
        <div class="card table-card">
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
                    :class="
                      prod.status === 'active' ? 'badge-paid' : 'badge-pending'
                    "
                  >
                    {{
                      prod.status.charAt(0).toUpperCase() + prod.status.slice(1)
                    }}
                  </span>
                </td>
                <td>
                  {{ prod.product_type || "—" }}
                </td>
                <td>
                  <div class="tags-cell">
                    <span
                      v-for="tag in prod.tags
                        ? prod.tags.split(',').slice(0, 2)
                        : []"
                      :key="tag"
                      class="tag-item"
                    >
                      {{ tag.trim() }}
                    </span>
                    <span
                      v-if="prod.tags && prod.tags.split(',').length > 2"
                      class="tag-item more"
                    >
                      +{{ prod.tags.split(",").length - 2 }}
                    </span>
                    <span v-if="!prod.tags || prod.tags.trim() === ''">—</span>
                  </div>
                </td>
                <td>
                  {{ prod.variants?.length || 0 }}
                </td>
                <td>
                  {{
                    prod.updated_at
                      ? new Date(prod.updated_at).toLocaleDateString()
                      : "—"
                  }}
                </td>
                <td style="text-align: right">
                  <div
                    class="product-actions-cell"
                    style="justify-content: flex-end"
                  >
                    <BasePopover align="right">
                      <template #trigger="{ isOpen }">
                        <button
                          class="btn-ghost-sm btn-icon"
                          :class="{ 'is-active': isOpen }"
                        >
                          <IconsMore />
                        </button>
                      </template>
                      <template #default="{ close }">
                        <div class="popover-menu popover-actions">
                          <button
                            class="popover-item"
                            @click.stop="
                              selectProduct(prod);
                              close();
                            "
                          >
                            Details
                          </button>
                          <button
                            class="popover-item"
                            @click.stop="
                              openEditModal(prod);
                              close();
                            "
                          >
                            Edit
                          </button>
                          <button
                            class="popover-item text-danger"
                            @click.stop="
                              removeProduct(prod.id);
                              close();
                            "
                          >
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
          <div v-if="products.length === 0" class="empty-state">
            No products found. Create one.
          </div>
        </div>

        <aside v-if="selectedProduct" class="card product-detail-card">
          <div class="detail-head">
            <div class="detail-product">
              <img
                v-if="selectedProduct.image"
                :src="selectedProduct.image.src"
                class="detail-thumb"
                alt="Selected product"
              />
              <div v-else class="detail-thumb empty-thumb">No Img</div>
              <div class="detail-product-main">
                <div class="detail-title">{{ selectedProduct.title }}</div>
                <div class="detail-sub">ID: {{ selectedProduct.id }}</div>
              </div>
            </div>
            <button
              class="btn-ghost-sm btn-icon"
              type="button"
              :disabled="isLoadingLocations"
              title="Refresh locations"
              @click="refreshSelectedProductLocations"
            >
              <IconsRefresh />
            </button>
          </div>

          <div class="detail-meta-grid">
            <div class="detail-meta-item">
              <span>Status</span>
              <strong>{{ selectedProduct.status || "Unknown" }}</strong>
            </div>
            <div class="detail-meta-item">
              <span>Variants</span>
              <strong>{{ selectedProduct.variants?.length || 0 }}</strong>
            </div>
            <div class="detail-meta-item">
              <span>Total inventory</span>
              <strong>{{ totalVariantInventory }}</strong>
            </div>
            <div class="detail-meta-item">
              <span>Tracked variants</span>
              <strong>{{ trackedVariantCount }}</strong>
            </div>
          </div>

          <div class="detail-section">
            <div class="detail-section-title">Variants</div>
            <div v-if="selectedProduct.variants?.length" class="variant-list">
              <div
                v-for="variant in selectedProduct.variants"
                :key="variant.id"
                class="variant-row"
              >
                <div>
                  <div class="variant-title">{{ variant.title || "Default" }}</div>
                  <div class="variant-sub">
                    {{ variant.sku || "No SKU" }}
                    <span v-if="variant.inventory_item_id">
                      - Item {{ variant.inventory_item_id }}
                    </span>
                  </div>
                </div>
                <span class="variant-inventory">
                  {{ formatVariantInventory(variant) }}
                </span>
              </div>
            </div>
            <div v-else class="detail-empty">No variants found.</div>
          </div>

          <div class="detail-section">
            <div class="detail-section-head">
              <div>
                <div class="detail-section-title">Inventory locations</div>
                <div class="detail-section-sub">
                  {{ visibleLocations.length }} location{{
                    visibleLocations.length !== 1 ? "s" : ""
                  }}
                </div>
              </div>
            </div>

            <div v-if="isLoadingLocations" class="detail-loading">
              Loading locations...
            </div>
            <div v-else-if="locationError" class="detail-error">
              {{ locationError }}
            </div>
            <div v-else-if="!visibleLocations.length" class="detail-empty">
              No locations found.
            </div>
            <div v-else class="location-list">
              <div
                v-for="location in visibleLocations"
                :key="location.id"
                class="location-row"
              >
                <div class="location-main">
                  <div class="location-name">
                    {{ location.name || `Location ${location.id}` }}
                  </div>
                  <div class="location-address">
                    {{ formatLocationAddress(location) }}
                  </div>
                </div>
                <div class="location-side">
                  <span class="inventory-count">
                    {{ getLocationInventoryLabel(location.id) }}
                  </span>
                  <span
                    class="location-status"
                    :class="{
                      active: location.active,
                      inactive: location.active === false,
                    }"
                  >
                    {{ location.active === false ? "Inactive" : "Active" }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <ProductOperationsPanel
            :product="selectedProduct"
            @refreshed="refreshProducts"
          />
        </aside>
        </div>
      </div>
    </div>

    <!-- Create Modal -->
    <div
      v-if="showCreateModal"
      class="modal-backdrop"
      @click.self="showCreateModal = false"
    >
      <div class="modal-card">
        <div class="modal-head">
          <h3 class="modal-title">Create Product</h3>
          <button class="btn-close" @click="showCreateModal = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="field">
            <label class="field-label"
              >Title <span style="color: red">*</span></label
            >
            <input
              v-model="newProduct.title"
              type="text"
              class="inp"
              placeholder="Awesome Product"
            />
          </div>
          <div class="field-row">
            <div class="field">
              <label class="field-label">Status</label>
              <select v-model="newProduct.status" class="inp">
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <label class="field checkbox-field">
              <input
                v-model="newProduct.published"
                type="checkbox"
                :disabled="newProduct.status !== 'active'"
              />
              Published to Online Store
            </label>
          </div>
          <div class="field-row">
            <div class="field">
              <label class="field-label">Vendor</label>
              <input
                v-model="newProduct.vendor"
                type="text"
                class="inp"
                placeholder="My Vendor"
              />
            </div>
            <div class="field">
              <label class="field-label">Product Type</label>
              <input
                v-model="newProduct.product_type"
                type="text"
                class="inp"
                placeholder="e.g. Shirts"
              />
            </div>
          </div>
          <div class="field">
            <label class="field-label">Tags</label>
            <input
              v-model="newProduct.tags"
              type="text"
              class="inp"
              placeholder="Tag 1, Tag 2"
            />
          </div>
          <div class="field">
            <label class="field-label">Description (HTML)</label>
            <textarea
              v-model="newProduct.body_html"
              class="inp"
              rows="4"
              placeholder="<p>Information</p>"
            ></textarea>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-outline" @click="showCreateModal = false">
            Cancel
          </button>
          <button
            class="btn-primary"
            @click="createProduct"
            :disabled="productStore.isLoading"
          >
            {{ productStore.isLoading ? "Creating..." : "Create Product" }}
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
          <h3 class="modal-title">Edit Product</h3>
          <button class="btn-close" @click="showEditModal = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="field">
            <label class="field-label"
              >Title <span style="color: red">*</span></label
            >
            <input v-model="editProduct.title" type="text" class="inp" />
          </div>
          <div class="field-row">
            <div class="field">
              <label class="field-label">Status</label>
              <select v-model="editProduct.status" class="inp">
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <label class="field checkbox-field">
              <input
                v-model="editProduct.published"
                type="checkbox"
                :disabled="editProduct.status !== 'active'"
              />
              Published to Online Store
            </label>
          </div>
          <div class="field-row">
            <div class="field">
              <label class="field-label">Vendor</label>
              <input v-model="editProduct.vendor" type="text" class="inp" />
            </div>
            <div class="field">
              <label class="field-label">Product Type</label>
              <input
                v-model="editProduct.product_type"
                type="text"
                class="inp"
              />
            </div>
          </div>
          <div class="field">
            <label class="field-label">Tags</label>
            <input v-model="editProduct.tags" type="text" class="inp" />
          </div>
          <div class="field">
            <label class="field-label">Description (HTML)</label>
            <textarea
              v-model="editProduct.body_html"
              class="inp"
              rows="4"
            ></textarea>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-outline" @click="showEditModal = false">
            Cancel
          </button>
          <button
            class="btn-primary"
            @click="saveEditProduct"
            :disabled="productStore.isLoading"
          >
            {{ productStore.isLoading ? "Saving..." : "Save Changes" }}
          </button>
        </div>
      </div>
    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useCredentialVaultStore } from "~/stores/credentialVault";
import { useFormStore } from "~/stores/form";
import { useProductStore } from "~/stores/product";
import type {
  ShopifyLocation,
  ShopifyProduct,
  ShopifyProductInput,
  ShopifyProductStatus,
} from "~~/types/shopify";

definePageMeta({ layout: false });

const productStore = useProductStore();
const formStore = useFormStore();
const credentialVault = useCredentialVaultStore();
const {
  locations,
  inventoryLevels,
  isLoadingLocations,
  locationError,
  fetchProductInventory,
} = useLocations();

const products = computed(() => productStore.products);
const selectedProductId = ref<number | null>(null);
const selectedProduct = computed(() => {
  if (!products.value.length) return null;

  return (
    products.value.find((product) => product.id === selectedProductId.value) ||
    products.value[0] ||
    null
  );
});
const selectedInventoryItemIds = computed(() =>
  Array.from(
    new Set(
      (selectedProduct.value?.variants || [])
        .map((variant) => variant.inventory_item_id)
        .filter((id): id is number => typeof id === "number"),
    ),
  ),
);
const selectedInventoryItemIdSet = computed(
  () => new Set(selectedInventoryItemIds.value),
);
const selectedInventoryLevels = computed(() =>
  inventoryLevels.value.filter((level) =>
    selectedInventoryItemIdSet.value.has(level.inventory_item_id),
  ),
);
const inventoryByLocation = computed(() => {
  const summaries = new Map<
    number,
    { available: number; levelCount: number; hasUntracked: boolean }
  >();

  selectedInventoryLevels.value.forEach((level) => {
    const current = summaries.get(level.location_id) || {
      available: 0,
      levelCount: 0,
      hasUntracked: false,
    };

    current.levelCount += 1;
    if (level.available === null) {
      current.hasUntracked = true;
    } else {
      current.available += level.available;
    }

    summaries.set(level.location_id, current);
  });

  return summaries;
});
const visibleLocations = computed(() => {
  if (!selectedInventoryLevels.value.length) {
    return locations.value;
  }

  const locationIds = new Set(
    selectedInventoryLevels.value.map((level) => level.location_id),
  );

  return locations.value.filter((location) => locationIds.has(location.id));
});
const totalVariantInventory = computed(() =>
  (selectedProduct.value?.variants || []).reduce(
    (sum, variant) => sum + (variant.inventory_quantity || 0),
    0,
  ),
);
const trackedVariantCount = computed(
  () =>
    (selectedProduct.value?.variants || []).filter(
      (variant) => !!variant.inventory_management,
    ).length,
);

// ── Local state for modals ──
const showCreateModal = ref(false);
const showEditModal = ref(false);

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
});

const ICONS_PLUS = `<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" /></svg>`;

// ── Actions ──
function selectProduct(prod: ShopifyProduct) {
  selectedProductId.value = prod.id;
}

async function loadLocationsForSelectedProduct(force = false) {
  if (!selectedProduct.value) return;

  await fetchProductInventory(selectedProduct.value, force);
}

function refreshSelectedProductLocations() {
  void loadLocationsForSelectedProduct(true);
}

function formatVariantInventory(variant: ShopifyProduct["variants"][number]) {
  if (typeof variant.inventory_quantity === "number") {
    return `${variant.inventory_quantity} available`;
  }

  return variant.inventory_management ? "Tracked" : "Not tracked";
}

function formatLocationAddress(location: ShopifyLocation) {
  const parts = [
    location.address1,
    location.address2,
    location.city,
    location.province_code || location.province,
    location.zip,
    location.country_code || location.country,
  ].filter(Boolean);

  return parts.length ? parts.join(", ") : "No address";
}

function getLocationInventoryLabel(locationId: number) {
  if (selectedInventoryItemIds.value.length === 0) {
    return "No inventory item ID";
  }

  const summary = inventoryByLocation.value.get(locationId);
  if (!summary) {
    return "No inventory level";
  }

  if (summary.hasUntracked && summary.available === 0) {
    return "Not tracked";
  }

  return `${summary.available} available${
    summary.hasUntracked ? " + untracked" : ""
  }`;
}

watch(
  products,
  (list) => {
    if (!list.length) {
      selectedProductId.value = null;
      return;
    }

    if (!list.some((product) => product.id === selectedProductId.value)) {
      selectedProductId.value = list[0]?.id || null;
    }
  },
  { immediate: true },
);

watch(
  () => [
    formStore.storeId,
    selectedProduct.value?.id || "",
    selectedInventoryItemIds.value.join(","),
  ],
  () => {
    void loadLocationsForSelectedProduct();
  },
  { immediate: true },
);

async function createProduct() {
  const sid = formStore.storeId;
  const token = sid ? credentialVault.getStoreData(sid).accessToken : null;

  if (!sid || !token) {
    alert("Store ID or Access Token is missing.");
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
    published: Boolean(prod.published_at),
  };
  showEditModal.value = true;
}

async function saveEditProduct() {
  const sid = formStore.storeId;
  const token = sid ? credentialVault.getStoreData(sid).accessToken : null;

  if (!sid || !token || !editProduct.value.id) return;

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
      published:
        editProduct.value.status === "active" && editProduct.value.published,
    },
  );
  if (success) {
    showEditModal.value = false;
  }
}

async function removeProduct(prodId: number) {
  if (!confirm("Are you sure you want to delete this product?")) return;
  const sid = formStore.storeId;
  const token = sid ? credentialVault.getStoreData(sid).accessToken : null;

  if (!sid || !token) return;

  await productStore.deleteProduct(sid, token, prodId);
}

async function refreshProducts() {
  const sid = formStore.storeId;
  const token = sid ? credentialVault.getStoreData(sid).accessToken : null;
  if (!sid || !token) return;
  await productStore.fetchAll(sid, token, 250);
}
</script>

<style scoped>
.page-title {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--text);
}
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
  overflow: visible !important;
}

.product-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 380px);
  gap: 16px;
  align-items: start;
}

.products-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  text-align: left;
}
.products-table th {
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
}
.product-title-text {
  font-weight: 600;
  color: var(--text);
}
.product-id-sub {
  font-size: 11px;
  color: var(--text-sub);
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
.btn-danger-text {
  color: var(--badge-cancelled-text);
}
.btn-danger-text:hover {
  background: var(--red-soft);
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
  color: var(--text-sub);
}
.tag-item.more {
  background: var(--blue-soft);
  color: var(--blue);
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
.popover-item:hover {
  background: var(--surface-soft);
}
.text-danger {
  color: var(--badge-cancelled-text) !important;
}
.product-actions-cell {
  display: flex;
}

.product-detail-card {
  padding: 16px;
  position: sticky;
  top: 0;
  max-height: calc(100vh - 180px);
  overflow: auto;
}
.detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border);
}
.detail-product {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.detail-thumb {
  width: 54px;
  height: 54px;
  border-radius: 6px;
  object-fit: cover;
  border: 1px solid var(--border);
  flex: 0 0 auto;
}
.detail-product-main {
  min-width: 0;
}
.detail-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  overflow-wrap: anywhere;
}
.detail-sub {
  margin-top: 3px;
  font-size: 11px;
  color: var(--text-sub);
}
.detail-meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding: 14px 0;
  border-bottom: 1px solid var(--border);
}
.detail-meta-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 8px;
  border-radius: 6px;
  background: var(--surface-soft);
}
.detail-meta-item span {
  font-size: 11px;
  color: var(--text-sub);
}
.detail-meta-item strong {
  font-size: 13px;
  color: var(--text);
  overflow-wrap: anywhere;
}
.detail-section {
  padding-top: 14px;
}
.detail-section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}
.detail-section-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 8px;
}
.detail-section-sub {
  margin-top: -4px;
  font-size: 12px;
  color: var(--text-sub);
}
.variant-list,
.location-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.variant-row,
.location-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
}
.variant-title,
.location-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}
.variant-sub,
.location-address {
  margin-top: 3px;
  font-size: 11px;
  color: var(--text-sub);
  overflow-wrap: anywhere;
}
.variant-inventory,
.inventory-count {
  font-size: 12px;
  font-weight: 700;
  color: var(--green);
  white-space: nowrap;
}
.location-main {
  min-width: 0;
}
.location-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  flex: 0 0 auto;
}
.location-status {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 600;
  background: var(--surface-soft);
  color: var(--text-sub);
}
.location-status.active {
  background: var(--badge-paid);
  color: var(--badge-paid-text);
}
.location-status.inactive {
  background: var(--badge-cancelled);
  color: var(--badge-cancelled-text);
}
.detail-loading,
.detail-error,
.detail-empty {
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-sub);
  background: var(--surface-soft);
}
.detail-error {
  color: var(--badge-cancelled-text);
  background: var(--badge-cancelled);
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

@media (max-width: 1080px) {
  .product-workspace {
    grid-template-columns: 1fr;
  }

  .product-detail-card {
    position: static;
    max-height: none;
  }
}
</style>
