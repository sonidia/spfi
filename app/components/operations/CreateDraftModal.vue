<script setup lang="ts">
import { FilePlus2, X } from "@lucide/vue";
import { computed, reactive, ref } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useCommerceOpsStore } from "~/stores/commerceOps";

const emit = defineEmits<{ close: []; created: [] }>();
const store = useCommerceOpsStore();
const { storeId, token } = useActiveShopAuth();
const feedback = useStoreFeedback();
const form = reactive({
  email: "",
  note: "",
  tags: "",
  currencyCode: "USD",
  title: "",
  quantity: 1,
  unitPrice: "",
});
const localError = ref("");
const canSubmit = computed(
  () =>
    Boolean(form.title.trim()) &&
    Number.isSafeInteger(Number(form.quantity)) &&
    Number(form.quantity) > 0 &&
    Number(form.unitPrice) >= 0,
);

async function submit() {
  localError.value = "";
  if (!canSubmit.value) {
    localError.value = "Add a valid item title, quantity and unit price.";
    return;
  }
  const result = await store.createDraft(storeId.value, token.value, {
    email: form.email.trim() || undefined,
    note: form.note.trim() || undefined,
    tags: form.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    currencyCode: form.currencyCode,
    lineItems: [
      {
        title: form.title.trim(),
        quantity: Number(form.quantity),
        unitPrice: form.unitPrice,
      },
    ],
  });
  if (!result) {
    localError.value = store.mutationError || "Failed to create the draft order.";
    return;
  }
  feedback.success(`${result.name} created.`);
  emit("created");
}
</script>

<template>
  <Teleport to="body">
    <div class="ops-modal-backdrop" @click.self="emit('close')">
      <form class="ops-modal" @submit.prevent="submit">
        <header>
          <div>
            <p class="ops-eyebrow">Draft orders</p>
            <h2>Create a manual sale</h2>
          </div>
          <button
            type="button"
            class="ops-modal-close"
            aria-label="Close"
            @click="emit('close')"
          >
            <X aria-hidden="true" />
          </button>
        </header>
        <div class="ops-form-grid">
          <label>
            <span>Customer email</span>
            <input
              v-model="form.email"
              type="email"
              placeholder="customer@example.com"
            />
          </label>
          <label>
            <span>Currency</span>
            <input v-model.trim="form.currencyCode" maxlength="3" required />
          </label>
          <label class="ops-form-wide">
            <span>Item title</span>
            <input
              v-model="form.title"
              required
              placeholder="Custom service or product"
            />
          </label>
          <label>
            <span>Quantity</span>
            <input
              v-model.number="form.quantity"
              type="number"
              min="1"
              step="1"
              required
            />
          </label>
          <label>
            <span>Unit price</span>
            <input
              v-model="form.unitPrice"
              type="number"
              min="0"
              step="0.01"
              required
            />
          </label>
          <label class="ops-form-wide">
            <span>Tags</span>
            <input v-model="form.tags" placeholder="phone-order, wholesale" />
          </label>
          <label class="ops-form-wide">
            <span>Internal note</span>
            <textarea v-model="form.note" rows="3" />
          </label>
        </div>
        <p v-if="localError" class="ops-form-error" role="alert">{{ localError }}</p>
        <footer>
          <BaseButton type="button" :disabled="store.isMutating" @click="emit('close')">
            <template #icon><X /></template>
            Cancel
          </BaseButton>
          <BaseButton type="submit" variant="primary" :loading="store.isMutating">
            <template #icon><FilePlus2 /></template>
            Create draft
          </BaseButton>
        </footer>
      </form>
    </div>
  </Teleport>
</template>
