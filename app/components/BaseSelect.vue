<script setup lang="ts">
import { Check, ChevronDown } from "@lucide/vue";
import { computed, nextTick, onMounted, onUnmounted, ref, useId, watch } from "vue";

type SelectValue = string | number | boolean | Record<string, unknown> | null;

interface Option {
  label: string;
  value: SelectValue;
  description?: string;
  disabled?: boolean;
}

const props = withDefaults(
  defineProps<{
    modelValue?: SelectValue;
    options?: Option[];
    placeholder?: string;
    ariaLabel?: string;
    disabled?: boolean;
    className?: string;
    size?: "small" | "medium";
  }>(),
  {
    options: () => [],
    placeholder: "Select an option",
    ariaLabel: undefined,
    disabled: false,
    className: "",
    size: "medium",
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: SelectValue];
  change: [value: SelectValue];
}>();

const isOpen = ref(false);
const activeIndex = ref(-1);
const selectRef = ref<HTMLElement | null>(null);
const listboxId = `${useId()}-listbox`;

const selectedIndex = computed(() =>
  props.options.findIndex((option) => option.value === props.modelValue),
);
const selectedOption = computed(() => props.options[selectedIndex.value]);

function nextEnabledIndex(start: number, direction: 1 | -1) {
  if (!props.options.length) return -1;

  let index = start;
  for (let count = 0; count < props.options.length; count += 1) {
    index = (index + direction + props.options.length) % props.options.length;
    if (!props.options[index]?.disabled) return index;
  }

  return -1;
}

function open() {
  if (props.disabled) return;
  isOpen.value = true;
  activeIndex.value =
    selectedIndex.value >= 0 ? selectedIndex.value : nextEnabledIndex(-1, 1);
}

function close() {
  isOpen.value = false;
}

function toggle() {
  if (isOpen.value) close();
  else open();
}

function selectOption(option: Option) {
  if (option.disabled) return;
  emit("update:modelValue", option.value);
  emit("change", option.value);
  close();
}

function getOptionKey(option: Option) {
  return typeof option.value === "object"
    ? JSON.stringify(option.value)
    : String(option.value);
}

function handleKeydown(event: KeyboardEvent) {
  if (props.disabled) return;

  if (!isOpen.value && ["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
    event.preventDefault();
    open();
    return;
  }

  if (!isOpen.value) return;

  if (event.key === "Escape" || event.key === "Tab") {
    close();
    return;
  }

  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    activeIndex.value = nextEnabledIndex(
      activeIndex.value,
      event.key === "ArrowDown" ? 1 : -1,
    );
    return;
  }

  if (event.key === "Home" || event.key === "End") {
    event.preventDefault();
    activeIndex.value = nextEnabledIndex(
      event.key === "Home" ? -1 : 0,
      event.key === "Home" ? 1 : -1,
    );
    return;
  }

  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    const option = props.options[activeIndex.value];
    if (option) selectOption(option);
  }
}

function handleClickOutside(event: MouseEvent) {
  if (selectRef.value && !selectRef.value.contains(event.target as Node)) close();
}

watch([isOpen, activeIndex], async ([openState]) => {
  if (!openState) return;
  await nextTick();
  selectRef.value
    ?.querySelector<HTMLElement>(`[data-option-index="${activeIndex.value}"]`)
    ?.scrollIntoView({ block: "nearest" });
});

onMounted(() => document.addEventListener("mousedown", handleClickOutside));
onUnmounted(() => document.removeEventListener("mousedown", handleClickOutside));
</script>

<template>
  <div
    ref="selectRef"
    class="custom-select"
    :class="[{ 'is-open': isOpen, 'is-disabled': disabled }, `is-${size}`, className]"
    @keydown="handleKeydown"
  >
    <button
      class="select-trigger"
      type="button"
      role="combobox"
      :aria-controls="listboxId"
      :aria-expanded="isOpen"
      :aria-activedescendant="
        isOpen && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
      "
      aria-haspopup="listbox"
      :aria-label="ariaLabel"
      :disabled="disabled"
      @click="toggle"
    >
      <span v-if="$slots.icon" class="trigger-icon" aria-hidden="true">
        <slot name="icon" />
      </span>
      <span class="trigger-copy">
        <span v-if="selectedOption" class="selected-label">{{
          selectedOption.label
        }}</span>
        <span v-else class="placeholder">{{ placeholder }}</span>
        <small v-if="selectedOption?.description">{{
          selectedOption.description
        }}</small>
      </span>
      <ChevronDown class="chevron" :size="15" aria-hidden="true" />
    </button>

    <Transition name="dropdown">
      <div v-if="isOpen" :id="listboxId" class="select-dropdown" role="listbox">
        <button
          v-for="(option, index) in options"
          :key="getOptionKey(option)"
          class="select-option"
          type="button"
          role="option"
          :id="`${listboxId}-option-${index}`"
          :data-option-index="index"
          :class="{
            'is-active': index === activeIndex,
            'is-selected': option.value === modelValue,
          }"
          :aria-selected="option.value === modelValue"
          :disabled="option.disabled"
          @mouseenter="activeIndex = index"
          @click="selectOption(option)"
        >
          <span>
            <strong>{{ option.label }}</strong>
            <small v-if="option.description">{{ option.description }}</small>
          </span>
          <Check v-if="option.value === modelValue" :size="15" aria-hidden="true" />
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.custom-select {
  position: relative;
  width: 100%;
  min-width: 0;
  color: var(--text);
  font-family: inherit;
  font-size: 13px;
}

.select-trigger {
  width: 100%;
  max-width: 100%;
  min-height: var(--control-height-md);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: var(--control-radius-sm);
  background: var(--surface-raised);
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    background 0.15s ease;
}

.select-trigger:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--green) 48%, var(--border));
  background: var(--surface-soft);
}

.select-trigger:focus-visible,
.is-open .select-trigger {
  outline: none;
  border-color: var(--green);
  box-shadow: var(--focus-ring);
}

.custom-select.is-small .select-trigger {
  min-height: var(--control-height-sm);
  padding-block: 5px;
}

.select-trigger:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.trigger-copy,
.select-option > span {
  min-width: 0;
  display: grid;
  flex: 1 1 auto;
  gap: 1px;
}

.trigger-icon,
.trigger-icon :deep(svg) {
  width: 15px;
  height: 15px;
  flex: 0 0 15px;
}

.trigger-icon {
  display: inline-grid;
  place-items: center;
  color: var(--text-sub);
}

.selected-label,
.select-option strong {
  overflow: hidden;
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.placeholder,
.trigger-copy small,
.select-option small {
  color: var(--text-muted);
  font-size: 11px;
}

.chevron {
  flex: 0 0 auto;
  color: var(--text-sub);
  transition: transform 0.15s ease;
}

.is-open .chevron {
  transform: rotate(180deg);
}

.select-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 1001;
  max-height: 260px;
  overflow-y: auto;
  padding: 5px;
  border: 1px solid var(--border);
  border-radius: var(--control-radius);
  background: var(--surface-raised);
  box-shadow: var(--shadow-soft);
}

.select-option {
  width: 100%;
  min-height: var(--control-height-md);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 7px 9px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.select-option.is-active {
  background: var(--surface-soft);
}

.select-option.is-selected {
  color: var(--green);
}

.select-option.is-selected strong {
  color: currentColor;
}

.select-option:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
