<script setup lang="ts">
import { BadgePlus, X } from "@lucide/vue";
import { computed, reactive, ref, useId } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useCommerceOpsStore } from "~/stores/commerceOps";

const emit = defineEmits<{ close: []; created: [] }>();
const store = useCommerceOpsStore();
const { storeId, token } = useActiveShopAuth();
const { t } = useLocalization();
const feedback = useStoreFeedback();
const localError = ref("");
const modalRef = ref<HTMLFormElement | null>(null);
const titleId = `create-discount-title-${useId()}`;
const { handleKeydown } = useFocusTrap(modalRef, {
  initialFocus: () => modalRef.value?.querySelector("input") || null,
  onEscape: () => emit("close"),
});
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
const valueTypeOptions = [
  { label: t("operations.discount.percentage"), value: "percentage" },
  { label: t("operations.discount.fixed"), value: "fixed" },
];

function updateValueType(value: unknown) {
  if (value === "percentage" || value === "fixed") form.valueType = value;
}
const canSubmit = computed(() =>
  Boolean(form.title.trim() && form.code.trim() && Number(form.value) > 0),
);

async function submit() {
  localError.value = "";
  if (!canSubmit.value) {
    localError.value = t("operations.discount.validation");
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
    localError.value = store.mutationError || t("operations.discount.createFailed");
    return;
  }
  feedback.success(t("operations.discount.created"));
  emit("created");
}
</script>

<template>
  <Teleport to="body">
    <div class="ops-modal-backdrop" @click.self="emit('close')">
      <form
        ref="modalRef"
        class="ops-modal"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        tabindex="-1"
        @keydown="handleKeydown"
        @submit.prevent="submit"
      >
        <header>
          <div>
            <p class="ops-eyebrow">{{ t("operations.discounts") }}</p>
            <h2 :id="titleId">{{ t("operations.discount.createTitle") }}</h2>
          </div>
          <BaseButton
            class="ops-modal-close"
            variant="ghost"
            icon-only
            :aria-label="t('common.close')"
            @click="emit('close')"
          >
            <template #icon><X aria-hidden="true" /></template>
          </BaseButton>
        </header>
        <div class="ops-form-grid">
          <label>
            <span>{{ t("operations.discount.internalTitle") }}</span>
            <input
              v-model="form.title"
              required
              :placeholder="t('operations.discount.titlePlaceholder')"
            />
          </label>
          <label>
            <span>{{ t("operations.discount.checkoutCode") }}</span>
            <input
              v-model="form.code"
              required
              :placeholder="t('operations.discount.codePlaceholder')"
            />
          </label>
          <label>
            <span>{{ t("operations.discount.valueType") }}</span>
            <BaseSelect
              :model-value="form.valueType"
              :options="valueTypeOptions"
              @update:model-value="updateValueType"
            />
          </label>
          <label>
            <span>{{
              form.valueType === "percentage"
                ? t("operations.discount.percentOff")
                : t("operations.discount.amountOff")
            }}</span>
            <input v-model="form.value" type="number" min="0.01" step="0.01" required />
          </label>
          <label>
            <span>{{ t("operations.discount.startsAt") }}</span>
            <input v-model="form.startsAt" type="datetime-local" />
          </label>
          <label>
            <span>{{ t("operations.discount.endsAt") }}</span>
            <input v-model="form.endsAt" type="datetime-local" />
          </label>
          <label>
            <span>{{ t("operations.discount.usageLimit") }}</span>
            <input
              v-model="form.usageLimit"
              type="number"
              min="1"
              step="1"
              :placeholder="t('operations.discount.unlimited')"
            />
          </label>
          <label class="ops-checkbox-label">
            <input v-model="form.appliesOncePerCustomer" type="checkbox" />
            <span>{{ t("operations.discount.oncePerCustomer") }}</span>
          </label>
        </div>
        <p class="ops-form-hint">{{ t("operations.discount.scopeHint") }}</p>
        <p v-if="localError" class="ops-form-error" role="alert">{{ localError }}</p>
        <footer>
          <BaseButton
            type="button"
            size="medium"
            :disabled="store.isMutating"
            @click="emit('close')"
          >
            <template #icon><X /></template>
            {{ t("common.cancel") }}
          </BaseButton>
          <BaseButton
            type="submit"
            size="medium"
            variant="primary"
            :loading="store.isMutating"
          >
            <template #icon><BadgePlus /></template>
            {{ t("operations.discount.createCode") }}
          </BaseButton>
        </footer>
      </form>
    </div>
  </Teleport>
</template>
