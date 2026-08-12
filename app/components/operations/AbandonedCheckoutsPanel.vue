<script setup lang="ts">
import { ExternalLink } from "@lucide/vue";
import { useCommerceOpsStore } from "~/stores/commerceOps";
import { fmtDateTime, fmtMoney } from "~~/utils/order";
import { getSafeExternalUrl } from "~~/utils/safe-url";

const store = useCommerceOpsStore();
</script>

<template>
  <div class="ops-panel">
    <div class="ops-panel-toolbar">
      <div>
        <h3>Abandoned checkout recovery</h3>
        <p>Prioritize open carts and copy a secure Shopify recovery path.</p>
      </div>
    </div>
    <div v-if="store.errors.abandonedCheckouts" class="ops-resource-error" role="alert">
      <strong>Abandoned checkouts unavailable</strong>
      <span>{{ store.errors.abandonedCheckouts }}</span>
      <small
        >The app needs read_orders and the manage_abandoned_checkouts permission.</small
      >
    </div>
    <div
      v-else-if="
        store.loadingResources.includes('abandonedCheckouts') &&
        !store.abandonedCheckouts.length
      "
      class="ops-empty"
      role="status"
    >
      Loading abandoned checkouts…
    </div>
    <div v-else-if="store.abandonedCheckouts.length" class="ops-table-scroll">
      <table class="ops-table">
        <thead>
          <tr>
            <th>Checkout</th>
            <th>Customer</th>
            <th>Cart</th>
            <th>Total</th>
            <th>Last activity</th>
            <th>Status</th>
            <th class="ops-actions-column">Recovery</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="checkout in store.abandonedCheckouts" :key="checkout.id">
            <td>
              <strong>{{ checkout.name }}</strong>
            </td>
            <td>
              <span>{{ checkout.customerName || "Guest" }}</span>
              <small>{{ checkout.email || "No email" }}</small>
            </td>
            <td>
              <span>{{ checkout.itemCount }} items</span>
              <small>{{
                checkout.itemTitles.slice(0, 2).join(", ") || "Cart details unavailable"
              }}</small>
            </td>
            <td>
              {{
                fmtMoney(checkout.totalPrice.amount, checkout.totalPrice.currencyCode)
              }}
            </td>
            <td>{{ fmtDateTime(checkout.updatedAt) }}</td>
            <td>
              <span class="ops-status">{{
                checkout.completedAt ? "RECOVERED" : "OPEN"
              }}</span>
            </td>
            <td>
              <a
                v-if="!checkout.completedAt && getSafeExternalUrl(checkout.recoveryUrl)"
                :href="getSafeExternalUrl(checkout.recoveryUrl) || undefined"
                class="ops-link-button"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open recovery <ExternalLink :size="14" />
              </a>
              <small v-else>{{
                checkout.completedAt ? "Checkout completed" : "No safe URL"
              }}</small>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="ops-empty">No abandoned checkouts found.</div>
  </div>
</template>
