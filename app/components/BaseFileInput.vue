<script setup lang="ts">
import { ImageUp } from "@lucide/vue";
import { ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    label: string;
    accept?: string;
    fileName?: string;
    disabled?: boolean;
  }>(),
  {
    accept: "",
    fileName: "",
    disabled: false,
  },
);

const emit = defineEmits<{ select: [file: File | null] }>();
const inputRef = ref<HTMLInputElement | null>(null);

watch(
  () => props.fileName,
  (fileName) => {
    if (!fileName && inputRef.value) inputRef.value.value = "";
  },
);

function openPicker() {
  if (!props.disabled) inputRef.value?.click();
}

function handleChange(event: Event) {
  const input = event.target as HTMLInputElement;
  emit("select", input.files?.[0] || null);
}
</script>

<template>
  <div class="base-file-input" :class="{ 'has-file': fileName }">
    <button
      type="button"
      class="file-input-trigger"
      :disabled="disabled"
      :aria-label="label"
      @click="openPicker"
    >
      <ImageUp aria-hidden="true" />
      <span>{{ label }}</span>
    </button>
    <small v-if="fileName" :title="fileName">{{ fileName }}</small>
    <input
      ref="inputRef"
      class="file-input-native"
      type="file"
      :accept="accept"
      :disabled="disabled"
      tabindex="-1"
      @change="handleChange"
    />
  </div>
</template>

<style scoped>
.base-file-input {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.file-input-trigger {
  width: 100%;
  height: 36px;
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 10px;
  border: 1px dashed color-mix(in srgb, var(--green) 55%, var(--border));
  border-radius: 7px;
  background: var(--green-soft);
  color: var(--green);
  font: inherit;
  font-size: 11px;
  font-weight: 650;
  cursor: pointer;
}

.file-input-trigger:hover:not(:disabled) {
  border-style: solid;
  background: color-mix(in srgb, var(--green-soft) 78%, var(--surface-raised));
}

.file-input-trigger:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--green) 20%, transparent);
}

.file-input-trigger:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.file-input-trigger svg {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
}

.base-file-input small {
  overflow: hidden;
  color: var(--text-sub);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-input-native {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
</style>
