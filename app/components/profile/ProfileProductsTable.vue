<script setup lang="ts">
import type { ShopifyProduct } from "~~/types/shopify";

defineProps<{
  products: ShopifyProduct[];
  loading?: boolean;
  error?: string | null;
}>();

function getProductImage(product: ShopifyProduct): string {
  return product?.image?.src || product?.images?.[0]?.src || "";
}

function getProductTags(product: ShopifyProduct): string[] {
  return String(product?.tags || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function formatProductDate(value: string | undefined) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString();
}
</script>

<template>
  <section class="profile-card">
    <div class="profile-card-head">
      <h2>Products</h2>
      <span class="field-count">{{ products.length }}</span>
    </div>

    <div v-if="loading && !products.length" class="empty-state">
      Loading products...
    </div>
    <div v-else-if="error" class="empty-state is-error">
      {{ error }}
    </div>
    <div v-else-if="!products.length" class="empty-state">
      No products found for this shop.
    </div>
    <div v-else class="table-wrap">
      <table class="products-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Status</th>
            <th>Vendor</th>
            <th>Type</th>
            <th>Tags</th>
            <th>Variants</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="product in products" :key="product.id">
            <td>
              <div class="product-cell">
                <img
                  v-if="getProductImage(product)"
                  :src="getProductImage(product)"
                  class="product-thumb"
                  alt=""
                />
                <span v-else class="product-thumb is-empty">No img</span>
                <div class="product-copy">
                  <span class="product-title">{{ product.title || "-" }}</span>
                  <span class="product-id">ID: {{ product.id || "-" }}</span>
                </div>
              </div>
            </td>
            <td>
              <span
                class="status-pill"
                :class="{
                  'is-active': product.status === 'active',
                  'is-draft': product.status === 'draft',
                }"
              >
                {{ product.status || "-" }}
              </span>
            </td>
            <td>{{ product.vendor || "-" }}</td>
            <td>{{ product.product_type || "-" }}</td>
            <td>
              <div v-if="getProductTags(product).length" class="tags-list">
                <span
                  v-for="tag in getProductTags(product)"
                  :key="`${product.id}-${tag}`"
                  class="tag-item"
                >
                  {{ tag }}
                </span>
              </div>
              <span v-else>-</span>
            </td>
            <td>{{ product.variants?.length || 0 }}</td>
            <td>{{ formatProductDate(product.updated_at) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.profile-card {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
}

.profile-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
}

.profile-card-head h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 700;
}

.field-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  min-height: 22px;
  border-radius: 999px;
  background: var(--surface-soft);
  color: var(--text-sub);
  font-size: 11px;
  font-weight: 800;
}

.table-wrap {
  overflow-x: auto;
}

.products-table {
  width: 100%;
  min-width: 860px;
  border-collapse: collapse;
}

.products-table th {
  padding: 11px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--surface-soft);
  color: var(--text-sub);
  text-align: left;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.products-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  color: var(--text-primary);
  font-size: 13px;
  vertical-align: middle;
}

.products-table tbody tr:last-child td {
  border-bottom: none;
}

.product-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 260px;
}

.product-thumb {
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  border: 1px solid var(--border);
  border-radius: 6px;
  object-fit: cover;
}

.product-thumb.is-empty {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 700;
  text-align: center;
}

.product-copy {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.product-title {
  color: var(--text-primary);
  font-weight: 700;
  overflow-wrap: anywhere;
}

.product-id {
  color: var(--text-sub);
  font-size: 11px;
  font-weight: 600;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 22px;
  border-radius: 999px;
  padding: 0 9px;
  background: var(--badge-archived);
  color: var(--badge-archived-text);
  font-size: 11px;
  font-weight: 800;
  text-transform: capitalize;
}

.status-pill.is-active {
  background: var(--badge-paid);
  color: var(--badge-paid-text);
}

.status-pill.is-draft {
  background: var(--badge-pending);
  color: var(--badge-pending-text);
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.tag-item {
  border-radius: 999px;
  background: var(--surface-soft);
  color: var(--text-sub);
  padding: 2px 7px;
  font-size: 11px;
  font-weight: 700;
}

.empty-state {
  padding: 34px 16px;
  color: var(--text-sub);
  text-align: center;
  font-size: 13px;
}

.empty-state.is-error {
  color: var(--red);
}
</style>
