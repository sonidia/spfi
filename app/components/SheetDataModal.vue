<script setup lang="ts">
import { X } from "@lucide/vue";
import { ref, toRef, useId } from "vue";

const props = defineProps<{
  open: boolean;
  title?: string;
}>();

const emit = defineEmits<{
  (event: "close"): void;
}>();
const { t } = useLocalization();
const panelRef = ref<HTMLElement | null>(null);
const closeRef = ref<HTMLButtonElement | null>(null);
const titleId = `sheet-data-title-${useId()}`;
const { handleKeydown } = useFocusTrap(panelRef, {
  active: toRef(props, "open"),
  initialFocus: () => closeRef.value,
  onEscape: () => emit("close"),
});

function onOverlayClick(event: MouseEvent) {
  if (event.target === event.currentTarget) {
    emit("close");
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="modal-overlay"
      @click="onOverlayClick"
      @keydown="handleKeydown"
    >
      <div
        ref="panelRef"
        class="modal-panel"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        tabindex="-1"
      >
        <div class="modal-header">
          <h3 :id="titleId" class="modal-title">
            {{ title || t("sheet.dataTitle") }}
          </h3>
          <button
            ref="closeRef"
            class="modal-close"
            type="button"
            :aria-label="t('common.close')"
            @click="emit('close')"
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <div class="modal-body">
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal-panel {
  width: min(1100px, 100%);
  max-height: 90vh;
  background: var(--surface, #fff);
  border-radius: 12px;
  border: 1px solid var(--border, #e5e5e5);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border, #e5e5e5);
}

.modal-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary, #111);
}

.modal-close {
  width: 30px;
  height: 30px;
  display: inline-grid;
  place-items: center;
  border: 1px solid var(--border, #e5e5e5);
  border-radius: 6px;
  background: var(--surface, #fff);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  color: var(--text-primary, #333);
}

.modal-close :deep(svg) {
  width: 16px;
  height: 16px;
}

.modal-close:hover {
  background: var(--surface-soft, #f6f6f6);
}

.modal-body {
  padding: 0;
  overflow: auto;
}
</style>
