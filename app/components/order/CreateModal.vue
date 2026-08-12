<script setup lang="ts">
import { ShoppingCart, X } from "@lucide/vue";
import { ref } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useOrderStore } from "~/stores/order";
import type { OrderCreateOptions } from "~~/types/shopify-order";

const emit = defineEmits<{
  close: [];
  created: [];
}>();

const orderStore = useOrderStore();
const { storeId, token, isReady } = useActiveShopAuth();
const email = ref("");
const lineItems = ref([{ variantId: "", quantity: 1 }]);
const inventoryBehaviour = ref<OrderCreateOptions["inventory_behaviour"]>("bypass");
const sendReceipt = ref(false);
const sendFulfillmentReceipt = ref(false);
const validationError = ref("");
const inventoryOptions = [
  {
    label: "Do not claim inventory",
    value: "bypass",
    description: "Create without reserving stock",
  },
  {
    label: "Follow inventory policy",
    value: "decrement_obeying_policy",
    description: "Claim stock only when policy allows",
  },
  {
    label: "Ignore inventory policy",
    value: "decrement_ignoring_policy",
    description: "Claim stock regardless of policy",
  },
];

function addLineItem() {
  lineItems.value.push({ variantId: "", quantity: 1 });
}

function removeLineItem(index: number) {
  if (lineItems.value.length === 1) return;
  lineItems.value.splice(index, 1);
}

function setInventoryBehaviour(value: unknown) {
  if (
    ["bypass", "decrement_obeying_policy", "decrement_ignoring_policy"].includes(
      String(value),
    )
  ) {
    inventoryBehaviour.value = value as OrderCreateOptions["inventory_behaviour"];
  }
}

async function submit() {
  validationError.value = "";
  const normalizedItems = lineItems.value
    .map((item) => ({
      variant_id: item.variantId.trim(),
      quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
    }))
    .filter((item) => /^\d+$/.test(String(item.variant_id)));

  if (!isReady.value) {
    validationError.value = "The active store token is missing or expired.";
    return;
  }
  if (normalizedItems.length !== lineItems.value.length) {
    validationError.value = "Every line item needs a valid variant ID.";
    return;
  }

  const order = await orderStore.createOrder(
    storeId.value,
    token.value,
    {
      ...(email.value.trim() ? { email: email.value.trim() } : {}),
      line_items: normalizedItems,
    },
    {
      inventory_behaviour: inventoryBehaviour.value,
      send_receipt: sendReceipt.value,
      send_fulfillment_receipt: sendFulfillmentReceipt.value,
    },
  );

  if (order) {
    emit("created");
    emit("close");
  }
}
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <section
      class="order-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-order-title"
    >
      <header>
        <div>
          <span class="eyebrow">Orders</span>
          <h2 id="create-order-title">Create order</h2>
        </div>
        <button
          class="icon-button"
          type="button"
          aria-label="Close"
          @click="emit('close')"
        >
          <X :size="19" />
        </button>
      </header>

      <div class="modal-body">
        <label class="field">
          <span>Customer email</span>
          <input v-model="email" type="email" autocomplete="email" />
        </label>

        <div class="line-items">
          <div class="section-heading">
            <span>Line items</span>
            <button
              type="button"
              class="icon-command"
              title="Add line item"
              @click="addLineItem"
            >
              <IconsAdd />
            </button>
          </div>
          <div v-for="(item, index) in lineItems" :key="index" class="line-item-row">
            <label class="field">
              <span>Variant ID</span>
              <input v-model="item.variantId" inputmode="numeric" required />
            </label>
            <label class="field quantity-field">
              <span>Quantity</span>
              <input v-model.number="item.quantity" type="number" min="1" required />
            </label>
            <button
              class="icon-command is-danger"
              type="button"
              title="Remove line item"
              :disabled="lineItems.length === 1"
              @click="removeLineItem(index)"
            >
              <IconsDelete />
            </button>
          </div>
        </div>

        <label class="field">
          <span>Inventory behavior</span>
          <BaseSelect
            :model-value="inventoryBehaviour"
            :options="inventoryOptions"
            @update:model-value="setInventoryBehaviour"
          />
        </label>

        <label class="check-row">
          <input v-model="sendReceipt" type="checkbox" />
          <span>Send order confirmation</span>
        </label>
        <label class="check-row">
          <input v-model="sendFulfillmentReceipt" type="checkbox" />
          <span>Send fulfillment confirmation</span>
        </label>

        <div
          v-if="validationError || orderStore.mutationError"
          class="form-error"
          role="alert"
        >
          {{ validationError || orderStore.mutationError }}
        </div>
      </div>

      <footer>
        <BaseButton size="medium" @click="emit('close')">
          <template #icon><X /></template>
          Cancel
        </BaseButton>
        <BaseButton
          variant="primary"
          size="medium"
          :loading="orderStore.isMutating"
          @click="submit"
        >
          <template #icon><ShoppingCart /></template>
          Create order
        </BaseButton>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(12, 20, 16, 0.5);
}

.order-modal {
  width: min(620px, 100%);
  max-height: min(760px, calc(100vh - 40px));
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  box-shadow: 0 24px 70px rgba(12, 20, 16, 0.28);
}

header,
footer,
.section-heading,
.line-item-row {
  display: flex;
  align-items: center;
}

header,
footer {
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px;
}

header {
  border-bottom: 1px solid var(--border);
}
footer {
  justify-content: flex-end;
  border-top: 1px solid var(--border);
}
h2 {
  font-size: 18px;
  color: var(--text);
}
.eyebrow {
  color: var(--text-sub);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}
.modal-body {
  display: grid;
  gap: 14px;
  padding: 18px;
}
.field {
  display: grid;
  gap: 6px;
  min-width: 0;
}
.field > span,
.section-heading > span {
  color: var(--text-sub);
  font-size: 12px;
  font-weight: 600;
}
input {
  width: 100%;
  height: 38px;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0 10px;
  background: var(--surface-raised);
  color: var(--text);
  font: inherit;
}
input:focus {
  outline: none;
  border-color: var(--green);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--green) 20%, transparent);
}
.line-items {
  display: grid;
  gap: 8px;
}
.section-heading {
  justify-content: space-between;
}
.line-item-row {
  align-items: end;
  gap: 8px;
}
.line-item-row .field:first-child {
  flex: 1;
}
.quantity-field {
  width: 110px;
}
.icon-button,
.icon-command {
  display: inline-grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text-sub);
  cursor: pointer;
}
.icon-button {
  border: 0;
  font-size: 24px;
}
.icon-command.is-danger {
  color: var(--red);
}
.icon-command:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.check-row {
  display: flex;
  align-items: center;
  gap: 9px;
  color: var(--text);
  font-size: 13px;
}
.check-row input {
  width: 16px;
  height: 16px;
}
.form-error {
  padding: 10px 12px;
  border: 1px solid rgba(180, 49, 43, 0.22);
  border-radius: 6px;
  background: var(--red-soft);
  color: var(--red);
  font-size: 12px;
}

@media (max-width: 520px) {
  .line-item-row {
    align-items: stretch;
    flex-wrap: wrap;
  }
  .quantity-field {
    width: calc(100% - 42px);
  }
}
</style>
