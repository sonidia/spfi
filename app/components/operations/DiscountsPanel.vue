<script setup lang="ts">
import { Pause, Play, Plus } from "@lucide/vue";
import { ref } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useCommerceOpsStore } from "~/stores/commerceOps";
import type { DiscountAction, DiscountSummary } from "~~/types/shopify-operations";
import { fmtDateTime } from "~~/utils/order";

const store = useCommerceOpsStore();
const { storeId, token } = useActiveShopAuth();
const feedback = useStoreFeedback();
const { requestConfirmation } = useConfirmDialog();
const isCreateOpen = ref(false);

async function runAction(discount: DiscountSummary, action: DiscountAction) {
  if (
    !(await requestConfirmation({
      title: `${action === "activate" ? "Activate" : "Pause"} discount`,
      message: `${action === "activate" ? "Make" : "Stop"} ${discount.code || discount.title} ${
        action === "activate" ? "available at checkout" : "from being used at checkout"
      }?`,
      confirmLabel: action === "activate" ? "Activate" : "Pause",
      danger: false,
    }))
  ) {
    return;
  }
  const result = await store.actOnDiscount(
    storeId.value,
    token.value,
    discount.id,
    action,
  );
  if (result) feedback.success(`Discount ${action}d.`);
  else feedback.error(store.mutationError, `Failed to ${action} the discount.`);
}
</script>

<template>
  <div class="ops-panel">
    <div class="ops-panel-toolbar">
      <div>
        <h3>Discounts & modern price rules</h3>
        <p>Uses Shopify's current discount model for code and automatic promotions.</p>
      </div>
      <BaseButton variant="primary" @click="isCreateOpen = true">
        <template #icon><Plus /></template>
        New code
      </BaseButton>
    </div>
    <div v-if="store.errors.discounts" class="ops-resource-error" role="alert">
      <strong>Discounts unavailable</strong>
      <span>{{ store.errors.discounts }}</span>
      <small>Confirm the app has read_discounts and write_discounts scopes.</small>
    </div>
    <div
      v-else-if="
        store.loadingResources.includes('discounts') && !store.discounts.length
      "
      class="ops-empty"
      role="status"
    >
      Loading discounts…
    </div>
    <div v-else-if="store.discounts.length" class="ops-table-scroll">
      <table class="ops-table">
        <thead>
          <tr>
            <th>Promotion</th>
            <th>Code</th>
            <th>Rule</th>
            <th>Usage</th>
            <th>Schedule</th>
            <th>Status</th>
            <th class="ops-actions-column">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="discount in store.discounts" :key="discount.id">
            <td>
              <strong>{{ discount.title }}</strong>
              <small>{{ discount.type.replace(/^Discount/, "") }}</small>
            </td>
            <td>
              <code>{{ discount.code || "Automatic" }}</code>
            </td>
            <td class="ops-rule-cell">
              {{ discount.summary || "Configured in Shopify" }}
            </td>
            <td>{{ discount.usageCount }}</td>
            <td>
              <span>{{
                discount.startsAt ? fmtDateTime(discount.startsAt) : "Immediate"
              }}</span>
              <small v-if="discount.endsAt"
                >Ends {{ fmtDateTime(discount.endsAt) }}</small
              >
            </td>
            <td>
              <span class="ops-status">{{ discount.status }}</span>
            </td>
            <td>
              <div v-if="discount.code" class="ops-row-actions">
                <BaseButton
                  v-if="discount.status !== 'ACTIVE'"
                  :disabled="store.isMutating"
                  @click="runAction(discount, 'activate')"
                >
                  <template #icon><Play /></template>
                  Activate
                </BaseButton>
                <BaseButton
                  v-else
                  :disabled="store.isMutating"
                  @click="runAction(discount, 'deactivate')"
                >
                  <template #icon><Pause /></template>
                  Pause
                </BaseButton>
              </div>
              <small v-else>Manage automatic rule in Shopify</small>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="ops-empty">No discounts found.</div>

    <OperationsCreateDiscountModal
      v-if="isCreateOpen"
      @close="isCreateOpen = false"
      @created="isCreateOpen = false"
    />
  </div>
</template>
