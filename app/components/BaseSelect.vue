<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';

interface Option {
  label: string;
  value: any;
}

const props = defineProps({
  modelValue: [String, Number, Object],
  options: {
    type: Array as () => Option[],
    default: () => [],
  },
  placeholder: {
    type: String,
    default: 'Select an option',
  },
  disabled: Boolean,
  className: String,
});

const emit = defineEmits(['update:modelValue', 'change']);

const isOpen = ref(false);
const selectRef = ref<HTMLElement | null>(null);

const selectedOption = computed(() => {
  return props.options.find(opt => opt.value === props.modelValue);
});

const toggle = () => {
  if (props.disabled) return;
  isOpen.value = !isOpen.value;
};

const close = () => {
  isOpen.value = false;
};

const selectOption = (option: Option) => {
  emit('update:modelValue', option.value);
  emit('change', option.value);
  close();
};

const handleClickOutside = (event: MouseEvent) => {
  if (selectRef.value && !selectRef.value.contains(event.target as Node)) {
    close();
  }
};

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside);
});
</script>

<template>
  <div class="custom-select" :class="[{ 'is-open': isOpen, 'is-disabled': disabled }, className]" ref="selectRef">
    <div class="select-trigger" @click="toggle">
      <span v-if="selectedOption" class="selected-label">{{ selectedOption.label }}</span>
      <span v-else class="placeholder">{{ placeholder }}</span>
      <div class="chevron">
        <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M5 8l5 5 5-5" />
        </svg>
      </div>
    </div>

    <Transition name="dropdown">
      <div v-if="isOpen" class="select-dropdown">
        <div 
          v-for="option in options" 
          :key="option.value" 
          class="select-option" 
          :class="{ 'is-selected': option.value === modelValue }"
          @click="selectOption(option)"
        >
          {{ option.label }}
          <span v-if="option.value === modelValue" class="check-icon">✓</span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.custom-select {
  position: relative;
  min-width: 150px;
  font-family: inherit;
  font-size: 13px;
}

.select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: white;
  border: 1px solid var(--border, #e5e5e5);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.custom-select:hover .select-trigger {
  border-color: var(--blue, #005bd3);
}

.is-open .select-trigger {
  border-color: var(--blue, #005bd3);
  box-shadow: 0 0 0 1px var(--blue, #005bd3);
}

.is-disabled .select-trigger {
  background: #f5f5f5;
  cursor: not-allowed;
  opacity: 0.7;
}

.placeholder {
  color: var(--text-muted, #8d8d8d);
}

.selected-label {
  color: var(--text-primary, #1a1a1a);
  font-weight: 500;
}

.chevron {
  transition: transform 0.2s ease;
  color: var(--text-secondary, #6d6d6d);
}

.is-open .chevron {
  transform: rotate(180deg);
}

.select-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 1001;
  background: white;
  border: 1px solid var(--border, #e5e5e5);
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  max-height: 250px;
  overflow-y: auto;
  padding: 4px;
}

.select-option {
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: background 0.15s;
  color: var(--text-primary, #1a1a1a);
}

.select-option:hover {
  background: #f4f6f8;
}

.select-option.is-selected {
  background: #f0f7ff;
  color: var(--blue, #005bd3);
  font-weight: 500;
}

.check-icon {
  font-size: 14px;
}

/* Transitions */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
