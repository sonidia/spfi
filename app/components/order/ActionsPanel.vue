<script setup lang="ts">
import { ref, watch } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useOrderStore } from "~/stores/order";
import type { ShopifyOrder } from "~~/types/shopify";
import type { OrderCancelInput } from "~~/types/shopify-order";

const props = defineProps<{ order: ShopifyOrder }>();
const emit = defineEmits<{ deleted: [] }>();
const orderStore = useOrderStore();
const { storeId, token, isReady } = useActiveShopAuth();
const mode = ref<"idle" | "edit" | "cancel">("idle");
const note = ref("");
const tags = ref("");
const email = ref("");
const phone = ref("");
const cancelReason = ref<OrderCancelInput["reason"]>("other");
const cancelAmount = ref("");
const notifyCustomer = ref(false);

watch(
  () => props.order,
  (order) => {
    note.value = order.note || "";
    tags.value = order.tags || "";
    email.value = order.email || "";
    phone.value = order.phone || "";
  },
  { immediate: true },
);

async function saveOrder() {
  if (!isReady.value) return;
  const updated = await orderStore.updateOrder(
    storeId.value,
    token.value,
    props.order.id,
    {
      note: note.value || null,
      tags: tags.value,
      email: email.value || null,
      phone: phone.value || null,
    },
  );
  if (updated) mode.value = "idle";
}

async function changeOpenState() {
  if (!isReady.value) return;
  if (props.order.closed_at) {
    await orderStore.openOrder(storeId.value, token.value, props.order.id);
  } else {
    await orderStore.closeOrder(storeId.value, token.value, props.order.id);
  }
}

async function cancelOrder() {
  if (!isReady.value) return;
  const input: OrderCancelInput = {
    reason: cancelReason.value,
    email: notifyCustomer.value,
    ...(cancelAmount.value
      ? { amount: cancelAmount.value, currency: props.order.currency }
      : {}),
  };
  const cancelled = await orderStore.cancelOrder(
    storeId.value,
    token.value,
    props.order.id,
    input,
  );
  if (cancelled) mode.value = "idle";
}

async function deleteOrder() {
  if (!isReady.value) return;
  if (!window.confirm(`Delete ${props.order.name || `order ${props.order.id}`}?`)) {
    return;
  }
  const deleted = await orderStore.deleteOrder(
    storeId.value,
    token.value,
    props.order.id,
  );
  if (deleted) emit("deleted");
}
</script>

<template>
  <section class="management-panel" aria-labelledby="order-actions-title">
    <header>
      <div>
        <span>Order endpoint actions</span>
        <h2 id="order-actions-title">Manage order</h2>
      </div>
      <div class="action-row">
        <button type="button" @click="mode = mode === 'edit' ? 'idle' : 'edit'">
          {{ mode === "edit" ? "Close editor" : "Edit" }}
        </button>
        <button
          type="button"
          :disabled="Boolean(order.cancelled_at) || orderStore.isMutating"
          @click="changeOpenState"
        >
          {{ order.closed_at ? "Re-open" : "Close" }}
        </button>
        <button
          type="button"
          :disabled="Boolean(order.cancelled_at) || orderStore.isMutating"
          @click="mode = mode === 'cancel' ? 'idle' : 'cancel'"
        >
          Cancel
        </button>
        <button class="is-danger" type="button" :disabled="orderStore.isMutating" @click="deleteOrder">
          Delete
        </button>
      </div>
    </header>

    <div v-if="mode === 'edit'" class="editor-grid">
      <label><span>Note</span><textarea v-model="note" rows="3" /></label>
      <label><span>Tags</span><input v-model="tags" /></label>
      <label><span>Email</span><input v-model="email" type="email" /></label>
      <label><span>Phone</span><input v-model="phone" type="tel" /></label>
      <div class="editor-actions">
        <button type="button" @click="mode = 'idle'">Discard</button>
        <button class="is-primary" type="button" :disabled="orderStore.isMutating" @click="saveOrder">
          Save changes
        </button>
      </div>
    </div>

    <div v-else-if="mode === 'cancel'" class="cancel-grid">
      <label>
        <span>Reason</span>
        <select v-model="cancelReason">
          <option value="customer">Customer</option>
          <option value="inventory">Inventory</option>
          <option value="fraud">Fraud</option>
          <option value="declined">Declined</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label><span>Refund amount</span><input v-model="cancelAmount" inputmode="decimal" /></label>
      <label class="check-row"><input v-model="notifyCustomer" type="checkbox" /><span>Notify customer</span></label>
      <div class="editor-actions">
        <button type="button" @click="mode = 'idle'">Back</button>
        <button class="is-danger-solid" type="button" :disabled="orderStore.isMutating" @click="cancelOrder">
          Confirm cancellation
        </button>
      </div>
    </div>

    <div v-if="orderStore.mutationError" class="panel-error" role="alert">
      {{ orderStore.mutationError }}
    </div>
  </section>
</template>

<style scoped>
.management-panel { margin-bottom: 16px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); overflow: hidden; }
header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 16px; }
header span, label > span { color: var(--text-sub); font-size: 11px; font-weight: 700; }
h2 { color: var(--text); font-size: 15px; }
.action-row, .editor-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
button { min-height: 32px; padding: 0 11px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }
button:hover { background: var(--surface-soft); }
button:disabled { opacity: 0.5; cursor: not-allowed; }
button.is-danger { color: var(--red); }
button.is-primary { border-color: var(--green); background: var(--green); color: white; }
button.is-danger-solid { border-color: var(--red); background: var(--red); color: white; }
.editor-grid, .cancel-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; padding: 16px; border-top: 1px solid var(--border); background: var(--surface-soft); }
label { display: grid; gap: 5px; min-width: 0; }
input, textarea, select { width: 100%; border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px; background: var(--surface); color: var(--text); font: inherit; }
textarea { resize: vertical; }
.check-row { display: flex; align-items: center; align-self: end; min-height: 38px; gap: 8px; }
.check-row input { width: 16px; }
.editor-actions { grid-column: 1 / -1; }
.panel-error { padding: 10px 16px; border-top: 1px solid rgba(180, 49, 43, 0.2); background: var(--red-soft); color: var(--red); font-size: 12px; }

@media (max-width: 760px) {
  header { align-items: flex-start; flex-direction: column; }
  .editor-grid, .cancel-grid { grid-template-columns: 1fr; }
  .action-row { justify-content: flex-start; }
}
</style>
