<script setup lang="ts">
import { Check, CircleX, PackageCheck, X } from "@lucide/vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useCommerceOpsStore } from "~/stores/commerceOps";
import type { ReturnAction, ReturnSummary } from "~~/types/shopify-operations";
import { fmtDateTime } from "~~/utils/order";

const store = useCommerceOpsStore();
const { storeId, token } = useActiveShopAuth();
const feedback = useStoreFeedback();
const { requestConfirmation } = useConfirmDialog();

async function runAction(item: ReturnSummary, action: ReturnAction) {
  const copy: Record<ReturnAction, { title: string; message: string; label: string }> =
    {
      approve: {
        title: "Approve return request",
        message: `Approve ${item.name} and move it into the open return workflow?`,
        label: "Approve",
      },
      decline: {
        title: "Decline return request",
        message: `Decline ${item.name} with reason “Other”? The customer will not be emailed automatically.`,
        label: "Decline",
      },
      close: {
        title: "Close return",
        message: `Mark ${item.name} complete? Use this only after inspection, financial processing and restocking decisions are finished.`,
        label: "Close return",
      },
      cancel: {
        title: "Cancel return",
        message: `Cancel ${item.name} and restore its items to fulfilled state?`,
        label: "Cancel return",
      },
    };
  if (
    !(await requestConfirmation({
      title: copy[action].title,
      message: copy[action].message,
      confirmLabel: copy[action].label,
      danger: action === "decline" || action === "cancel",
    }))
  ) {
    return;
  }
  const result = await store.actOnReturn(
    storeId.value,
    token.value,
    item.id,
    action,
    action === "decline" ? { declineReason: "OTHER", notifyCustomer: false } : {},
  );
  if (result) feedback.success(`Return ${action} succeeded.`);
  else feedback.error(store.mutationError, `Failed to ${action} the return.`);
}
</script>

<template>
  <div class="ops-panel">
    <div class="ops-panel-toolbar">
      <div>
        <h3>Returns & return requests</h3>
        <p>Review Shopify's return lifecycle separately from direct order refunds.</p>
      </div>
    </div>
    <div v-if="store.errors.returns" class="ops-resource-error" role="alert">
      <strong>Returns unavailable</strong>
      <span>{{ store.errors.returns }}</span>
      <small>Confirm the app has read_returns and write_returns scopes.</small>
    </div>
    <div
      v-else-if="store.loadingResources.includes('returns') && !store.returns.length"
      class="ops-empty"
      role="status"
    >
      Loading returns…
    </div>
    <div v-else-if="store.returns.length" class="ops-table-scroll">
      <table class="ops-table">
        <thead>
          <tr>
            <th>Return</th>
            <th>Order</th>
            <th>Items</th>
            <th>Reason</th>
            <th>Created</th>
            <th>Status</th>
            <th class="ops-actions-column">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in store.returns" :key="item.id">
            <td>
              <strong>{{ item.name }}</strong>
            </td>
            <td>
              <NuxtLink
                :to="{
                  path: `/order/${item.orderId.split('/').at(-1)}`,
                  query: { shop: storeId },
                }"
                class="ops-text-link"
              >
                {{ item.orderName }}
              </NuxtLink>
            </td>
            <td>
              <span>{{ item.totalQuantity }} units</span>
              <small>{{
                item.items
                  .slice(0, 2)
                  .map((line) => line.title)
                  .join(", ")
              }}</small>
            </td>
            <td>
              <span>{{ item.items[0]?.reason || "Unspecified" }}</span>
              <small v-if="item.items[0]?.customerNote">{{
                item.items[0].customerNote
              }}</small>
            </td>
            <td>{{ fmtDateTime(item.createdAt) }}</td>
            <td>
              <span class="ops-status">{{ item.status }}</span>
            </td>
            <td>
              <div class="ops-row-actions">
                <template v-if="item.status === 'REQUESTED'">
                  <BaseButton
                    variant="primary"
                    :disabled="store.isMutating"
                    @click="runAction(item, 'approve')"
                  >
                    <template #icon><Check /></template>
                    Approve
                  </BaseButton>
                  <BaseButton
                    variant="danger-ghost"
                    :disabled="store.isMutating"
                    @click="runAction(item, 'decline')"
                  >
                    <template #icon><CircleX /></template>
                    Decline
                  </BaseButton>
                </template>
                <template v-else-if="item.status === 'OPEN'">
                  <BaseButton
                    :disabled="store.isMutating"
                    @click="runAction(item, 'close')"
                  >
                    <template #icon><PackageCheck /></template>
                    Close
                  </BaseButton>
                  <BaseButton
                    variant="danger-ghost"
                    icon-only
                    :disabled="store.isMutating"
                    aria-label="Cancel return"
                    @click="runAction(item, 'cancel')"
                  >
                    <template #icon><X /></template>
                  </BaseButton>
                </template>
                <small v-else>No action required</small>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="ops-empty">
      No returns were found in the 50 most recently updated orders.
    </div>
  </div>
</template>
