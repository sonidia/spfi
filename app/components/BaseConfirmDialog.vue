<script setup lang="ts">
import { Check, Trash2, X } from "@lucide/vue";
import { nextTick, onUnmounted, ref, useId, watch } from "vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    busy?: boolean;
    danger?: boolean;
  }>(),
  {
    confirmLabel: "",
    cancelLabel: "",
    busy: false,
    danger: true,
  },
);

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();

const { t } = useLocalization();
const id = useId();
const titleId = `confirm-title-${id}`;
const messageId = `confirm-message-${id}`;
const dialogRef = ref<HTMLElement | null>(null);
let previousFocus: HTMLElement | null = null;

function cancel() {
  if (!props.busy) emit("cancel");
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    cancel();
    return;
  }

  if (event.key !== "Tab" || !dialogRef.value) return;
  const focusable = Array.from(
    dialogRef.value.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
  if (!focusable.length) return;

  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      previousFocus = document.activeElement as HTMLElement | null;
      await nextTick();
      dialogRef.value?.querySelector<HTMLButtonElement>("button")?.focus();
      return;
    }

    previousFocus?.focus();
    previousFocus = null;
  },
);

onUnmounted(() => previousFocus?.focus());
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm-dialog">
      <div
        v-if="open"
        class="confirm-backdrop"
        @click.self="cancel"
        @keydown="handleKeydown"
      >
        <section
          ref="dialogRef"
          class="confirm-dialog"
          role="alertdialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          :aria-describedby="messageId"
          :aria-busy="busy"
        >
          <h2 :id="titleId">{{ title }}</h2>
          <p :id="messageId">{{ message }}</p>
          <div class="confirm-actions">
            <BaseButton size="medium" :disabled="busy" @click="cancel">
              <template #icon><X aria-hidden="true" /></template>
              {{ cancelLabel || t("common.cancel") }}
            </BaseButton>
            <BaseButton
              size="medium"
              :variant="danger ? 'danger' : 'primary'"
              :disabled="busy"
              @click="emit('confirm')"
            >
              <template #icon>
                <Trash2 v-if="danger" aria-hidden="true" />
                <Check v-else aria-hidden="true" />
              </template>
              {{ busy ? t("common.processing") : confirmLabel || t("common.delete") }}
            </BaseButton>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.confirm-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9000;
  display: grid;
  place-items: center;
  padding: 20px;
  background: var(--dialog-backdrop);
  backdrop-filter: blur(2px);
}

.confirm-dialog {
  width: min(440px, 100%);
  padding: 22px;
  border: 1px solid var(--border);
  border-radius: var(--dialog-radius);
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow);
}

.confirm-dialog h2 {
  margin: 0 0 8px;
  font-size: 18px;
}

.confirm-dialog p {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.55;
}

.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 22px;
}

.confirm-dialog-enter-active,
.confirm-dialog-leave-active {
  transition: opacity 0.16s ease;
}

.confirm-dialog-enter-from,
.confirm-dialog-leave-to {
  opacity: 0;
}
</style>
