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
const titleId = `sheet-data-title-${useId()}`;
const { handleKeydown } = useFocusTrap(panelRef, {
  active: toRef(props, "open"),
  initialFocus: () => panelRef.value?.querySelector("button") || null,
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
          <BaseButton
            class="modal-close"
            variant="ghost"
            icon-only
            :aria-label="t('common.close')"
            @click="emit('close')"
          >
            <template #icon><X aria-hidden="true" /></template>
          </BaseButton>
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
  background: var(--dialog-backdrop);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal-panel {
  width: min(1100px, 100%);
  max-height: 90vh;
  background: var(--surface, #fff);
  border-radius: var(--dialog-radius);
  border: 1px solid var(--border, #e5e5e5);
  box-shadow: var(--dialog-shadow);
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

.modal-body {
  padding: 0;
  overflow: auto;
}
</style>
