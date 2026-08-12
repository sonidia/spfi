<script setup lang="ts">
import { Mail, Plus, Trash2 } from "@lucide/vue";
import { ref } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useCommerceOpsStore } from "~/stores/commerceOps";
import type { DraftOrderAction, DraftOrderSummary } from "~~/types/shopify-operations";
import { fmtDateTime, fmtMoney } from "~~/utils/order";

const store = useCommerceOpsStore();
const { storeId, token } = useActiveShopAuth();
const feedback = useStoreFeedback();
const { requestConfirmation } = useConfirmDialog();
const isCreateOpen = ref(false);

async function runAction(draft: DraftOrderSummary, action: DraftOrderAction) {
  const messages: Record<DraftOrderAction, string> = {
    complete:
      "Complete this draft and mark it paid? Shopify will reserve inventory and create an order.",
    invoice: `Send the secure invoice link to ${draft.email || "the draft customer"}?`,
    delete: `Delete ${draft.name}? This cannot be undone.`,
  };
  if (
    !(await requestConfirmation({
      title: action === "delete" ? "Delete draft order" : "Confirm draft action",
      message: messages[action],
      confirmLabel: action === "complete" ? "Complete & mark paid" : action,
      danger: action === "delete",
    }))
  ) {
    return;
  }
  const result = await store.actOnDraft(storeId.value, token.value, draft.id, action);
  if (result) feedback.success(`Draft order ${action} succeeded.`);
  else feedback.error(store.mutationError, `Failed to ${action} the draft order.`);
}
</script>

<template>
  <div class="ops-panel">
    <div class="ops-panel-toolbar">
      <div>
        <h3>Draft order queue</h3>
        <p>
          Create manual sales, send invoices, or convert confirmed drafts to paid
          orders.
        </p>
      </div>
      <BaseButton variant="primary" @click="isCreateOpen = true">
        <template #icon><Plus /></template>
        New draft
      </BaseButton>
    </div>

    <div v-if="store.errors.draftOrders" class="ops-resource-error" role="alert">
      <strong>Draft orders unavailable</strong>
      <span>{{ store.errors.draftOrders }}</span>
    </div>
    <div
      v-else-if="
        store.loadingResources.includes('draftOrders') && !store.draftOrders.length
      "
      class="ops-empty"
      role="status"
    >
      Loading draft orders…
    </div>
    <div v-else-if="store.draftOrders.length" class="ops-table-scroll">
      <table class="ops-table">
        <thead>
          <tr>
            <th>Draft</th>
            <th>Customer</th>
            <th>Items</th>
            <th>Total</th>
            <th>Updated</th>
            <th>Status</th>
            <th class="ops-actions-column">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="draft in store.draftOrders" :key="draft.id">
            <td>
              <strong>{{ draft.name }}</strong>
            </td>
            <td>
              <span>{{ draft.customerName || "Guest" }}</span>
              <small>{{ draft.email || "No email" }}</small>
            </td>
            <td>{{ draft.itemCount }}</td>
            <td>
              {{ fmtMoney(draft.totalPrice.amount, draft.totalPrice.currencyCode) }}
            </td>
            <td>{{ fmtDateTime(draft.updatedAt) }}</td>
            <td>
              <span class="ops-status">{{ draft.status }}</span>
            </td>
            <td>
              <div class="ops-row-actions">
                <BaseButton
                  v-if="draft.email"
                  :disabled="store.isMutating"
                  @click="runAction(draft, 'invoice')"
                >
                  <template #icon><Mail /></template>
                  Invoice
                </BaseButton>
                <BaseButton
                  variant="primary"
                  :disabled="store.isMutating || draft.status === 'COMPLETED'"
                  @click="runAction(draft, 'complete')"
                >
                  Complete
                </BaseButton>
                <BaseButton
                  variant="danger-ghost"
                  icon-only
                  :disabled="store.isMutating"
                  aria-label="Delete draft"
                  @click="runAction(draft, 'delete')"
                >
                  <template #icon><Trash2 /></template>
                </BaseButton>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="ops-empty">No draft orders in this store.</div>

    <OperationsCreateDraftModal
      v-if="isCreateOpen"
      @close="isCreateOpen = false"
      @created="isCreateOpen = false"
    />
  </div>
</template>
