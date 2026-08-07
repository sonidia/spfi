<script setup lang="ts">
import { ListRestart, Pencil, Plus, Save, Trash2, X } from "@lucide/vue";
import { computed, ref } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useOrderApi } from "~/composables/useOrderApi";
import { useOrderStore } from "~/stores/order";
import { useToastStore } from "~/stores/toast";
import type { ShopifyOrder } from "~~/types/shopify";
import type {
  CalculatedOrderLineItem,
  OrderEditCustomItemInput,
  OrderEditSessionResponse,
} from "~~/types/shopify-order";
import { getAppErrorMessage } from "~~/utils/error";

const props = defineProps<{ order: ShopifyOrder }>();
const orderApi = useOrderApi();
const orderStore = useOrderStore();
const toast = useToastStore();
const { storeId, token, isReady } = useActiveShopAuth();

const isOpen = ref(false);
const isBeginning = ref(false);
const localError = ref("");
const session = ref<OrderEditSessionResponse | null>(null);
const quantities = ref<Record<string, number>>({});
const originalQuantities = ref<Record<string, number>>({});
const restockRemoved = ref(false);
const notifyCustomer = ref(false);
const staffNote = ref("");
const customItems = ref<OrderEditCustomItemInput[]>([]);
const customTitle = ref("");
const customPrice = ref("");
const customQuantity = ref(1);
const customTaxable = ref(true);
const customRequiresShipping = ref(false);

const cannotEdit = computed(
  () => Boolean(props.order.cancelled_at || props.order.closed_at),
);
const changes = computed(() =>
  (session.value?.lineItems || [])
    .filter(
      (lineItem) =>
        Number(quantities.value[lineItem.id]) !==
        Number(originalQuantities.value[lineItem.id]),
    )
    .map((lineItem) => ({
      calculatedLineItemId: lineItem.id,
      quantity: Number(quantities.value[lineItem.id]),
      restock:
        restockRemoved.value &&
        lineItem.restockable &&
        Number(quantities.value[lineItem.id]) <
          Number(originalQuantities.value[lineItem.id]),
    })),
);
const pendingChangeCount = computed(
  () => changes.value.length + customItems.value.length,
);
const canAddCustomItem = computed(() => {
  const price = Number(customPrice.value);

  return (
    Boolean(customTitle.value.trim()) &&
    customPrice.value.trim() !== "" &&
    Number.isFinite(price) &&
    price >= 0 &&
    Number.isSafeInteger(Number(customQuantity.value)) &&
    Number(customQuantity.value) > 0
  );
});

async function toggleEditor() {
  if (isOpen.value) {
    closeEditor();
    return;
  }
  if (!isReady.value || cannotEdit.value) return;

  isBeginning.value = true;
  localError.value = "";
  try {
    session.value = await orderApi.beginEdit(
      { storeId: storeId.value, token: token.value },
      props.order.id,
    );
    quantities.value = Object.fromEntries(
      session.value.lineItems.map((lineItem) => [lineItem.id, lineItem.quantity]),
    );
    originalQuantities.value = { ...quantities.value };
    isOpen.value = true;
  } catch (error) {
    localError.value = getAppErrorMessage(
      error,
      "Failed to begin editing order items.",
    );
  } finally {
    isBeginning.value = false;
  }
}

function closeEditor() {
  isOpen.value = false;
  session.value = null;
  quantities.value = {};
  originalQuantities.value = {};
  customItems.value = [];
  resetCustomItemDraft();
  localError.value = "";
}

function minimumQuantity(lineItem: CalculatedOrderLineItem) {
  return Math.max(0, lineItem.quantity - lineItem.editableQuantity);
}

function normalizeQuantity(lineItem: CalculatedOrderLineItem) {
  const minimum = minimumQuantity(lineItem);
  const value = Math.max(
    minimum,
    Math.floor(Number(quantities.value[lineItem.id]) || 0),
  );
  quantities.value[lineItem.id] = value;
}

function restoreOriginals() {
  quantities.value = { ...originalQuantities.value };
  customItems.value = [];
}

function addCustomItem() {
  if (!canAddCustomItem.value) return;

  const currencyCode = String(props.order.currency || "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{3}$/.test(currencyCode)) {
    localError.value = "The order does not have a valid currency code.";
    return;
  }

  customItems.value.push({
    title: customTitle.value.trim(),
    price: customPrice.value.trim(),
    currencyCode,
    quantity: Number(customQuantity.value),
    taxable: customTaxable.value,
    requiresShipping: customRequiresShipping.value,
  });
  resetCustomItemDraft();
  localError.value = "";
}

function removeCustomItem(index: number) {
  customItems.value.splice(index, 1);
}

function resetCustomItemDraft() {
  customTitle.value = "";
  customPrice.value = "";
  customQuantity.value = 1;
  customTaxable.value = true;
  customRequiresShipping.value = false;
}

async function commitEdit() {
  if (!isReady.value || !session.value || !pendingChangeCount.value) return;
  const updated = await orderStore.commitOrderEdit(
    storeId.value,
    token.value,
    props.order.id,
    {
      calculatedOrderId: session.value.calculatedOrderId,
      changes: changes.value,
      customItems: customItems.value,
      notifyCustomer: notifyCustomer.value,
      staffNote: staffNote.value,
    },
  );
  if (updated) {
    toast.success("Order items updated.");
    closeEditor();
  }
}
</script>

<template>
  <section class="line-editor" aria-labelledby="line-editor-title">
    <header>
      <div>
        <div class="panel-title"><ListRestart aria-hidden="true" /><h2 id="line-editor-title">Order items</h2></div>
        <p>Change quantities, remove unfulfilled lines, or add one-off custom items.</p>
      </div>
      <BaseButton
        :loading="isBeginning"
        :disabled="cannotEdit || orderStore.isMutating"
        @click="toggleEditor"
      >
        <template #icon><X v-if="isOpen" /><Pencil v-else /></template>
        {{ isOpen ? "Close editor" : "Edit items" }}
      </BaseButton>
    </header>

    <div v-if="cannotEdit" class="panel-note">
      Archived or cancelled orders cannot be edited with Shopify order editing.
    </div>

    <div v-if="isOpen && session" class="editor-body">
      <div v-for="lineItem in session.lineItems" :key="lineItem.id" class="item-row">
        <div class="item-copy">
          <strong>{{ lineItem.title }}</strong>
          <small v-if="lineItem.sku">SKU {{ lineItem.sku }}</small>
          <small>
            <template v-if="lineItem.quantity === 0">
              Removed; set a positive quantity to restore
            </template>
            <template v-else>
              {{ lineItem.editableQuantity }} editable
            </template>
            <template v-if="minimumQuantity(lineItem) > 0">
              · {{ minimumQuantity(lineItem) }} already fulfilled
            </template>
          </small>
        </div>
        <label>
          <span>New quantity</span>
          <input
            v-model.number="quantities[lineItem.id]"
            type="number"
            :min="minimumQuantity(lineItem)"
            step="1"
            :disabled="
              lineItem.editableQuantity <= 0 && lineItem.quantity > 0
            "
            @change="normalizeQuantity(lineItem)"
          />
        </label>
      </div>

      <div class="custom-item-section">
        <div class="custom-item-heading">
          <strong>Add custom item</strong>
          <span>For one-off products or services that aren't in the catalog.</span>
        </div>
        <div class="custom-item-grid">
          <label class="custom-title">
            <span>Title</span>
            <input v-model="customTitle" placeholder="Gift wrapping" />
          </label>
          <label>
            <span>Unit price ({{ order.currency }})</span>
            <input
              v-model="customPrice"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
            />
          </label>
          <label>
            <span>Quantity</span>
            <input
              v-model.number="customQuantity"
              type="number"
              min="1"
              step="1"
            />
          </label>
          <div class="custom-flags">
            <label class="check-row">
              <input v-model="customTaxable" type="checkbox" />
              <span>Taxable</span>
            </label>
            <label class="check-row">
              <input v-model="customRequiresShipping" type="checkbox" />
              <span>Requires shipping</span>
            </label>
          </div>
          <BaseButton :disabled="!canAddCustomItem" @click="addCustomItem">
            <template #icon><Plus /></template>
            Add to edit
          </BaseButton>
        </div>

        <div v-if="customItems.length" class="pending-custom-items">
          <div
            v-for="(customItem, index) in customItems"
            :key="`${customItem.title}-${index}`"
            class="pending-custom-item"
          >
            <div>
              <strong>{{ customItem.title }}</strong>
              <small>
                {{ customItem.quantity }} × {{ customItem.price }}
                {{ customItem.currencyCode }}
              </small>
            </div>
            <BaseButton
              variant="danger-ghost"
              aria-label="Remove pending custom item"
              @click="removeCustomItem(index)"
            >
              <template #icon><Trash2 /></template>
              Remove
            </BaseButton>
          </div>
        </div>
      </div>

      <div class="edit-options">
        <label class="check-row">
          <input v-model="restockRemoved" type="checkbox" />
          <span>Restock decreased quantities when possible</span>
        </label>
        <label class="check-row">
          <input v-model="notifyCustomer" type="checkbox" />
          <span>Notify customer</span>
        </label>
        <label class="staff-note">
          <span>Staff note</span>
          <input v-model="staffNote" placeholder="Why this order was edited" />
        </label>
      </div>

      <div class="editor-actions">
        <BaseButton :disabled="!pendingChangeCount" @click="restoreOriginals">
          <template #icon><ListRestart /></template>
          Reset
        </BaseButton>
        <BaseButton
          variant="primary"
          :loading="orderStore.isMutating"
          :disabled="!pendingChangeCount"
          @click="commitEdit"
        >
          <template #icon><Save /></template>
          Commit {{ pendingChangeCount }} change{{ pendingChangeCount === 1 ? "" : "s" }}
        </BaseButton>
      </div>
    </div>

    <div v-if="localError || orderStore.mutationError" class="panel-error" role="alert">
      {{ localError || orderStore.mutationError }}
    </div>
  </section>
</template>

<style scoped>
.line-editor { margin-bottom: 16px; overflow: hidden; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); box-shadow: var(--shadow); }
header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 16px; }
.panel-title { min-width: 0; display: inline-flex; align-items: center; gap: 8px; }
.panel-title :deep(svg) { width: 16px; height: 16px; flex: 0 0 16px; color: var(--green); }
h2 { color: var(--text); font-size: 15px; }
header p { margin: 3px 0 0; color: var(--text-sub); font-size: 12px; }
.editor-body { border-top: 1px solid var(--border); background: var(--surface-soft); }
.item-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 11px 16px; border-bottom: 1px solid var(--border); }
.item-copy { display: grid; min-width: 0; }
.item-copy strong { overflow: hidden; color: var(--text); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.item-copy small { color: var(--text-sub); font-size: 11px; }
.item-row label { display: grid; flex: 0 0 110px; gap: 4px; }
label > span { color: var(--text-sub); font-size: 11px; font-weight: 700; }
input { width: 100%; min-height: 34px; border: 1px solid var(--border); border-radius: 6px; padding: 7px 9px; background: var(--surface-raised); color: var(--text); font: inherit; }
input:focus { outline: none; border-color: var(--green); box-shadow: 0 0 0 3px color-mix(in srgb, var(--green) 20%, transparent); }
.custom-item-section { display: grid; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--border); }
.custom-item-heading { display: grid; gap: 2px; }
.custom-item-heading strong { color: var(--text); font-size: 12px; }
.custom-item-heading span { color: var(--text-sub); font-size: 11px; }
.custom-item-grid { display: grid; grid-template-columns: minmax(180px, 2fr) minmax(120px, 1fr) 90px minmax(190px, 1fr) auto; align-items: end; gap: 10px; }
.custom-item-grid > label { display: grid; gap: 4px; }
.custom-flags { display: grid; align-self: center; gap: 6px; }
.pending-custom-items { display: grid; gap: 6px; }
.pending-custom-item { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface-raised); }
.pending-custom-item > div { display: grid; min-width: 0; }
.pending-custom-item strong { overflow: hidden; color: var(--text); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.pending-custom-item small { color: var(--text-sub); font-size: 11px; }
.edit-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 16px; padding: 14px 16px; }
.check-row { display: flex; align-items: center; gap: 8px; }
.check-row input { width: 16px; min-height: 16px; }
.staff-note { display: grid; grid-column: 1 / -1; gap: 5px; }
.editor-actions { display: flex; justify-content: flex-end; gap: 8px; padding: 0 16px 16px; }
.panel-note, .panel-error { padding: 10px 16px; border-top: 1px solid var(--border); font-size: 12px; }
.panel-note { color: var(--text-sub); }
.panel-error { border-top-color: rgba(180, 49, 43, 0.2); background: var(--red-soft); color: var(--red); }

@media (max-width: 760px) {
  header { align-items: flex-start; flex-direction: column; }
  .custom-item-grid { grid-template-columns: 1fr; }
  .edit-options { grid-template-columns: 1fr; }
  .staff-note { grid-column: auto; }
}
</style>
