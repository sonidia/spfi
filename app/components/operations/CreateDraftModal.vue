<script setup lang="ts">
import { FilePlus2, X } from "@lucide/vue";
import { computed, reactive, ref, useId } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useCommerceOpsStore } from "~/stores/commerceOps";

const emit = defineEmits<{ close: []; created: [] }>();
const store = useCommerceOpsStore();
const { storeId, token } = useActiveShopAuth();
const { t } = useLocalization();
const feedback = useStoreFeedback();
const modalRef = ref<HTMLFormElement | null>(null);
const titleId = `create-draft-title-${useId()}`;
const { handleKeydown } = useFocusTrap(modalRef, {
  initialFocus: () => modalRef.value?.querySelector("input") || null,
  onEscape: () => emit("close"),
});
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
    localError.value = t("operations.draft.validation");
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
    localError.value = store.mutationError || t("operations.draft.createFailed");
    return;
  }
  feedback.success(t("operations.draft.created", { name: result.name }));
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
            <p class="ops-eyebrow">{{ t("operations.drafts") }}</p>
            <h2 :id="titleId">{{ t("operations.draft.createTitle") }}</h2>
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
            <span>{{ t("operations.draft.customerEmail") }}</span>
            <input
              v-model="form.email"
              type="email"
              :placeholder="t('operations.draft.emailPlaceholder')"
            />
          </label>
          <label>
            <span>{{ t("operations.draft.currency") }}</span>
            <input v-model.trim="form.currencyCode" maxlength="3" required />
          </label>
          <label class="ops-form-wide">
            <span>{{ t("operations.draft.itemTitle") }}</span>
            <input
              v-model="form.title"
              required
              :placeholder="t('operations.draft.itemPlaceholder')"
            />
          </label>
          <label>
            <span>{{ t("operations.draft.quantity") }}</span>
            <input
              v-model.number="form.quantity"
              type="number"
              min="1"
              step="1"
              required
            />
          </label>
          <label>
            <span>{{ t("operations.draft.unitPrice") }}</span>
            <input
              v-model="form.unitPrice"
              type="number"
              min="0"
              step="0.01"
              required
            />
          </label>
          <label class="ops-form-wide">
            <span>{{ t("operations.draft.tags") }}</span>
            <input
              v-model="form.tags"
              :placeholder="t('operations.draft.tagsPlaceholder')"
            />
          </label>
          <label class="ops-form-wide">
            <span>{{ t("operations.draft.internalNote") }}</span>
            <textarea v-model="form.note" rows="3" />
          </label>
        </div>
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
            <template #icon><FilePlus2 /></template>
            {{ t("operations.draft.create") }}
          </BaseButton>
        </footer>
      </form>
    </div>
  </Teleport>
</template>
