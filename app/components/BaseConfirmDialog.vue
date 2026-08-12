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
const cancelRef = ref<HTMLButtonElement | null>(null);
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
      cancelRef.value?.focus();
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
            <button
              ref="cancelRef"
              type="button"
              class="btn-secondary"
              :disabled="busy"
              @click="cancel"
            >
              <X aria-hidden="true" />
              {{ cancelLabel || t("common.cancel") }}
            </button>
            <button
              type="button"
              class="btn-confirm"
              :class="{ danger }"
              :disabled="busy"
              @click="emit('confirm')"
            >
              <Trash2 v-if="danger" aria-hidden="true" />
              <Check v-else aria-hidden="true" />
              {{ busy ? t("common.processing") : confirmLabel || t("common.delete") }}
            </button>
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
  background: rgba(10, 18, 14, 0.58);
  backdrop-filter: blur(2px);
}

.confirm-dialog {
  width: min(440px, 100%);
  padding: 22px;
  border: 1px solid var(--border);
  border-radius: 12px;
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

.confirm-actions button {
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.confirm-actions button :deep(svg) {
  width: 15px;
  height: 15px;
}

.btn-secondary {
  background: var(--surface);
  color: var(--text);
}

.btn-confirm {
  border-color: var(--green);
  background: var(--green);
  color: var(--on-accent);
}

.btn-confirm.danger {
  border-color: var(--red);
  background: var(--red);
}

.confirm-actions button:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--green) 32%, transparent);
  outline-offset: 2px;
}

.confirm-actions button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
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
