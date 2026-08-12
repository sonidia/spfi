<script setup lang="ts">
import {
  Archive,
  ArrowLeft,
  Ban,
  Pencil,
  RotateCcw,
  Save,
  Trash2,
  Undo2,
  X,
} from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useOrderStore } from "~/stores/order";
import type { ShopifyOrder } from "~~/types/shopify";
import type { OrderCancelInput } from "~~/types/shopify-order";

const props = defineProps<{ order: ShopifyOrder }>();
const emit = defineEmits<{ deleted: [] }>();
const orderStore = useOrderStore();
const { storeId, token, isReady } = useActiveShopAuth();
const { t } = useLocalization();
const { requestConfirmation } = useConfirmDialog();
const mode = ref<"idle" | "edit" | "cancel">("idle");
const note = ref("");
const tags = ref("");
const email = ref("");
const phone = ref("");
const cancelReason = ref<OrderCancelInput["reason"]>("other");
const cancelAmount = ref("");
const notifyCustomer = ref(false);
const cancelReasonOptions = computed(() =>
  (["customer", "inventory", "fraud", "declined", "other"] as const).map((value) => ({
    value,
    label: t(`order.cancelReason.${value}`),
    description: t(`order.cancelReason.${value}Description`),
  })),
);

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

function setCancelReason(value: unknown) {
  if (["customer", "inventory", "fraud", "declined", "other"].includes(String(value))) {
    cancelReason.value = value as OrderCancelInput["reason"];
  }
}

async function deleteOrder() {
  if (!isReady.value) return;
  if (
    !(await requestConfirmation({
      title: t("confirm.deleteTitle"),
      message: t("order.deleteConfirm", {
        name: props.order.name || `#${props.order.id}`,
      }),
      confirmLabel: t("common.delete"),
    }))
  ) {
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
      <div class="panel-title">
        <Pencil aria-hidden="true" />
        <h2 id="order-actions-title">{{ t("order.manage") }}</h2>
      </div>
      <div class="action-row">
        <BaseButton @click="mode = mode === 'edit' ? 'idle' : 'edit'">
          <template #icon><X v-if="mode === 'edit'" /><Pencil v-else /></template>
          {{ mode === "edit" ? t("order.closeEditor") : t("common.edit") }}
        </BaseButton>
        <BaseButton
          :disabled="Boolean(order.cancelled_at) || orderStore.isMutating"
          @click="changeOpenState"
        >
          <template #icon
            ><RotateCcw v-if="order.closed_at" /><Archive v-else
          /></template>
          {{ order.closed_at ? t("order.reopen") : t("common.close") }}
        </BaseButton>
        <BaseButton
          :disabled="Boolean(order.cancelled_at) || orderStore.isMutating"
          @click="mode = mode === 'cancel' ? 'idle' : 'cancel'"
        >
          <template #icon><Ban /></template>
          {{ t("common.cancel") }}
        </BaseButton>
        <BaseButton
          variant="danger-ghost"
          :disabled="orderStore.isMutating"
          @click="deleteOrder"
        >
          <template #icon><Trash2 /></template>
          {{ t("common.delete") }}
        </BaseButton>
      </div>
    </header>

    <div v-if="mode === 'edit'" class="editor-grid">
      <label>
        <span>{{ t("order.note") }}</span>
        <textarea v-model="note" class="editor-textarea" rows="3" />
      </label>
      <label>
        <span>{{ t("order.tags") }}</span>
        <textarea v-model="tags" class="editor-textarea" rows="3" />
      </label>
      <label
        ><span>{{ t("order.email") }}</span
        ><input v-model="email" type="email"
      /></label>
      <label
        ><span>{{ t("order.phone") }}</span
        ><input v-model="phone" type="tel"
      /></label>
      <div class="editor-actions">
        <BaseButton @click="mode = 'idle'">
          <template #icon><Undo2 /></template>
          {{ t("order.discard") }}
        </BaseButton>
        <BaseButton
          variant="primary"
          :loading="orderStore.isMutating"
          @click="saveOrder"
        >
          <template #icon><Save /></template>
          {{ t("order.saveChanges") }}
        </BaseButton>
      </div>
    </div>

    <div v-else-if="mode === 'cancel'" class="cancel-grid">
      <label>
        <span>{{ t("order.reason") }}</span>
        <BaseSelect
          :model-value="cancelReason"
          :options="cancelReasonOptions"
          @update:model-value="setCancelReason"
        />
      </label>
      <label
        ><span>{{ t("order.refundAmount") }}</span
        ><input v-model="cancelAmount" inputmode="decimal"
      /></label>
      <label class="check-row"
        ><input v-model="notifyCustomer" type="checkbox" /><span>{{
          t("order.notifyCustomer")
        }}</span></label
      >
      <div class="editor-actions">
        <BaseButton @click="mode = 'idle'">
          <template #icon><ArrowLeft /></template>
          {{ t("order.back") }}
        </BaseButton>
        <BaseButton
          variant="danger"
          :loading="orderStore.isMutating"
          @click="cancelOrder"
        >
          <template #icon><Ban /></template>
          {{ t("order.confirmCancellation") }}
        </BaseButton>
      </div>
    </div>

    <div v-if="orderStore.mutationError" class="panel-error" role="alert">
      {{ orderStore.mutationError }}
    </div>
  </section>
</template>

<style scoped>
.management-panel {
  margin-bottom: 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  overflow: visible;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
}
header span,
label > span {
  color: var(--text-sub);
  font-size: 11px;
  font-weight: 600;
}
.panel-title {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.panel-title :deep(svg) {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  color: var(--green);
}
h2 {
  color: var(--text);
  font-size: 15px;
}
.action-row,
.editor-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}
.editor-grid,
.cancel-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
  gap: 12px;
  padding: 16px;
  border-top: 1px solid var(--border);
  background: var(--surface-soft);
}
label {
  display: grid;
  gap: 5px;
  min-width: 0;
}
input,
textarea {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 10px;
  background: var(--surface-raised);
  color: var(--text);
  font: inherit;
}
input {
  height: 38px;
}
input:focus,
textarea:focus {
  outline: none;
  border-color: var(--green);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--green) 20%, transparent);
}
textarea {
  min-height: 80px;
  resize: vertical;
}
.check-row {
  display: flex;
  align-items: center;
  align-self: end;
  min-height: 38px;
  gap: 8px;
}
.check-row input {
  width: 16px;
}
.editor-actions {
  grid-column: 1 / -1;
}
.panel-error {
  padding: 10px 16px;
  border-top: 1px solid rgba(180, 49, 43, 0.2);
  background: var(--red-soft);
  color: var(--red);
  font-size: 12px;
}

@media (max-width: 760px) {
  header {
    align-items: flex-start;
    flex-direction: column;
  }
  .editor-grid,
  .cancel-grid {
    grid-template-columns: 1fr;
  }
  .action-row {
    justify-content: flex-start;
  }
}
</style>
