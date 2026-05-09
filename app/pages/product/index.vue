<script lang="ts" setup>
import { useFormStore } from "~/stores/form";

const formStore = useFormStore();

// ── Local state ──
const selectedStoreId = ref<string>("");
const products = ref<any[]>([]);
const isLoading = ref(false);
const errorMsg = ref("");
const successMsg = ref("");

// Modals
const showCreateModal = ref(false);
const showEditModal = ref(false);

const newProduct = ref({
  title: "",
  body_html: "",
  vendor: "",
  product_type: "",
});

const editProduct = ref({
  id: null as number | null,
  title: "",
  body_html: "",
  vendor: "",
  product_type: "",
});

// ── On mount ──
onMounted(() => {
  formStore.loadKnownStores();
  if (formStore.storeId && formStore.knownStores.includes(formStore.storeId)) {
    selectedStoreId.value = formStore.storeId;
    fetchProducts();
  } else if (formStore.knownStores.length > 0) {
    selectedStoreId.value = formStore.knownStores[0];
    fetchProducts();
  }
});

watch(selectedStoreId, (newStoreId) => {
  if (newStoreId) {
    formStore.storeId = newStoreId;
    fetchProducts();
  }
});

// ── Helper to get token ──
function getTokenForStore(id: string) {
  const cookie = useCookie<any>(id);
  const data = cookie.value;
  return data?.accessToken || "";
}

// ── API Actions ──
async function fetchProducts() {
  if (!selectedStoreId.value) return;
  const token = getTokenForStore(selectedStoreId.value);
  if (!token) {
    errorMsg.value = `No access token found for store: ${selectedStoreId.value}. Connect it in Manager first.`;
    products.value = [];
    return;
  }

  isLoading.value = true;
  errorMsg.value = "";
  successMsg.value = "";
  try {
    const res: any = await $fetch("/api/product/all", {
      method: "POST",
      body: {
        storeId: selectedStoreId.value,
        token,
        limit: 50,
      },
    });
    products.value = res.products || [];
  } catch (err: any) {
    errorMsg.value = err.data?.statusMessage || err.message || "Failed to fetch products";
    products.value = [];
  } finally {
    isLoading.value = false;
  }
}

async function createProduct() {
  if (!selectedStoreId.value) return;
  if (!newProduct.value.title.trim()) {
    errorMsg.value = "Title is required";
    return;
  }

  const token = getTokenForStore(selectedStoreId.value);
  isLoading.value = true;
  errorMsg.value = "";
  
  try {
    await $fetch("/api/product/create", {
      method: "POST",
      body: {
        storeId: selectedStoreId.value,
        token,
        product: {
          title: newProduct.value.title,
          body_html: newProduct.value.body_html,
          vendor: newProduct.value.vendor,
          product_type: newProduct.value.product_type,
        },
      },
    });
    successMsg.value = "Product created successfully!";
    showCreateModal.value = false;
    newProduct.value = { title: "", body_html: "", vendor: "", product_type: "" };
    fetchProducts();
  } catch (err: any) {
    errorMsg.value = err.data?.statusMessage || err.message || "Create failed";
  } finally {
    isLoading.value = false;
  }
}

function openEditModal(prod: any) {
  editProduct.value = {
    id: prod.id,
    title: prod.title || "",
    body_html: prod.body_html || "",
    vendor: prod.vendor || "",
    product_type: prod.product_type || "",
  };
  showEditModal.value = true;
}

async function saveEditProduct() {
  if (!selectedStoreId.value || !editProduct.value.id) return;
  const token = getTokenForStore(selectedStoreId.value);
  isLoading.value = true;
  errorMsg.value = "";

  try {
    await $fetch(`/api/product/${editProduct.value.id}`, {
      method: "PUT",
      body: {
        storeId: selectedStoreId.value,
        token,
        product: {
          id: editProduct.value.id,
          title: editProduct.value.title,
          body_html: editProduct.value.body_html,
          vendor: editProduct.value.vendor,
          product_type: editProduct.value.product_type,
        },
      },
    });
    successMsg.value = "Product updated successfully!";
    showEditModal.value = false;
    fetchProducts();
  } catch (err: any) {
    errorMsg.value = err.data?.statusMessage || err.message || "Update failed";
  } finally {
    isLoading.value = false;
  }
}

async function removeProduct(prodId: number) {
  if (!confirm("Are you sure you want to delete this product?")) return;
  if (!selectedStoreId.value) return;

  const token = getTokenForStore(selectedStoreId.value);
  isLoading.value = true;
  errorMsg.value = "";

  try {
    await $fetch(`/api/product/${prodId}`, {
      method: "DELETE",
      body: {
        storeId: selectedStoreId.value,
        token,
      },
    });
    successMsg.value = "Product deleted successfully!";
    fetchProducts();
  } catch (err: any) {
    errorMsg.value = err.data?.statusMessage || err.message || "Delete failed";
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div class="product-page">
    <div class="page-header">
      <h1 class="page-title">Products Management</h1>
      <p class="page-sub">Manage products across your Shopify stores</p>
    </div>

    <!-- Store Selector & Actions -->
    <section class="card">
      <div class="card-head">
        <div class="store-selector">
          <label>Select Store:</label>
          <select v-model="selectedStoreId" class="inp select-inp">
            <option disabled value="">-- Choose a store --</option>
            <option v-for="store in formStore.knownStores" :key="store" :value="store">
              {{ store }}
            </option>
          </select>
        </div>
        <div class="card-actions">
          <button class="btn-primary" @click="showCreateModal = true" :disabled="!selectedStoreId">
            Add Product
          </button>
          <button class="btn-outline" @click="fetchProducts" :disabled="!selectedStoreId || isLoading">
            {{ isLoading ? 'Refreshing...' : 'Refresh' }}
          </button>
        </div>
      </div>
      
      <div v-if="errorMsg" class="alert alert-err" style="margin: 10px 20px;">{{ errorMsg }}</div>
      <div v-if="successMsg" class="alert alert-ok" style="margin: 10px 20px;">{{ successMsg }}</div>
    </section>

    <!-- Product List -->
    <section class="card" v-if="selectedStoreId">
      <div class="card-head">
        <div class="card-head-title">
          <span class="card-title">Products for {{ selectedStoreId }}</span>
          <span class="count-badge">{{ products.length }}</span>
        </div>
      </div>

      <div v-if="isLoading && products.length === 0" class="empty-state">
        Loading products...
      </div>
      
      <div v-else-if="products.length === 0" class="empty-state">
        No products found. Create one.
      </div>

      <div class="product-row" v-for="prod in products" :key="prod.id" v-else>
        <div class="product-info">
          <img v-if="prod.image" :src="prod.image.src" class="product-thumb" alt="Product Image" />
          <div v-else class="product-thumb empty-thumb">No Img</div>
          
          <div class="product-details">
            <div class="product-title">{{ prod.title }}</div>
            <div class="product-meta">
              <span v-if="prod.vendor" class="tag tag-outline">Vendor: {{ prod.vendor }}</span>
              <span v-if="prod.status" class="tag" :class="prod.status === 'active' ? 'tag-ok' : 'tag-warn'">Status: {{ prod.status }}</span>
            </div>
          </div>
        </div>
        <div class="product-actions">
          <button class="btn-outline" @click="openEditModal(prod)" :disabled="isLoading">Edit</button>
          <button class="btn-danger" @click="removeProduct(prod.id)" :disabled="isLoading">Delete</button>
        </div>
      </div>
    </section>

    <div v-else class="empty-state">
      Please select a store to view products.
    </div>

    <!-- Create Modal -->
    <div v-if="showCreateModal" class="modal-backdrop" @click.self="showCreateModal = false">
      <div class="modal-card">
        <div class="modal-head">
          <h3 class="modal-title">Create Product</h3>
          <button class="btn-ghost" @click="showCreateModal = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="field field-full">
            <label class="field-label">Title <span style="color:red">*</span></label>
            <input v-model="newProduct.title" type="text" class="inp" placeholder="Awesome Product" />
          </div>
          <div class="field field-full">
            <label class="field-label">Vendor</label>
            <input v-model="newProduct.vendor" type="text" class="inp" placeholder="My Vendor" />
          </div>
          <div class="field field-full">
            <label class="field-label">Product Type</label>
            <input v-model="newProduct.product_type" type="text" class="inp" placeholder="e.g. Shirts" />
          </div>
          <div class="field field-full">
            <label class="field-label">Description (HTML)</label>
            <textarea v-model="newProduct.body_html" class="inp" rows="4" placeholder="<p>Information</p>"></textarea>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-outline" @click="showCreateModal = false">Cancel</button>
          <button class="btn-primary" @click="createProduct" :disabled="isLoading">Create Product</button>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <div v-if="showEditModal" class="modal-backdrop" @click.self="showEditModal = false">
      <div class="modal-card">
        <div class="modal-head">
          <h3 class="modal-title">Edit Product</h3>
          <button class="btn-ghost" @click="showEditModal = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="field field-full">
            <label class="field-label">Title <span style="color:red">*</span></label>
            <input v-model="editProduct.title" type="text" class="inp" />
          </div>
          <div class="field field-full">
            <label class="field-label">Vendor</label>
            <input v-model="editProduct.vendor" type="text" class="inp" />
          </div>
          <div class="field field-full">
            <label class="field-label">Product Type</label>
            <input v-model="editProduct.product_type" type="text" class="inp" />
          </div>
          <div class="field field-full">
            <label class="field-label">Description (HTML)</label>
            <textarea v-model="editProduct.body_html" class="inp" rows="4"></textarea>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-outline" @click="showEditModal = false">Cancel</button>
          <button class="btn-primary" @click="saveEditProduct" :disabled="isLoading">Save Changes</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.product-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 28px 20px 48px;
  font-size: 14px;
}
.page-header {
  margin-bottom: 24px;
}
.page-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 4px;
}
.page-sub {
  font-size: 13px;
  color: var(--text-secondary, #6d6d6d);
}
.card {
  background: var(--surface);
  border-radius: var(--radius, 8px);
  box-shadow: var(--shadow);
  margin-bottom: 20px;
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 18px;
  border-bottom: 1px solid var(--border);
}
.card-head-title {
  display: flex;
  align-items: center;
  gap: 8px;
}
.card-actions {
  display: flex;
  gap: 8px;
}
.card-title {
  font-weight: 600;
  font-size: 14px;
}
.count-badge {
  background: #eee;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
}
.store-selector {
  display: flex;
  align-items: center;
  gap: 12px;
}
.select-inp {
  min-width: 200px;
}
.product-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 18px;
  border-bottom: 1px solid var(--border);
}
.product-row:last-child {
  border-bottom: none;
}
.product-info {
  display: flex;
  align-items: center;
  gap: 16px;
}
.product-thumb {
  width: 50px;
  height: 50px;
  border-radius: 6px;
  object-fit: cover;
  border: 1px solid #ddd;
}
.empty-thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f4f4f4;
  color: #aaa;
  font-size: 11px;
}
.product-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.product-title {
  font-weight: 600;
  font-size: 15px;
}
.product-meta {
  display: flex;
  gap: 8px;
}
.product-actions {
  display: flex;
  gap: 8px;
}
.empty-state {
  padding: 40px;
  text-align: center;
  color: #888;
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
  max-width: 500px;
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;
  max-height: 90vh;
}
.modal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}
.modal-title {
  margin: 0;
  font-size: 16px;
}
.modal-body {
  padding: 20px;
  overflow-y: auto;
}
.modal-actions {
  padding: 16px 20px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* Base styles adopted from app theme */
.btn-primary {
  background: #10b981;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-outline {
  background: transparent;
  color: #333;
  border: 1px solid #ddd;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}
.btn-outline:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-danger {
  background: #ef4444;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}
.btn-danger:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-ghost {
  background: transparent;
  border: none;
  font-size: 18px;
  cursor: pointer;
}
.inp {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-family: inherit;
}
.field { margin-bottom: 16px; }
.field-label { display: block; margin-bottom: 6px; font-weight: 500; font-size: 13px; }
.alert { padding: 12px 16px; border-radius: 4px; margin-bottom: 16px; }
.alert-ok { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
.alert-err { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
.tag { font-size: 11px; padding: 2px 6px; border-radius: 4px; background: #eee; }
.tag-ok { background: #d1fae5; color: #065f46; }
.tag-warn { background: #fef3c7; color: #92400e; }
.tag-outline { border: 1px solid #ddd; background: transparent; }
</style>
