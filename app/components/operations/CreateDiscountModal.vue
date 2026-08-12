<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useCommerceOpsStore } from "~/stores/commerceOps";

const emit = defineEmits<{ close: []; created: [] }>();
const store = useCommerceOpsStore();
const { storeId, token } = useActiveShopAuth();
const feedback = useStoreFeedback();
const localError = ref("");
const form = reactive({
  title: "",
  code: "",
  valueType: "percentage" as "percentage" | "fixed",
  value: "10",
  startsAt: "",
  endsAt: "",
  usageLimit: "",
  appliesOncePerCustomer: false,
});
const canSubmit = computed(() =>
  Boolean(form.title.trim() && form.code.trim() && Number(form.value) > 0),
);

async function submit() {
  localError.value = "";
  if (!canSubmit.value) {
    localError.value = "Add a title, code and discount value.";
    return;
  }
  const result = await store.createCodeDiscount(storeId.value, token.value, {
    title: form.title.trim(),
    code: form.code.trim(),
    valueType: form.valueType,
    value: form.value,
    startsAt: form.startsAt || undefined,
    endsAt: form.endsAt || undefined,
    usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
    appliesOncePerCustomer: form.appliesOncePerCustomer,
  });
  if (!result) {
    localError.value = store.mutationError || "Failed to create the discount.";
    return;
  }
  feedback.success("Discount code created.");
  emit("created");
}
</script>

<template>
  <Teleport to="body">
    <div class="ops-modal-backdrop" @click.self="emit('close')">
      <form class="ops-modal" @submit.prevent="submit">
        <header>
          <div>
            <p class="ops-eyebrow">Discounts</p>
            <h2>Create an amount-off code</h2>
          </div>
          <button type="button" class="ops-modal-close" @click="emit('close')">
            ×
          </button>
        </header>
        <div class="ops-form-grid">
          <label>
            <span>Internal title</span>
            <input v-model="form.title" required placeholder="Summer launch" />
          </label>
          <label>
            <span>Checkout code</span>
            <input v-model="form.code" required placeholder="SUMMER20" />
          </label>
          <label>
            <span>Value type</span>
            <select v-model="form.valueType">
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed amount</option>
            </select>
          </label>
          <label>
            <span>{{
              form.valueType === "percentage" ? "Percent off" : "Amount off"
            }}</span>
            <input v-model="form.value" type="number" min="0.01" step="0.01" required />
          </label>
          <label>
            <span>Starts at</span>
            <input v-model="form.startsAt" type="datetime-local" />
          </label>
          <label>
            <span>Ends at</span>
            <input v-model="form.endsAt" type="datetime-local" />
          </label>
          <label>
            <span>Usage limit</span>
            <input
              v-model="form.usageLimit"
              type="number"
              min="1"
              step="1"
              placeholder="Unlimited"
            />
          </label>
          <label class="ops-checkbox-label">
            <input v-model="form.appliesOncePerCustomer" type="checkbox" />
            <span>Limit to one use per customer</span>
          </label>
        </div>
        <p class="ops-form-hint">The code applies to all products and all buyers.</p>
        <p v-if="localError" class="ops-form-error" role="alert">{{ localError }}</p>
        <footer>
          <BaseButton type="button" :disabled="store.isMutating" @click="emit('close')">
            Cancel
          </BaseButton>
          <BaseButton type="submit" variant="primary" :loading="store.isMutating">
            Create code
          </BaseButton>
        </footer>
      </form>
    </div>
  </Teleport>
</template>
